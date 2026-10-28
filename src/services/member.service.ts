/**
 * Member Service — User and group membership management.
 */
import { getDb } from '../database/connection.js';
import { Role, parseRole } from '../config/permissions.js';
import pino from 'pino';

const logger = pino({ name: 'member-service' });

export interface Member {
  id: number;
  user_id: number;
  group_id: number;
  role: string;
  joined_at: Date;
}

/**
 * Ensure a user exists in the database, creating if necessary.
 * Returns the database user ID.
 */
export async function ensureUser(waId: string, name?: string): Promise<number> {
  const db = getDb();

  let user = await db('users').where({ wa_id: waId }).first();

  if (!user) {
    [user] = await db('users')
      .insert({ wa_id: waId, name: name || null })
      .onConflict('wa_id')
      .merge({ name: name || undefined, updated_at: new Date() })
      .returning('*');
  } else if (name && name !== user.name) {
    await db('users').where({ id: user.id }).update({ name, updated_at: new Date() });
  }

  return user.id;
}

/**
 * Ensure a group membership exists.
 */
export async function ensureMembership(
  userId: number,
  groupId: number,
  role: string = 'MEMBER'
): Promise<void> {
  const db = getDb();

  await db('group_members')
    .insert({ user_id: userId, group_id: groupId, role })
    .onConflict(['group_id', 'user_id'])
    .merge({ updated_at: new Date() });
}

/**
 * Get a user's role in a group.
 */
export async function getUserRole(userId: number, groupId: number): Promise<Role> {
  const db = getDb();
  const member = await db('group_members')
    .where({ user_id: userId, group_id: groupId })
    .first();

  if (!member) return Role.MEMBER;
  return parseRole(member.role);
}

/**
 * Get a user's database ID from their WhatsApp ID.
 */
export async function getUserIdByWaId(waId: string): Promise<number | null> {
  const db = getDb();
  const user = await db('users').where({ wa_id: waId }).first();
  return user?.id || null;
}

/**
 * Update a member's role.
 */
export async function updateMemberRole(
  userId: number,
  groupId: number,
  role: string
): Promise<void> {
  const db = getDb();
  await db('group_members')
    .where({ user_id: userId, group_id: groupId })
    .update({ role, updated_at: new Date() });

  logger.info({ userId, groupId, role }, 'Member role updated');
}

/**
 * Get all admins in a group.
 */
export async function getGroupAdmins(groupId: number): Promise<Array<{ user_id: number; wa_id: string; name: string; role: string }>> {
  const db = getDb();
  return db('group_members')
    .join('users', 'users.id', '=', 'group_members.user_id')
    .where('group_members.group_id', groupId)
    .whereIn('group_members.role', ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'MODERATOR'])
    .select('group_members.user_id', 'users.wa_id', 'users.name', 'group_members.role')
    .orderByRaw("CASE role WHEN 'OWNER' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 WHEN 'ADMIN' THEN 3 WHEN 'MODERATOR' THEN 4 END");
}

/**
 * Get member count for a group.
 */
export async function getMemberCount(groupId: number): Promise<number> {
  const db = getDb();
  const result = await db('group_members')
    .where({ group_id: groupId })
    .count('id as count')
    .first();
  return parseInt(String(result?.count || '0'), 10);
}

/**
 * Remove a member from a group.
 */
export async function removeMember(userId: number, groupId: number): Promise<void> {
  const db = getDb();
  await db('group_members')
    .where({ user_id: userId, group_id: groupId })
    .del();
}

/**
 * Get full user moderation profile.
 */
export async function getUserProfile(userId: number, groupId: number) {
  const db = getDb();

  const user = await db('users').where({ id: userId }).first();
  const membership = await db('group_members')
    .where({ user_id: userId, group_id: groupId })
    .first();

  const warningCount = await db('warnings')
    .where({ user_id: userId, group_id: groupId, active: true })
    .count('id as count')
    .first();

  const violationCount = await db('violations')
    .where({ user_id: userId, group_id: groupId })
    .count('id as count')
    .first();

  const activeMute = await db('mutes')
    .where({ user_id: userId, group_id: groupId, active: true })
    .first();

  const isBlacklisted = await db('banned_users')
    .where({ user_id: userId, group_id: groupId, active: true })
    .first();

  const lastViolation = await db('violations')
    .where({ user_id: userId, group_id: groupId })
    .orderBy('created_at', 'desc')
    .first();

  return {
    user,
    role: membership?.role || 'MEMBER',
    warnings: parseInt(String(warningCount?.count || '0'), 10),
    violations: parseInt(String(violationCount?.count || '0'), 10),
    muted: !!activeMute,
    muteUntil: activeMute?.mute_until || null,
    blacklisted: !!isBlacklisted,
    joined: membership?.joined_at || null,
    lastViolation: lastViolation?.created_at || null,
  };
}

/**
 * Check if a user is whitelisted in a group.
 */
export async function isWhitelisted(userId: number, groupId: number): Promise<boolean> {
  const db = getDb();
  const entry = await db('whitelist')
    .where({ user_id: userId, group_id: groupId })
    .first();
  return !!entry;
}

/**
 * Check if a user is blacklisted in a group.
 */
export async function isBlacklisted(userId: number, groupId: number): Promise<boolean> {
  const db = getDb();
  const entry = await db('banned_users')
    .where({ user_id: userId, group_id: groupId, active: true })
    .first();
  return !!entry;
}
