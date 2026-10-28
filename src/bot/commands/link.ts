/**
 * Link Commands — !allowlink, !blocklink, !listlink
 */
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { sendMessage } from '../client.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { renderTemplate } from '../../messages/index.js';
import { addAllowedDomain, addBlockedDomain, getAllowedDomains, getBlockedDomains } from '../../moderation/links/detector.js';
import { logAdminAction } from '../../services/logging.service.js';

export function registerLinkCommands(): void {
  registerCommand({
    name: 'allowlink',
    aliases: ['izinlink'],
    description: 'Izinkan domain',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      if (ctx.args.length === 0) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !allowlink youtube.com');
        return;
      }

      const domain = ctx.args[0].toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
      await addAllowedDomain(ctx.groupId, domain, ctx.senderJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.linkAllowed, { domain }));
      await logAdminAction(ctx.groupId, ctx.userId, null, 'allowlink', { domain }, 'success');
    },
  });

  registerCommand({
    name: 'blocklink',
    aliases: ['blokirlink'],
    description: 'Blokir domain',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      if (ctx.args.length === 0) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !blocklink spam.com');
        return;
      }

      const domain = ctx.args[0].toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '');
      await addBlockedDomain(ctx.groupId, domain, ctx.senderJid);
      await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.linkBlocked, { domain }));
      await logAdminAction(ctx.groupId, ctx.userId, null, 'blocklink', { domain }, 'success');
    },
  });

  registerCommand({
    name: 'listlink',
    aliases: ['daftarlink'],
    description: 'Daftar domain',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const allowed = await getAllowedDomains(ctx.groupId);
      const blocked = await getBlockedDomains(ctx.groupId);

      let msg = '🔗 *DAFTAR DOMAIN*\n━━━━━━━━━━━━━━━━━━━━\n\n';

      msg += '✅ *Diizinkan:*\n';
      if (allowed.length > 0) {
        msg += allowed.map(d => `  • ${d}`).join('\n') + '\n\n';
      } else {
        msg += '  (kosong)\n\n';
      }

      msg += '🚫 *Diblokir:*\n';
      if (blocked.length > 0) {
        msg += blocked.map(d => `  • ${d}`).join('\n') + '\n';
      } else {
        msg += '  (kosong)\n';
      }

      await sendMessage(ctx.groupJid, msg);
    },
  });
}
