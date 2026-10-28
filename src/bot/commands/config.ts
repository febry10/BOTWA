/**
 * Config Commands — !settings, !set
 */
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { sendMessage } from '../client.js';
import { renderTemplate } from '../../messages/index.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { updateGroupSetting } from '../../services/group.service.js';
import { logAdminAction } from '../../services/logging.service.js';

const TOGGLE_SETTINGS: Record<string, string> = {
  profanity: 'profanity.enabled',
  spam: 'spam.enabled',
  antispam: 'spam.enabled',
  flood: 'flood.enabled',
  antiflood: 'flood.enabled',
  link: 'links.enabled',
  antilink: 'links.enabled',
  invite: 'invite.enabled',
  welcome: 'welcome.enabled',
  goodbye: 'goodbye.enabled',
  automod: 'auto_moderation',
  dryrun: 'dry_run',
  autokick: 'escalation.enabled',
  moderateadmin: 'moderate_admin',
  autodelcmd: 'auto_delete_commands',
};

export function registerConfigCommands(): void {
  registerCommand({
    name: 'settings',
    aliases: ['pengaturan', 'config'],
    description: 'Tampilkan pengaturan grup',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const s = ctx.settings;
      const onOff = (v: boolean) => v ? '✅ ON' : '❌ OFF';
      const msg = renderTemplate(COMMAND_MESSAGES.settings, {
        autoMod: onOff(s.auto_moderation),
        profanity: onOff(s.profanity.enabled),
        antiSpam: onOff(s.spam.enabled),
        antiLink: onOff(s.links.enabled),
        antiFlood: onOff(s.flood.enabled),
        welcome: onOff(s.welcome.enabled),
        goodbye: onOff(s.goodbye.enabled),
        warningLimit: String(s.warning.limit),
        muteDuration: s.mute_tiers['3'] || '30m',
        autoKick: s.escalation.enabled ? `✅ ON (${s.escalation.kick_at} pelanggaran)` : '❌ OFF',
        dryRun: onOff(s.dry_run),
      });
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'set',
    aliases: ['atur'],
    description: 'Ubah pengaturan',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      if (ctx.args.length < 2) {
        let msg = '❌ Contoh: !set [setting] [value]\n\nPengaturan yang tersedia:\n';
        msg += Object.keys(TOGGLE_SETTINGS).map(k => `  • ${k}`).join('\n');
        msg += '\n\nContoh: !set profanity on';
        await sendMessage(ctx.groupJid, msg);
        return;
      }

      const setting = ctx.args[0].toLowerCase();
      const value = ctx.args[1].toLowerCase();

      const settingPath = TOGGLE_SETTINGS[setting];
      if (settingPath) {
        // Boolean toggle
        if (value !== 'on' && value !== 'off' && value !== 'true' && value !== 'false') {
          await sendMessage(ctx.groupJid, '❌ Gunakan: on / off');
          return;
        }
        const boolValue = value === 'on' || value === 'true';
        await updateGroupSetting(ctx.groupId, settingPath, boolValue);
        await sendMessage(ctx.groupJid,
          renderTemplate(COMMAND_MESSAGES.settingUpdated, { setting, value: boolValue ? 'ON' : 'OFF' })
        );
        await logAdminAction(ctx.groupId, ctx.userId, null, 'set', { setting, value: boolValue }, 'success');
        return;
      }

      // Numeric settings
      if (setting === 'warninglimit' || setting === 'warnlimit') {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 1 || num > 20) {
          await sendMessage(ctx.groupJid, '❌ Warning limit harus antara 1-20');
          return;
        }
        await updateGroupSetting(ctx.groupId, 'warning.limit', num);
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.settingUpdated, { setting: 'Warning Limit', value: String(num) }));
        await logAdminAction(ctx.groupId, ctx.userId, null, 'set', { setting: 'warning.limit', value: num }, 'success');
        return;
      }

      if (setting === 'kickat') {
        const num = parseInt(value, 10);
        if (isNaN(num) || num < 0 || num > 100) {
          await sendMessage(ctx.groupJid, '❌ Kick threshold harus antara 0-100 (0 = disabled)');
          return;
        }
        await updateGroupSetting(ctx.groupId, 'escalation.kick_at', num);
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.settingUpdated, { setting: 'Auto Kick', value: num === 0 ? 'OFF' : `${num} pelanggaran` }));
        return;
      }

      if (setting === 'linkmode') {
        const modes = ['OFF', 'DELETE', 'WARNING', 'MUTE'];
        const upper = value.toUpperCase();
        if (!modes.includes(upper)) {
          await sendMessage(ctx.groupJid, `❌ Mode yang tersedia: ${modes.join(', ')}`);
          return;
        }
        await updateGroupSetting(ctx.groupId, 'links.mode', upper);
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.settingUpdated, { setting: 'Link Mode', value: upper }));
        return;
      }

      if (setting === 'prefix') {
        if (value.length !== 1) {
          await sendMessage(ctx.groupJid, '❌ Prefix harus 1 karakter (contoh: ! / . #)');
          return;
        }
        await updateGroupSetting(ctx.groupId, 'prefix', value);
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.settingUpdated, { setting: 'Prefix', value }));
        return;
      }

      await sendMessage(ctx.groupJid, `❌ Pengaturan "${setting}" tidak dikenal. Ketik !set untuk daftar.`);
    },
  });
}
