/**
 * Whitelist Service — Manage user whitelists per group.
 */
import { getDb } from '../database/connection.js';
import pino from 'pino';

const logger = pino({ name: 'whitelist-service' });

/**
 * Add a user to the whitelist for a group.
 */
export async function addToWhitelist(
  userId: number,
  groupId: number,
  addedBy: string | null = null
): Promise<boolean> {
  const db = getDb();

  try {
    await db('whitelist')
      .insert({ user_id: userId, group_id: groupId, added_by: addedBy })
      .onConflict(['user_id', 'group_id'])
      .ignore();

    logger.info({ userId, groupId }, 'User whitelisted');
    return true;
  } catch (error) {
    logger.error({ error, userId, groupId }, 'Failed to whitelist user');
    return false;
  }
}

/**
 * Remove a user from the whitelist.
 */
export async function removeFromWhitelist(userId: number, groupId: number): Promise<boolean> {
  const db = getDb();
  const deleted = await db('whitelist')
    .where({ user_id: userId, group_id: groupId })
    .del();

  return deleted > 0;
}

/**
 * Get all whitelisted users for a group.
 */
export async function getWhitelistedUsers(groupId: number): Promise<any[]> {
  const db = getDb();
  return db('whitelist')
    .join('users', 'users.id', '=', 'whitelist.user_id')
    .where({ 'whitelist.group_id': groupId })
    .select('whitelist.*', 'users.wa_id', 'users.name');
}

/**
 * Check if a user is whitelisted.
 */
export async function isUserWhitelisted(userId: number, groupId: number): Promise<boolean> {
  const db = getDb();
  const entry = await db('whitelist')
    .where({ user_id: userId, group_id: groupId })
    .first();
  return !!entry;
}
