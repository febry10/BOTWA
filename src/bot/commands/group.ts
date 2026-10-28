/**
 * Group Commands — !setwelcome, !setgoodbye, !setrules, !welcome, !goodbye
 */
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { sendMessage } from '../client.js';
import { WELCOME_MESSAGES } from '../../messages/welcome.js';
import { GOODBYE_MESSAGES } from '../../messages/goodbye.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { updateGroupSetting } from '../../services/group.service.js';
import { logAdminAction } from '../../services/logging.service.js';

export function registerGroupCommands(): void {
  registerCommand({
    name: 'setwelcome',
    aliases: [],
    description: 'Atur pesan selamat datang',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const text = ctx.args.join(' ');
      if (!text) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !setwelcome Selamat datang {user} di {group}!');
        return;
      }
      await updateGroupSetting(ctx.groupId, 'welcome.message', text);
      await sendMessage(ctx.groupJid, WELCOME_MESSAGES.set);
      await logAdminAction(ctx.groupId, ctx.userId, null, 'setwelcome', { message: text }, 'success');
    },
  });

  registerCommand({
    name: 'setgoodbye',
    aliases: [],
    description: 'Atur pesan perpisahan',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const text = ctx.args.join(' ');
      if (!text) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !setgoodbye {user} telah keluar dari grup.');
        return;
      }
      await updateGroupSetting(ctx.groupId, 'goodbye.message', text);
      await sendMessage(ctx.groupJid, GOODBYE_MESSAGES.set);
      await logAdminAction(ctx.groupId, ctx.userId, null, 'setgoodbye', { message: text }, 'success');
    },
  });

  registerCommand({
    name: 'setrules',
    aliases: ['setaturan'],
    description: 'Atur peraturan grup',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const text = ctx.args.join(' ');
      if (!text) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !setrules 1. No spam 2. No toxic');
        return;
      }
      await updateGroupSetting(ctx.groupId, 'rules', text);
      await sendMessage(ctx.groupJid, COMMAND_MESSAGES.rulesSet);
      await logAdminAction(ctx.groupId, ctx.userId, null, 'setrules', {}, 'success');
    },
  });

  registerCommand({
    name: 'welcome',
    aliases: [],
    description: 'Toggle welcome on/off',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const value = ctx.args[0]?.toLowerCase();
      if (value !== 'on' && value !== 'off') {
        await sendMessage(ctx.groupJid, '❌ Contoh: !welcome on / !welcome off');
        return;
      }
      const enabled = value === 'on';
      await updateGroupSetting(ctx.groupId, 'welcome.enabled', enabled);
      await sendMessage(ctx.groupJid, enabled ? WELCOME_MESSAGES.toggleOn : WELCOME_MESSAGES.toggleOff);
      await logAdminAction(ctx.groupId, ctx.userId, null, 'welcome', { enabled }, 'success');
    },
  });

  registerCommand({
    name: 'goodbye',
    aliases: [],
    description: 'Toggle goodbye on/off',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const value = ctx.args[0]?.toLowerCase();
      if (value !== 'on' && value !== 'off') {
        await sendMessage(ctx.groupJid, '❌ Contoh: !goodbye on / !goodbye off');
        return;
      }
      const enabled = value === 'on';
      await updateGroupSetting(ctx.groupId, 'goodbye.enabled', enabled);
      await sendMessage(ctx.groupJid, enabled ? GOODBYE_MESSAGES.toggleOn : GOODBYE_MESSAGES.toggleOff);
      await logAdminAction(ctx.groupId, ctx.userId, null, 'goodbye', { enabled }, 'success');
    },
  });
}
