/**
 * Statistics Service — Aggregation queries for group stats.
 */
import { getDb } from '../database/connection.js';

export interface GroupStats {
  members: number;
  warnings: number;
  muted: number;
  banned: number;
  deletedMessages: number;
  spamDetected: number;
  toxicMessages: number;
}

/**
 * Get comprehensive statistics for a group.
 */
export async function getGroupStats(groupId: number, periodDays: number = 30): Promise<GroupStats> {
  const db = getDb();
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const [members, warnings, muted, banned, deleted, spam, toxic] = await Promise.all([
    db('group_members').where({ group_id: groupId }).count('id as count').first(),
    db('warnings').where({ group_id: groupId, active: true }).count('id as count').first(),
    db('mutes').where({ group_id: groupId, active: true }).count('id as count').first(),
    db('banned_users').where({ group_id: groupId, active: true }).count('id as count').first(),
    db('message_logs').where({ group_id: groupId, action: 'DELETE' }).where('created_at', '>=', since).count('id as count').first(),
    db('violations').where({ group_id: groupId, type: 'SPAM' }).where('created_at', '>=', since).count('id as count').first(),
    db('violations').where({ group_id: groupId, type: 'PROFANITY' }).where('created_at', '>=', since).count('id as count').first(),
  ]);

  return {
    members: parseInt(String(members?.count || '0'), 10),
    warnings: parseInt(String(warnings?.count || '0'), 10),
    muted: parseInt(String(muted?.count || '0'), 10),
    banned: parseInt(String(banned?.count || '0'), 10),
    deletedMessages: parseInt(String(deleted?.count || '0'), 10),
    spamDetected: parseInt(String(spam?.count || '0'), 10),
    toxicMessages: parseInt(String(toxic?.count || '0'), 10),
  };
}

/**
 * Get total messages processed (across all groups).
 */
export async function getTotalMessagesProcessed(): Promise<number> {
  const db = getDb();
  const result = await db('message_logs').count('id as count').first();
  return parseInt(String(result?.count || '0'), 10);
}

/**
 * Get total messages deleted (across all groups).
 */
export async function getTotalMessagesDeleted(): Promise<number> {
  const db = getDb();
  const result = await db('message_logs').where({ action: 'DELETE' }).count('id as count').first();
  return parseInt(String(result?.count || '0'), 10);
}

/**
 * Get total monitored members (across all groups).
 */
export async function getTotalMembersMonitored(): Promise<number> {
  const db = getDb();
  const result = await db('group_members').countDistinct('user_id as count').first();
  return parseInt(String(result?.count || '0'), 10);
}
