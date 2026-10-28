/**
 * Moderation Commands — !warn, !mute, !unmute, !kick, !ban, !unban, !tempban
 */
import { registerCommand, CommandContext, getTargetJid } from './index.js';
import { Role } from '../../config/permissions.js';
import { sendMessage, deleteMessage, removeParticipant, isBotAdmin } from '../client.js';
import { renderTemplate } from '../../messages/index.js';
import { WARNING_MESSAGES } from '../../messages/warning.js';
import { MUTE_MESSAGES } from '../../messages/mute.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { ERROR_MESSAGES } from '../../messages/errors.js';
import { jidToMention } from '../../utils/jid.js';
import { formatDuration, parseDuration } from '../../utils/duration.js';

import { issueWarning, getActiveWarningCount, resetWarnings } from '../../services/warning.service.js';
import { muteUser, unmuteUser, getMuteInfo } from '../../services/mute.service.js';
import { ensureUser, ensureMembership, getUserIdByWaId, getUserRole, removeMember } from '../../services/member.service.js';
import { blacklistUser, unblacklistUser } from '../../services/blacklist.service.js';
import { resolveRole } from '../roles.js';
import { logAdminAction } from '../../services/logging.service.js';

export function registerModerationCommands(): void {
  // ── !warn / !warning ──
  registerCommand({
    name: 'warn',
    aliases: ['warning'],
    description: 'Berikan warning ke user',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      await ensureMembership(targetUserId, ctx.groupId);

      // Check if target is protected
      const targetRole = await resolveRole(ctx.groupJid, targetJid, targetUserId, ctx.groupId);
      if (targetRole >= ctx.userRole) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.cannotModerate);
        return;
      }

      const reason = ctx.args.slice(1).join(' ') || 'Pelanggaran';
      const result = await issueWarning(targetUserId, ctx.groupId, reason, 'MEDIUM', ctx.senderJid, ctx.settings);

      const mention = jidToMention(targetJid);
      const warningMsg = WARNING_MESSAGES.issued(result.activeCount, ctx.settings.warning.limit, reason);
      await sendMessage(ctx.groupJid, renderTemplate(warningMsg, { user: mention }), [targetJid]);

      // Auto-mute if limit reached
      if (result.activeCount >= ctx.settings.warning.limit) {
        const muteTiers = ctx.settings.mute_tiers;
        const duration = muteTiers[String(result.activeCount)] || '30m';
        const mute = await muteUser(targetUserId, ctx.groupId, duration, 'Batas warning tercapai', ctx.senderJid);
        if (mute) {
          const durationDisplay = formatDuration(new Date(mute.mute_until).getTime() - Date.now());
          await sendMessage(ctx.groupJid,
            renderTemplate(MUTE_MESSAGES.escalationMute, { user: mention, duration: durationDisplay, count: String(result.activeCount) }),
            [targetJid]
          );
        }
      }

      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'warn', { reason }, 'success');
    },
  });

  // ── !warnings ──
  registerCommand({
    name: 'warnings',
    aliases: ['warninglist'],
    description: 'Lihat warning user',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      const { getActiveWarnings } = await import('../../services/warning.service.js');
      const warnings = await getActiveWarnings(targetUserId, ctx.groupId);
      const mention = jidToMention(targetJid);
      const msg = WARNING_MESSAGES.list(warnings);
      await sendMessage(ctx.groupJid, renderTemplate(msg, { user: mention }), [targetJid]);
    },
  });

  // ── !resetwarning ──
  registerCommand({
    name: 'resetwarning',
    aliases: ['resetwarn', 'clearwarn'],
    description: 'Reset warning user',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      await resetWarnings(targetUserId, ctx.groupId);

      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(WARNING_MESSAGES.reset, { user: mention }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'resetwarning', {}, 'success');
    },
  });

  // ── !mute ──
  registerCommand({
    name: 'mute',
    aliases: [],
    description: 'Mute user',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      await ensureMembership(targetUserId, ctx.groupId);

      const targetRole = await resolveRole(ctx.groupJid, targetJid, targetUserId, ctx.groupId);
      if (targetRole >= ctx.userRole) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.cannotModerate);
        return;
      }

      const durationStr = ctx.args.find(a => parseDuration(a) !== null) || '30m';
      const reason = ctx.args.filter(a => parseDuration(a) === null && !a.startsWith('@')).join(' ') || 'Manual mute oleh admin';

      const mute = await muteUser(targetUserId, ctx.groupId, durationStr, reason, ctx.senderJid);
      if (!mute) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.invalidDuration);
        return;
      }

      const mention = jidToMention(targetJid);
      const durationDisplay = formatDuration(new Date(mute.mute_until).getTime() - Date.now());
      await sendMessage(ctx.groupJid,
        renderTemplate(MUTE_MESSAGES.muted, { user: mention, duration: durationDisplay, reason }),
        [targetJid]
      );
      if (!(await isBotAdmin(ctx.groupJid))) {
        await sendMessage(ctx.groupJid, '⚠️ Bot belum menjadi admin grup, jadi pesan member yang di-mute tidak bisa dihapus. Jadikan bot admin agar mute berfungsi.');
      }
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'mute', { duration: durationStr, reason }, 'success');
    },
  });

  // ── !unmute ──
  registerCommand({
    name: 'unmute',
    aliases: [],
    description: 'Unmute user',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      const success = await unmuteUser(targetUserId, ctx.groupId);

      const mention = jidToMention(targetJid);
      if (success) {
        await sendMessage(ctx.groupJid, renderTemplate(MUTE_MESSAGES.unmuted, { user: mention }), [targetJid]);
      } else {
        await sendMessage(ctx.groupJid, renderTemplate(MUTE_MESSAGES.notMuted, { user: mention }), [targetJid]);
      }
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'unmute', {}, success ? 'success' : 'not_muted');
    },
  });

  // ── !mutestatus ──
  registerCommand({
    name: 'mutestatus',
    aliases: ['ms'],
    description: 'Cek status mute user',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      const muteInfo = await getMuteInfo(targetUserId, ctx.groupId);
      const mention = jidToMention(targetJid);
      const msg = MUTE_MESSAGES.status(!!muteInfo, muteInfo?.mute_until ? new Date(muteInfo.mute_until) : undefined);
      await sendMessage(ctx.groupJid, renderTemplate(msg, { user: mention }), [targetJid]);
    },
  });

  // ── !kick ──
  registerCommand({
    name: 'kick',
    aliases: [],
    description: 'Kick user dari grup',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      const targetRole = await resolveRole(ctx.groupJid, targetJid, targetUserId, ctx.groupId);
      if (targetRole >= ctx.userRole) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.cannotModerate);
        return;
      }

      const reason = ctx.args.filter(a => !a.startsWith('@')).join(' ') || 'Kick oleh admin';
      const success = await removeParticipant(ctx.groupJid, targetJid);

      const mention = jidToMention(targetJid);
      if (success) {
        await removeMember(targetUserId, ctx.groupId);
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.kicked, { user: mention, reason }), [targetJid]);
      } else {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.botNotAdmin);
      }
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'kick', { reason }, success ? 'success' : 'failed');
    },
  });

  // ── !ban ──
  registerCommand({
    name: 'ban',
    aliases: [],
    description: 'Ban user (permanent)',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      const targetRole = await resolveRole(ctx.groupJid, targetJid, targetUserId, ctx.groupId);
      if (targetRole >= ctx.userRole) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.cannotModerate);
        return;
      }

      const reason = ctx.args.filter(a => !a.startsWith('@')).join(' ') || 'Banned oleh admin';
      await blacklistUser(targetUserId, ctx.groupId, reason, ctx.senderJid);
      const kicked = await removeParticipant(ctx.groupJid, targetJid);

      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.banned, { user: mention, reason }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'ban', { reason }, 'success');
    },
  });

  // ── !unban ──
  registerCommand({
    name: 'unban',
    aliases: [],
    description: 'Unban user',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const targetUserId = await ensureUser(targetJid);
      const success = await unblacklistUser(targetUserId, ctx.groupId);

      const mention = jidToMention(targetJid);
      if (success) {
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.unbanned, { user: mention }), [targetJid]);
      } else {
        await sendMessage(ctx.groupJid, '❌ User tidak ada dalam daftar banned.');
      }
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'unban', {}, success ? 'success' : 'not_found');
    },
  });

  // ── !tempban ──
  registerCommand({
    name: 'tempban',
    aliases: ['tb'],
    description: 'Ban sementara',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }

      const durationStr = ctx.args.find(a => parseDuration(a) !== null);
      if (!durationStr) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.invalidDuration);
        return;
      }

      const durationMs = parseDuration(durationStr)!;
      const banUntil = new Date(Date.now() + durationMs);

      const targetUserId = await ensureUser(targetJid);
      const targetRole = await resolveRole(ctx.groupJid, targetJid, targetUserId, ctx.groupId);
      if (targetRole >= ctx.userRole) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.cannotModerate);
        return;
      }

      const reason = ctx.args.filter(a => !a.startsWith('@') && parseDuration(a) === null).join(' ') || 'Tempban oleh admin';
      await blacklistUser(targetUserId, ctx.groupId, reason, ctx.senderJid, banUntil);
      await removeParticipant(ctx.groupJid, targetJid);

      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid,
        renderTemplate(COMMAND_MESSAGES.tempBanned, { user: mention, duration: formatDuration(durationMs), reason }),
        [targetJid]
      );
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'tempban', { duration: durationStr, reason }, 'success');
    },
  });
}
