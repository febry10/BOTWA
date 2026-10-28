/**
 * Blacklist Service — Manage user blacklists per group.
 */
import { getDb } from '../database/connection.js';
import pino from 'pino';

const logger = pino({ name: 'blacklist-service' });

/**
 * Blacklist a user in a group (ban).
 */
export async function blacklistUser(
  userId: number,
  groupId: number,
  reason: string | null = null,
  bannedBy: string | null = null,
  banUntil: Date | null = null
): Promise<void> {
  const db = getDb();
  const permanent = !banUntil;

  await db('banned_users')
    .insert({
      user_id: userId,
      group_id: groupId,
      banned_by: bannedBy,
      reason,
      ban_until: banUntil,
      permanent,
      active: true,
    })
    .onConflict(['user_id', 'group_id'])
    .ignore();

  logger.info({ userId, groupId, permanent, banUntil, reason }, 'User blacklisted');
}

/**
 * Remove a user from the blacklist.
 */
export async function unblacklistUser(userId: number, groupId: number): Promise<boolean> {
  const db = getDb();
  const updated = await db('banned_users')
    .where({ user_id: userId, group_id: groupId, active: true })
    .update({ active: false });

  return updated > 0;
}

/**
 * Get all blacklisted users for a group.
 */
export async function getBlacklistedUsers(groupId: number): Promise<any[]> {
  const db = getDb();
  return db('banned_users')
    .join('users', 'users.id', '=', 'banned_users.user_id')
    .where({ 'banned_users.group_id': groupId, 'banned_users.active': true })
    .select('banned_users.*', 'users.wa_id', 'users.name');
}

/**
 * Expire temporary bans that have passed their ban_until timestamp.
 */
export async function expireBans(): Promise<any[]> {
  const db = getDb();
  const expired = await db('banned_users')
    .where('active', true)
    .where('permanent', false)
    .whereNotNull('ban_until')
    .where('ban_until', '<=', new Date())
    .select('*');

  if (expired.length > 0) {
    await db('banned_users')
      .whereIn('id', expired.map((b: any) => b.id))
      .update({ active: false });

    logger.info({ count: expired.length }, 'Expired bans deactivated');
  }

  return expired;
}
