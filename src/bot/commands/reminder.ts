/**
 * Reminder Commands — !addreminder, !reminders, !delreminder
 */
import { WAMessage } from '@whiskeysockets/baileys';
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { config } from '../../config/index.js';
import { parseReminder, formatReminderTime } from '../../reminders/parse.js';
import {
  addReminder, listReminders, deleteReminder, countReminders, MAX_REMINDERS_PER_GROUP,
} from '../../services/reminder.service.js';
import { logAdminAction } from '../../services/logging.service.js';

const USAGE = `📅 *Cara membuat pengingat*

!addreminder 30m | Rapat dimulai
!addreminder 19:30 | Main bareng
!addreminder besok 08:00 | Kumpul tugas
!addreminder 2026-12-31 23:00 | Tahun baru!
!addreminder harian 05:00 | Waktunya sholat subuh
!addreminder mingguan jumat 20:00 | Nobar

Satuan relatif: m/menit, j/jam, d/hari. Zona waktu: ${config.bot.timezone}.
Tambahkan *notag* di akhir pesan agar member tidak di-tag.`;

const REPEAT_LABEL = { NONE: 'Sekali', DAILY: 'Harian', WEEKLY: 'Mingguan' } as const;

async function reply(ctx: CommandContext, text: string): Promise<void> {
  await ctx.sock.sendMessage(ctx.groupJid, { text }, { quoted: ctx.message as WAMessage });
}

export function registerReminderCommands(): void {
  registerCommand({
    name: 'addreminder',
    aliases: ['pengingat', 'setreminder', 'ingatkan'],
    description: 'Tambah jadwal pengingat',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const input = ctx.args.join(' ').trim();
      if (!input) {
        await reply(ctx, USAGE);
        return;
      }

      if (await countReminders(ctx.groupId) >= MAX_REMINDERS_PER_GROUP) {
        await reply(ctx, `❌ Maksimal ${MAX_REMINDERS_PER_GROUP} pengingat aktif per grup. Hapus dulu dengan !delreminder.`);
        return;
      }

      let text = input;
      let tagAll = true;
      if (/\s+notag$/i.test(text)) {
        tagAll = false;
        text = text.replace(/\s+notag$/i, '');
      }

      const parsed = parseReminder(text, config.bot.timezone);
      if ('error' in parsed) {
        await reply(ctx, `❌ ${parsed.error}.\n\n${USAGE}`);
        return;
      }

      const reminder = await addReminder(ctx.groupId, parsed.message, parsed.remindAt, parsed.repeat, ctx.senderJid, tagAll);
      await reply(
        ctx,
        `✅ *Pengingat #${reminder.id} disimpan*\n\n🕒 ${formatReminderTime(parsed.remindAt, config.bot.timezone)}\n🔁 ${REPEAT_LABEL[parsed.repeat]}\n📝 ${parsed.message}`
      );
      await logAdminAction(ctx.groupId, ctx.userId, null, 'addreminder', { id: reminder.id, repeat: parsed.repeat }, 'success');
    },
  });

  registerCommand({
    name: 'reminders',
    aliases: ['listreminder', 'jadwal', 'pengingatlist'],
    description: 'Daftar pengingat grup',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const reminders = await listReminders(ctx.groupId);
      if (reminders.length === 0) {
        await reply(ctx, 'ℹ️ Belum ada pengingat. Admin bisa menambah dengan *!addreminder*.');
        return;
      }
      const lines = reminders.map(r =>
        `*#${r.id}* — ${formatReminderTime(new Date(r.remind_at), config.bot.timezone)} (${REPEAT_LABEL[r.repeat]})\n   ${r.message.length > 80 ? r.message.slice(0, 80) + '…' : r.message}`
      );
      await reply(ctx, `📅 *JADWAL PENGINGAT*\n━━━━━━━━━━━━━━━━━━━━\n\n${lines.join('\n\n')}`);
    },
  });

  registerCommand({
    name: 'delreminder',
    aliases: ['hapuspengingat', 'rmreminder'],
    description: 'Hapus pengingat',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const id = parseInt((ctx.args[0] || '').replace('#', ''), 10);
      if (!id) {
        await reply(ctx, '❌ Format: *!delreminder <nomor>* (lihat nomor di !reminders)');
        return;
      }
      const ok = await deleteReminder(ctx.groupId, id);
      await reply(ctx, ok ? `🗑️ Pengingat #${id} dihapus.` : `❌ Pengingat #${id} tidak ditemukan.`);
      if (ok) await logAdminAction(ctx.groupId, ctx.userId, null, 'delreminder', { id }, 'success');
    },
  });
}
