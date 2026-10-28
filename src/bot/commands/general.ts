/**
 * General Commands — !help, !menu, !rules, !ping, !info, !stats, !status
 */
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { sendMessage, getUptime } from '../client.js';
import { renderTemplate } from '../../messages/index.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { formatUptime } from '../../utils/format.js';
import { getGroupStats } from '../../services/stats.service.js';
import { getGroupCount } from '../../services/group.service.js';
import * as statsService from '../../services/stats.service.js';

export function registerGeneralCommands(): void {
  registerCommand({
    name: 'help',
    aliases: ['h', 'bantuan'],
    description: 'Tampilkan daftar command',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const msg = renderTemplate(COMMAND_MESSAGES.help, { prefix: ctx.settings.prefix || '!' });
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'menu',
    aliases: ['m'],
    description: 'Tampilkan menu bot',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const msg = renderTemplate(COMMAND_MESSAGES.menu, {
        botName: 'GroupGuard',
        prefix: ctx.settings.prefix || '!',
      });
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'rules',
    aliases: ['peraturan', 'aturan'],
    description: 'Tampilkan peraturan grup',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      await sendMessage(ctx.groupJid, ctx.settings.rules);
    },
  });

  registerCommand({
    name: 'ping',
    aliases: [],
    description: 'Cek apakah bot aktif',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const start = Date.now();
      const msg = renderTemplate(COMMAND_MESSAGES.ping, {
        latency: String(Date.now() - start + 1),
      });
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'info',
    aliases: ['about'],
    description: 'Informasi bot',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const groups = await getGroupCount();
      const msg = renderTemplate(COMMAND_MESSAGES.info, {
        botName: 'GroupGuard',
        prefix: ctx.settings.prefix || '!',
        groups: String(groups),
        uptime: formatUptime(getUptime()),
      });
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'stats',
    aliases: ['statistik'],
    description: 'Statistik grup',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const stats = await getGroupStats(ctx.groupId);
      const msg = renderTemplate(COMMAND_MESSAGES.stats, {
        members: String(stats.members),
        warnings: String(stats.warnings),
        muted: String(stats.muted),
        banned: String(stats.banned),
        deleted: String(stats.deletedMessages),
        spam: String(stats.spamDetected),
        toxic: String(stats.toxicMessages),
        period: '30 hari terakhir',
      });
      await sendMessage(ctx.groupJid, msg);
    },
  });

  registerCommand({
    name: 'status',
    aliases: ['botstatus'],
    description: 'Status bot',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const groups = await getGroupCount();
      const totalMembers = await statsService.getTotalMembersMonitored();
      const totalProcessed = await statsService.getTotalMessagesProcessed();
      const totalDeleted = await statsService.getTotalMessagesDeleted();

      const msg = renderTemplate(COMMAND_MESSAGES.botStatus, {
        status: '🟢 ONLINE',
        uptime: formatUptime(getUptime()),
        groups: String(groups),
        members: String(totalMembers),
        processed: String(totalProcessed),
        deleted: String(totalDeleted),
      });
      await sendMessage(ctx.groupJid, msg);
    },
  });
}
