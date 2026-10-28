/**
 * Reminder Service — Admin-managed scheduled group reminders.
 */
import { getDb } from '../database/connection.js';
import { RepeatMode, nextOccurrence } from '../reminders/parse.js';

export interface Reminder {
  id: number;
  group_id: number;
  created_by: string | null;
  message: string;
  remind_at: Date;
  repeat: RepeatMode;
  tag_all: boolean;
  active: boolean;
}

export const MAX_REMINDERS_PER_GROUP = 25;

export async function addReminder(
  groupId: number,
  message: string,
  remindAt: Date,
  repeat: RepeatMode,
  createdBy: string,
  tagAll = true
): Promise<Reminder> {
  const [row] = await getDb()('reminders')
    .insert({ group_id: groupId, message, remind_at: remindAt, repeat, created_by: createdBy, tag_all: tagAll })
    .returning('*');
  return row;
}

export async function listReminders(groupId: number): Promise<Reminder[]> {
  return getDb()('reminders').where({ group_id: groupId, active: true }).orderBy('remind_at', 'asc');
}

export async function countReminders(groupId: number): Promise<number> {
  const res = await getDb()('reminders').where({ group_id: groupId, active: true }).count('id as count').first();
  return parseInt(String(res?.count ?? '0'), 10);
}

export async function deleteReminder(groupId: number, id: number): Promise<boolean> {
  const updated = await getDb()('reminders').where({ group_id: groupId, id, active: true }).update({ active: false });
  return updated > 0;
}

export async function getDueReminders(now = new Date()): Promise<Array<Reminder & { wa_group_id: string }>> {
  return getDb()('reminders')
    .join('groups', 'groups.id', '=', 'reminders.group_id')
    .where('reminders.active', true)
    .andWhere('reminders.remind_at', '<=', now)
    .select('reminders.*', 'groups.wa_group_id');
}

/**
 * After sending: reschedule repeating reminders, deactivate one-off ones.
 */
export async function completeReminder(reminder: Reminder, now = new Date()): Promise<void> {
  const next = nextOccurrence(new Date(reminder.remind_at), reminder.repeat, now);
  await getDb()('reminders')
    .where({ id: reminder.id })
    .update(next ? { remind_at: next } : { active: false });
}
