/**
 * Reminder runner — sends due reminders to their groups.
 */
import pino from 'pino';
import { getDueReminders, completeReminder } from '../services/reminder.service.js';
import { getGroupMetadata, sendMessage } from './client.js';

const logger = pino({ name: 'reminders' });
let running = false;

export async function processDueReminders(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const due = await getDueReminders();
    for (const reminder of due) {
      try {
        const mentions = reminder.tag_all
          ? (await getGroupMetadata(reminder.wa_group_id))?.participants.map(p => p.id) ?? []
          : [];
        const label = reminder.repeat === 'DAILY' ? ' (harian)' : reminder.repeat === 'WEEKLY' ? ' (mingguan)' : '';
        const sent = await sendMessage(reminder.wa_group_id, `⏰ *PENGINGAT${label}*\n━━━━━━━━━━━━━━━━━━━━\n\n${reminder.message}`, mentions);
        if (!sent) continue;
        await completeReminder(reminder);
      } catch (error) {
        logger.error({ err: error, reminderId: reminder.id }, 'Failed to send reminder');
      }
    }
  } finally {
    running = false;
  }
}
