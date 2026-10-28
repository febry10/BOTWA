/**
 * Warning Service — CRUD operations for the warning system.
 */
import { getDb } from '../database/connection.js';
import { GroupSettings } from '../config/defaults.js';
import pino from 'pino';

const logger = pino({ name: 'warning-service' });

export interface Warning {
  id: number;
  user_id: number;
  group_id: number;
  reason: string | null;
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  issued_by: string | null;
  expires_at: Date | null;
  active: boolean;
  created_at: Date;
}

/**
 * Issue a warning to a user in a group.
 */
export async function issueWarning(
  userId: number,
  groupId: number,
  reason: string | null,
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'MEDIUM',
  issuedBy: string | null = null,
  settings: GroupSettings
): Promise<{ warning: Warning; activeCount: number }> {
  const db = getDb();

  // Calculate expiry if auto-reset is enabled
  let expiresAt: Date | null = null;
  if (settings.warning.auto_reset && settings.warning.reset_after_days > 0) {
    expiresAt = new Date(Date.now() + settings.warning.reset_after_days * 24 * 60 * 60 * 1000);
  }

  const [warning] = await db('warnings')
    .insert({
      user_id: userId,
      group_id: groupId,
      reason,
      severity,
      issued_by: issuedBy,
      expires_at: expiresAt,
      active: true,
    })
    .returning('*');

  const activeCount = await getActiveWarningCount(userId, groupId);

  logger.info({
    userId, groupId, warningId: warning.id, activeCount, severity,
  }, 'Warning issued');

  return { warning, activeCount };
}

/**
 * Get the count of active (non-expired) warnings for a user in a group.
 */
export async function getActiveWarningCount(userId: number, groupId: number): Promise<number> {
  const db = getDb();
  const result = await db('warnings')
    .where({ user_id: userId, group_id: groupId, active: true })
    .andWhere(function () {
      this.whereNull('expires_at').orWhere('expires_at', '>', new Date());
    })
    .count('id as count')
    .first();

  return parseInt(String(result?.count || '0'), 10);
}

/**
 * Get all active warnings for a user in a group.
 */
export async function getActiveWarnings(userId: number, groupId: number): Promise<Warning[]> {
  const db = getDb();
  return db('warnings')
    .where({ user_id: userId, group_id: groupId, active: true })
    .andWhere(function () {
      this.whereNull('expires_at').orWhere('expires_at', '>', new Date());
    })
    .orderBy('created_at', 'desc');
}

/**
 * Reset all warnings for a user in a group.
 */
export async function resetWarnings(userId: number, groupId: number): Promise<number> {
  const db = getDb();
  const updated = await db('warnings')
    .where({ user_id: userId, group_id: groupId, active: true })
    .update({ active: false });

  logger.info({ userId, groupId, count: updated }, 'Warnings reset');
  return updated;
}

/**
 * Expire all warnings that have passed their expires_at timestamp.
 * Called periodically by a cron job.
 */
export async function expireWarnings(): Promise<number> {
  const db = getDb();
  const updated = await db('warnings')
    .where('active', true)
    .whereNotNull('expires_at')
    .where('expires_at', '<=', new Date())
    .update({ active: false });

  if (updated > 0) {
    logger.info({ count: updated }, 'Expired warnings deactivated');
  }
  return updated;
}
