/**
 * Logging Service — Activity logging to database.
 */
import { getDb } from '../database/connection.js';
import { createHash } from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'logging-service' });

export type ActionType = 'NONE' | 'DELETE' | 'WARN' | 'MUTE' | 'KICK' | 'BAN';

/**
 * Log a moderation action on a message.
 */
export async function logMessageAction(
  groupId: number,
  userId: number,
  messageType: string,
  content: string | null,
  action: ActionType,
  reason: string | null
): Promise<void> {
  try {
    const db = getDb();
    const contentHash = content ? createHash('sha256').update(content).digest('hex') : null;

    await db('message_logs').insert({
      group_id: groupId,
      user_id: userId,
      message_type: messageType,
      content_hash: contentHash,
      action,
      reason,
    });
  } catch (error) {
    logger.error({ error, groupId, userId, action }, 'Failed to log message action');
  }
}

/**
 * Log an admin command action.
 */
export async function logAdminAction(
  groupId: number,
  adminUserId: number,
  targetUserId: number | null,
  command: string,
  details: Record<string, any> = {},
  result: string | null = null
): Promise<void> {
  try {
    const db = getDb();
    await db('admin_logs').insert({
      group_id: groupId,
      admin_user_id: adminUserId,
      target_user_id: targetUserId,
      command,
      details: JSON.stringify(details),
      result,
    });
  } catch (error) {
    logger.error({ error, groupId, adminUserId, command }, 'Failed to log admin action');
  }
}

/**
 * Get recent admin logs for a group.
 */
export async function getAdminLogs(
  groupId: number,
  limit: number = 50
): Promise<any[]> {
  const db = getDb();
  return db('admin_logs')
    .join('users as admin', 'admin.id', '=', 'admin_logs.admin_user_id')
    .leftJoin('users as target', 'target.id', '=', 'admin_logs.target_user_id')
    .where('admin_logs.group_id', groupId)
    .select(
      'admin_logs.*',
      'admin.wa_id as admin_wa_id',
      'admin.name as admin_name',
      'target.wa_id as target_wa_id',
      'target.name as target_name'
    )
    .orderBy('admin_logs.created_at', 'desc')
    .limit(limit);
}

/**
 * Get message action logs for a group.
 */
export async function getMessageLogs(
  groupId: number,
  limit: number = 100
): Promise<any[]> {
  const db = getDb();
  return db('message_logs')
    .join('users', 'users.id', '=', 'message_logs.user_id')
    .where('message_logs.group_id', groupId)
    .where('message_logs.action', '!=', 'NONE')
    .select('message_logs.*', 'users.wa_id', 'users.name')
    .orderBy('message_logs.created_at', 'desc')
    .limit(limit);
}
