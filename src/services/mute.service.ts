/**
 * Mute Service — Soft mute system using database-tracked mute state.
 */
import { getDb } from '../database/connection.js';
import { parseDuration, formatDuration } from '../utils/duration.js';
import pino from 'pino';

const logger = pino({ name: 'mute-service' });

export interface Mute {
  id: number;
  user_id: number;
  group_id: number;
  muted_by: string | null;
  reason: string | null;
  mute_until: Date;
  active: boolean;
  created_at: Date;
  unmuted_at: Date | null;
}

/**
 * Mute a user for a specified duration.
 */
export async function muteUser(
  userId: number,
  groupId: number,
  durationStr: string,
  reason: string | null = null,
  mutedBy: string | null = null
): Promise<Mute | null> {
  const db = getDb();
  const durationMs = parseDuration(durationStr);

  if (!durationMs) {
    logger.error({ durationStr }, 'Invalid mute duration');
    return null;
  }

  const muteUntil = new Date(Date.now() + durationMs);

  // Deactivate any existing active mutes for this user in this group
  await db('mutes')
    .where({ user_id: userId, group_id: groupId, active: true })
    .update({ active: false, unmuted_at: new Date() });

  // Create new mute
  const [mute] = await db('mutes')
    .insert({
      user_id: userId,
      group_id: groupId,
      muted_by: mutedBy,
      reason,
      mute_until: muteUntil,
      active: true,
    })
    .returning('*');

  logger.info({
    userId, groupId, muteId: mute.id,
    duration: formatDuration(durationMs),
    muteUntil,
  }, 'User muted');

  return mute;
}

/**
 * Unmute a user manually.
 */
export async function unmuteUser(userId: number, groupId: number): Promise<boolean> {
  const db = getDb();
  const updated = await db('mutes')
    .where({ user_id: userId, group_id: groupId, active: true })
    .update({ active: false, unmuted_at: new Date() });

  if (updated > 0) {
    logger.info({ userId, groupId }, 'User unmuted');
    return true;
  }
  return false;
}

/**
 * Check if a user is currently muted in a group.
 * Also handles auto-unmute if mute has expired.
 */
export async function checkMuteStatus(
  userId: number,
  groupId: number
): Promise<{ muted: boolean; mute?: Mute; expired?: boolean }> {
  const db = getDb();
  const activeMute = await db('mutes')
    .where({ user_id: userId, group_id: groupId, active: true })
    .orderBy('created_at', 'desc')
    .first();

  if (!activeMute) {
    return { muted: false };
  }

  const now = new Date();
  const muteUntil = new Date(activeMute.mute_until);

  if (now >= muteUntil) {
    // Mute has expired — auto-unmute
    await db('mutes')
      .where({ id: activeMute.id })
      .update({ active: false, unmuted_at: now });

    logger.info({ userId, groupId, muteId: activeMute.id }, 'Mute expired, auto-unmuted');
    return { muted: false, mute: activeMute, expired: true };
  }

  return { muted: true, mute: activeMute };
}

/**
 * Get mute status display info.
 */
export async function getMuteInfo(userId: number, groupId: number): Promise<Mute | null> {
  const db = getDb();
  return db('mutes')
    .where({ user_id: userId, group_id: groupId, active: true })
    .orderBy('created_at', 'desc')
    .first() || null;
}

/**
 * Expire all mutes that have passed their mute_until timestamp.
 * Called periodically. Returns list of expired mutes for notification.
 */
export async function expireMutes(): Promise<Mute[]> {
  const db = getDb();
  const expired = await db('mutes')
    .where('active', true)
    .where('mute_until', '<=', new Date())
    .select('*');

  if (expired.length > 0) {
    await db('mutes')
      .whereIn('id', expired.map((m: Mute) => m.id))
      .update({ active: false, unmuted_at: new Date() });

    logger.info({ count: expired.length }, 'Expired mutes deactivated');
  }

  return expired;
}
