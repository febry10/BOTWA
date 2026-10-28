/**
 * Moderation Pipeline — Orchestrates all moderation handlers in priority order.
 * Single-pass pipeline with short-circuit on first violation.
 */
import { WASocket, proto } from '@whiskeysockets/baileys';
import { GroupSettings } from '../../config/defaults.js';
import { Role, parseRole } from '../../config/permissions.js';
import { deleteMessage, sendMessage } from '../client.js';
import { isGroupJid, jidToMention } from '../../utils/jid.js';
import { renderTemplate } from '../../messages/index.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { MUTE_MESSAGES } from '../../messages/mute.js';
import { WARNING_MESSAGES } from '../../messages/warning.js';

import { checkMuteStatus } from '../../services/mute.service.js';
import { muteUser } from '../../services/mute.service.js';
import { issueWarning, getActiveWarningCount } from '../../services/warning.service.js';
import { logMessageAction } from '../../services/logging.service.js';
import { isWhitelisted, isBlacklisted } from '../../services/member.service.js';

import { detectProfanity } from '../../moderation/profanity/detector.js';
import { checkSpam } from '../../moderation/spam/detector.js';
import { detectFlood, checkMentionSpam } from '../../moderation/flood/detector.js';
import { detectLinks } from '../../moderation/links/detector.js';
import { recordViolation, recordProfanityViolation } from '../../moderation/violations/manager.js';
import { formatDuration } from '../../utils/duration.js';

import pino from 'pino';

const logger = pino({ name: 'moderation-pipeline' });

export interface ModerationContext {
  sock: WASocket;
  message: proto.IWebMessageInfo;
  groupJid: string;
  senderJid: string;
  userId: number;
  groupId: number;
  userRole: Role;
  text: string;
  messageType: string;
  mentions: string[];
  settings: GroupSettings;
}

export interface ModerationResult {
  action: 'NONE' | 'DELETE' | 'WARN' | 'MUTE' | 'KICK' | 'BAN';
  reason: string | null;
  handled: boolean;
}

/**
 * Run the moderation pipeline on a message.
 * Returns the result of the first handler that matches.
 */
export async function runModerationPipeline(ctx: ModerationContext): Promise<ModerationResult> {
  const noAction: ModerationResult = { action: 'NONE', reason: null, handled: false };

  try {
    // ── Active mute (enforced even when auto-moderation is off) ──
    const muteStatus = await checkMuteStatus(ctx.userId, ctx.groupId);
    if (muteStatus.muted) {
      const deleted = await deleteMessage(ctx.groupJid, ctx.message.key!);
      if (deleted) {
        logger.info({ userId: ctx.userId, groupId: ctx.groupId }, 'Deleted muted user message');
      } else {
        logger.warn({ userId: ctx.userId, groupId: ctx.groupId }, 'Failed to delete muted user message');
      }
      await logMessageAction(ctx.groupId, ctx.userId, ctx.messageType, ctx.text, 'DELETE', 'User sedang di-mute');
      return { action: 'DELETE', reason: 'Muted', handled: true };
    }

    // If mute just expired, send notification
    if (muteStatus.expired) {
      const mention = jidToMention(ctx.senderJid);
      await sendMessage(
        ctx.groupJid,
        renderTemplate(MUTE_MESSAGES.autoUnmuted, { user: mention }),
        [ctx.senderJid]
      );
    }

    // Skip if auto-moderation is disabled
    if (!ctx.settings.auto_moderation) return noAction;

    // ── Priority 1: Check if sender is protected ──
    const protectedRoles = ctx.settings.protected_roles.map(r => parseRole(r));
    const isProtected = protectedRoles.some(pr => ctx.userRole >= pr);

    if (isProtected && !ctx.settings.moderate_admin) {
      return noAction;
    }

    // ── Priority 2: Check whitelist ──
    const whitelisted = await isWhitelisted(ctx.userId, ctx.groupId);
    if (whitelisted) return noAction;

    // ── Priority 3: Check blacklist ──
    const blacklisted = await isBlacklisted(ctx.userId, ctx.groupId);
    if (blacklisted) {
      await deleteMessage(ctx.groupJid, ctx.message.key!);
      await logMessageAction(ctx.groupId, ctx.userId, ctx.messageType, ctx.text, 'DELETE', 'User dalam blacklist');
      return { action: 'DELETE', reason: 'Blacklist', handled: true };
    }

    // ── Dry run mode check ──
    const dryRun = ctx.settings.dry_run;

    // ── Priority 5: Anti-spam ──
    if (ctx.settings.spam.enabled) {
      const spamResult = await checkSpam(ctx.senderJid, ctx.groupJid, ctx.settings);
      if (spamResult.isSpam) {
        const violation = await recordViolation(
          ctx.userId, ctx.groupId, 'SPAM', 'MEDIUM', ctx.text, ctx.settings
        );

        if (!dryRun) {
          if (spamResult.action === 'MUTE' && spamResult.muteDuration) {
            await handleMute(ctx, spamResult.muteDuration, 'Spam terdeteksi');
          } else {
            await handleWarning(ctx, 'Spam terdeteksi');
          }
        }

        logger.info({ userId: ctx.userId, groupId: ctx.groupId, messageCount: spamResult.messageCount, dryRun }, 'Spam detected');
        return { action: spamResult.action === 'MUTE' ? 'MUTE' : 'WARN', reason: 'Spam', handled: true };
      }
    }

    // Remaining checks only apply to messages with text
    if (!ctx.text) return noAction;

    // ── Priority 6: Anti-flood ──
    if (ctx.settings.flood.enabled) {
      const floodResult = detectFlood(ctx.text, ctx.senderJid, ctx.groupJid, ctx.mentions.length, ctx.settings);
      if (floodResult.isFlood) {
        await recordViolation(ctx.userId, ctx.groupId, 'FLOOD', 'MEDIUM', ctx.text, ctx.settings);

        if (!dryRun) {
          await deleteMessage(ctx.groupJid, ctx.message.key!);
          await handleWarning(ctx, `Flood: ${floodResult.details}`);
        }

        logger.info({ userId: ctx.userId, groupId: ctx.groupId, floodType: floodResult.type, dryRun }, 'Flood detected');
        return { action: 'WARN', reason: `Flood: ${floodResult.type}`, handled: true };
      }

      // Check mention spam separately
      const mentionResult = checkMentionSpam(ctx.mentions.length, ctx.settings);
      if (mentionResult.isSpam) {
        await recordViolation(ctx.userId, ctx.groupId, 'MENTION', 'MEDIUM', ctx.text, ctx.settings);

        if (!dryRun) {
          if (mentionResult.action === 'DELETE' || mentionResult.action === 'MUTE') {
            await deleteMessage(ctx.groupJid, ctx.message.key!);
          }
          if (mentionResult.action === 'MUTE') {
            await handleMute(ctx, '30m', 'Mention spam');
          } else {
            await handleWarning(ctx, `Mention spam: ${mentionResult.details}`);
          }
        }

        return { action: mentionResult.action === 'MUTE' ? 'MUTE' : 'WARN', reason: 'Mention spam', handled: true };
      }
    }

    // ── Priority 7: Anti-link ──
    if (ctx.settings.links.enabled || ctx.settings.invite.enabled) {
      const linkResult = await detectLinks(ctx.text, ctx.groupId, ctx.settings);

      // Check invite links first
      if (linkResult.hasInvite && ctx.settings.invite.enabled) {
        await recordViolation(ctx.userId, ctx.groupId, 'INVITE', 'HIGH', ctx.text, ctx.settings);

        if (!dryRun) {
          await deleteMessage(ctx.groupJid, ctx.message.key!);
          await handleWarning(
            ctx,
            'Link undangan grup WhatsApp tidak diizinkan',
            linkResult.inviteType || 'Link Undangan Group'
          );
        }

        return { action: 'WARN', reason: `Invite link: ${linkResult.inviteType}`, handled: true };
      }

      // Check regular links: blocked domains are always removed, other links depend on mode
      const mode = ctx.settings.links.mode;
      const violates = ctx.settings.links.enabled && linkResult.hasLink &&
        (linkResult.isBlocked || (mode !== 'OFF' && !linkResult.isWhitelisted));

      if (violates) {
        await recordViolation(ctx.userId, ctx.groupId, 'LINK', 'LOW', ctx.text, ctx.settings);

        if (!dryRun) {
          await deleteMessage(ctx.groupJid, ctx.message.key!);
          if (mode === 'MUTE') {
            await handleMute(ctx, '30m', 'Mengirim link yang tidak diizinkan');
          } else {
            const matchedUrl = linkResult.urls.join(', ') || 'Link Terlarang';
            await handleWarning(ctx, 'Link tidak diizinkan di grup ini', matchedUrl);
          }
        }

        return { action: mode === 'MUTE' ? 'MUTE' : 'WARN', reason: 'Link', handled: true };
      }
    }

    // ── Priority 8: Profanity ──
    if (ctx.settings.profanity.enabled) {
      const profanityResult = await detectProfanity(ctx.text, ctx.groupId, ctx.settings.profanity.allowed_words);
      if (profanityResult.detected && profanityResult.matchedWord) {
        await recordProfanityViolation(
          ctx.userId, ctx.groupId,
          profanityResult.severity || 'MEDIUM',
          ctx.text,
          ctx.settings
        );

        if (!dryRun) {
          await deleteMessage(ctx.groupJid, ctx.message.key!);
          const word = profanityResult.matchedWord;
          await handleWarning(
            ctx,
            `Kata kasar / terlarang (${profanityResult.severity || 'MEDIUM'})`,
            word
          );
        }

        logger.info({
          userId: ctx.userId, groupId: ctx.groupId,
          matchedWord: profanityResult.matchedWord,
          severity: profanityResult.severity,
          dryRun,
        }, 'Profanity detected');

        return { action: 'WARN', reason: `Profanity: ${profanityResult.matchedWord}`, handled: true };
      }
    }

    // No violation found
    return noAction;

  } catch (error) {
    logger.error({ error, userId: ctx.userId, groupId: ctx.groupId }, 'Moderation pipeline error');
    return noAction; // Don't punish on errors
  }
}

/**
 * Handle warning action.
 */
async function handleWarning(
  ctx: ModerationContext,
  reason: string,
  matchedContent?: string
): Promise<void> {
  const result = await issueWarning(
    ctx.userId, ctx.groupId, reason, 'MEDIUM', null, ctx.settings
  );

  const mention = jidToMention(ctx.senderJid);
  const warningMsg = WARNING_MESSAGES.issued(
    result.activeCount,
    ctx.settings.warning.limit,
    reason,
    matchedContent
  );
  await sendMessage(
    ctx.groupJid,
    renderTemplate(warningMsg, { user: mention }),
    [ctx.senderJid]
  );

  await logMessageAction(ctx.groupId, ctx.userId, ctx.messageType, ctx.text, 'WARN', reason);

  // Check if warning limit reached → auto mute
  if (result.activeCount >= ctx.settings.warning.limit) {
    const muteTiers = ctx.settings.mute_tiers;
    const duration = muteTiers[String(result.activeCount)] || muteTiers[String(ctx.settings.warning.limit)] || '30m';
    await handleMute(ctx, duration, `Mencapai batas warning (${result.activeCount}/${ctx.settings.warning.limit})`);
  }
}

/**
 * Handle mute action.
 */
async function handleMute(ctx: ModerationContext, duration: string, reason: string): Promise<void> {
  const mute = await muteUser(ctx.userId, ctx.groupId, duration, reason);

  if (mute) {
    const mention = jidToMention(ctx.senderJid);
    const durationDisplay = formatDuration(
      new Date(mute.mute_until).getTime() - Date.now()
    );

    await sendMessage(
      ctx.groupJid,
      renderTemplate(MUTE_MESSAGES.muted, {
        user: mention,
        duration: durationDisplay,
        reason,
      }),
      [ctx.senderJid]
    );

    await logMessageAction(ctx.groupId, ctx.userId, ctx.messageType, ctx.text, 'MUTE', reason);
  }
}

/**
 * Handle kick action.
 */
async function handleKick(ctx: ModerationContext, reason: string): Promise<void> {
  const { removeParticipant } = await import('../client.js');
  const success = await removeParticipant(ctx.groupJid, ctx.senderJid);

  if (success) {
    const mention = jidToMention(ctx.senderJid);
    await sendMessage(
      ctx.groupJid,
      renderTemplate(COMMAND_MESSAGES.kicked, { user: mention, reason }),
      [ctx.senderJid]
    );
    await logMessageAction(ctx.groupId, ctx.userId, ctx.messageType, ctx.text, 'KICK', reason);
  } else {
    logger.warn({ userId: ctx.userId, groupId: ctx.groupId }, 'Failed to kick user (bot may not be admin)');
  }
}
