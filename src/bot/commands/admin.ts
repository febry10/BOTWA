/**
 * Admin Commands — !admins, !promote, !demote, !whitelist, !blacklist
 */
import { registerCommand, CommandContext } from './index.js';
import { Role, roleToString } from '../../config/permissions.js';
import { sendMessage, promoteParticipant, demoteParticipant } from '../client.js';
import { renderTemplate } from '../../messages/index.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { ERROR_MESSAGES } from '../../messages/errors.js';
import { jidToMention } from '../../utils/jid.js';
import { getGroupAdmins, ensureUser, ensureMembership, updateMemberRole, getUserRole } from '../../services/member.service.js';
import { addToWhitelist, removeFromWhitelist, getWhitelistedUsers } from '../../services/whitelist.service.js';
import { blacklistUser, unblacklistUser, getBlacklistedUsers } from '../../services/blacklist.service.js';
import { logAdminAction } from '../../services/logging.service.js';

export function registerAdminCommands(): void {
  registerCommand({
    name: 'admins',
    aliases: ['admin', 'adminlist'],
    description: 'Daftar admin grup',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const admins = await getGroupAdmins(ctx.groupId);
      if (admins.length === 0) {
        await sendMessage(ctx.groupJid, 'ℹ️ Tidak ada admin yang terdaftar.');
        return;
      }
      const list = admins.map(a => `  • ${a.name || a.wa_id} — ${a.role}`).join('\n');
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.adminList, { list }));
    },
  });

  registerCommand({
    name: 'promote',
    aliases: [],
    description: 'Promosikan user jadi admin',
    minRole: Role.OWNER,
    handler: async (ctx: CommandContext) => {
      const targetJid = ctx.mentionedJids[0];
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }
      const targetUserId = await ensureUser(targetJid);
      await ensureMembership(targetUserId, ctx.groupId);
      await updateMemberRole(targetUserId, ctx.groupId, 'ADMIN');
      await promoteParticipant(ctx.groupJid, targetJid);
      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.promoted, { user: mention }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'promote', {}, 'success');
    },
  });

  registerCommand({
    name: 'demote',
    aliases: [],
    description: 'Turunkan admin jadi member',
    minRole: Role.OWNER,
    handler: async (ctx: CommandContext) => {
      const targetJid = ctx.mentionedJids[0];
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }
      const targetUserId = await ensureUser(targetJid);
      await updateMemberRole(targetUserId, ctx.groupId, 'MEMBER');
      await demoteParticipant(ctx.groupJid, targetJid);
      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.demoted, { user: mention }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'demote', {}, 'success');
    },
  });

  registerCommand({
    name: 'whitelist',
    aliases: ['wl'],
    description: 'Whitelist user',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = ctx.mentionedJids[0];
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }
      const targetUserId = await ensureUser(targetJid);
      await addToWhitelist(targetUserId, ctx.groupId, ctx.senderJid);
      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.whitelisted, { user: mention }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'whitelist', {}, 'success');
    },
  });

  registerCommand({
    name: 'unwhitelist',
    aliases: ['unwl'],
    description: 'Hapus whitelist user',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = ctx.mentionedJids[0];
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }
      const targetUserId = await ensureUser(targetJid);
      await removeFromWhitelist(targetUserId, ctx.groupId);
      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.unwhitelisted, { user: mention }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'unwhitelist', {}, 'success');
    },
  });

  registerCommand({
    name: 'whitelistlist',
    aliases: ['wllist'],
    description: 'Daftar user whitelist',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const users = await getWhitelistedUsers(ctx.groupId);
      if (users.length === 0) {
        await sendMessage(ctx.groupJid, 'ℹ️ Tidak ada user dalam whitelist.');
        return;
      }
      let msg = '✅ *WHITELIST*\n━━━━━━━━━━━━━━━━━━━━\n';
      msg += users.map(u => `  • ${u.name || u.wa_id}`).join('\n');
      msg += `\n\nTotal: ${users.length}`;
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'blacklist',
    aliases: ['bl'],
    description: 'Blacklist user',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = ctx.mentionedJids[0];
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }
      const targetUserId = await ensureUser(targetJid);
      const targetRole = await getUserRole(targetUserId, ctx.groupId);
      if (targetRole >= ctx.userRole) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.cannotModerate);
        return;
      }
      const reason = ctx.args.filter(a => !a.startsWith('@')).join(' ') || 'Blacklisted oleh admin';
      await blacklistUser(targetUserId, ctx.groupId, reason, ctx.senderJid);
      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.blacklisted, { user: mention, reason }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'blacklist', { reason }, 'success');
    },
  });

  registerCommand({
    name: 'unblacklist',
    aliases: ['unbl'],
    description: 'Hapus blacklist user',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const targetJid = ctx.mentionedJids[0];
      if (!targetJid) {
        await sendMessage(ctx.groupJid, ERROR_MESSAGES.noMention);
        return;
      }
      const targetUserId = await ensureUser(targetJid);
      await unblacklistUser(targetUserId, ctx.groupId);
      const mention = jidToMention(targetJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.unblacklisted, { user: mention }), [targetJid]);
      await logAdminAction(ctx.groupId, ctx.userId, targetUserId, 'unblacklist', {}, 'success');
    },
  });

  registerCommand({
    name: 'blacklistlist',
    aliases: ['bllist'],
    description: 'Daftar user blacklist',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const users = await getBlacklistedUsers(ctx.groupId);
      if (users.length === 0) {
        await sendMessage(ctx.groupJid, 'ℹ️ Tidak ada user dalam blacklist.');
        return;
      }
      let msg = '🚫 *BLACKLIST*\n━━━━━━━━━━━━━━━━━━━━\n';
      msg += users.map((u: any) => `  • ${u.name || u.wa_id} — ${u.reason || 'Tanpa alasan'}`).join('\n');
      msg += `\n\nTotal: ${users.length}`;
      await sendMessage(ctx.groupJid, msg);
    },
  });
}
