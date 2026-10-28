/**
 * Filter Commands — !addword, !delword, !listword
 */
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { sendMessage } from '../client.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { ERROR_MESSAGES } from '../../messages/errors.js';
import { renderTemplate } from '../../messages/index.js';
import { addBlacklistWord, removeBlacklistWord, getBlacklistWords } from '../../moderation/profanity/word-list.js';
import { logAdminAction } from '../../services/logging.service.js';
import { updateGroupSetting } from '../../services/group.service.js';

export function registerFilterCommands(): void {
  registerCommand({
    name: 'addword',
    aliases: ['tambahkata'],
    description: 'Tambah kata terlarang',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      if (ctx.args.length === 0) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !addword kata [LIGHT|MEDIUM|HEAVY]');
        return;
      }

      const word = ctx.args[0].toLowerCase();
      const severityArg = ctx.args[1]?.toUpperCase();
      const severity = ['LIGHT', 'MEDIUM', 'HEAVY'].includes(severityArg || '')
        ? severityArg as 'LIGHT' | 'MEDIUM' | 'HEAVY'
        : 'MEDIUM';

      const allowedWords = ctx.settings.profanity.allowed_words ?? [];
      if (allowedWords.includes(word)) {
        await updateGroupSetting(ctx.groupId, 'profanity.allowed_words', allowedWords.filter(w => w !== word));
        await sendMessage(ctx.groupJid, `✅ Kata default "${word}" diaktifkan lagi untuk grup ini.`);
        return;
      }

      const success = await addBlacklistWord(word, severity, ctx.groupId, ctx.senderJid);
      if (success) {
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.wordAdded, { word, severity }));
      } else {
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.wordExists, { word }));
      }
      await logAdminAction(ctx.groupId, ctx.userId, null, 'addword', { word, severity }, success ? 'success' : 'exists');
    },
  });

  registerCommand({
    name: 'delword',
    aliases: ['hapuskata'],
    description: 'Hapus kata terlarang',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      if (ctx.args.length === 0) {
        await sendMessage(ctx.groupJid, '❌ Contoh: !delword kata');
        return;
      }

      const word = ctx.args[0].toLowerCase();
      let success = await removeBlacklistWord(word, ctx.groupId);
      if (!success) {
        // Default (global) words can't be deleted per group; exempt them for this group instead
        const allowedWords = ctx.settings.profanity.allowed_words ?? [];
        const globalWords = await getBlacklistWords(null);
        if (globalWords.some(w => w.word === word) && !allowedWords.includes(word)) {
          await updateGroupSetting(ctx.groupId, 'profanity.allowed_words', [...allowedWords, word]);
          success = true;
        }
      }
      if (success) {
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.wordDeleted, { word }));
      } else {
        await sendMessage(ctx.groupJid, renderTemplate(COMMAND_MESSAGES.wordNotFound, { word }));
      }
      await logAdminAction(ctx.groupId, ctx.userId, null, 'delword', { word }, success ? 'success' : 'not_found');
    },
  });

  registerCommand({
    name: 'listword',
    aliases: ['daftarkata'],
    description: 'Daftar kata terlarang',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const allowedWords = ctx.settings.profanity.allowed_words ?? [];
      const words = (await getBlacklistWords(ctx.groupId)).filter(w => !allowedWords.includes(w.word));

      if (words.length === 0) {
        await sendMessage(ctx.groupJid, 'ℹ️ Tidak ada kata terlarang yang terdaftar.');
        return;
      }

      const light = words.filter(w => w.severity === 'LIGHT');
      const medium = words.filter(w => w.severity === 'MEDIUM');
      const heavy = words.filter(w => w.severity === 'HEAVY');

      let msg = '📋 *DAFTAR KATA TERLARANG*\n━━━━━━━━━━━━━━━━━━━━\n\n';

      if (light.length > 0) {
        msg += '🟢 *Ringan:*\n' + light.map(w => w.word).join(', ') + '\n\n';
      }
      if (medium.length > 0) {
        msg += '🟡 *Sedang:*\n' + medium.map(w => w.word).join(', ') + '\n\n';
      }
      if (heavy.length > 0) {
        msg += '🔴 *Berat:*\n' + heavy.map(w => w.word).join(', ') + '\n\n';
      }

      msg += `Total: ${words.length} kata`;
      await sendMessage(ctx.groupJid, msg);
    },
  });
}
