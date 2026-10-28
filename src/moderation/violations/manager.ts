/**
 * Violation Manager — Records violations and triggers escalation.
 */
import { createHash } from 'crypto';
import { getDb } from '../../database/connection.js';
import { GroupSettings } from '../../config/defaults.js';
import { getEscalation, getSeverityAction, EscalationResult } from './escalation.js';
import pino from 'pino';

const logger = pino({ name: 'violation-manager' });

export type ViolationType = 'PROFANITY' | 'SPAM' | 'FLOOD' | 'LINK' | 'MENTION' | 'INVITE' | 'BLACKLIST' | 'OTHER';
export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActionType = 'NONE' | 'DELETE' | 'WARN' | 'MUTE' | 'KICK' | 'BAN';

/**
 * Record a violation and determine the appropriate action.
 */
export async function recordViolation(
  userId: number,
  groupId: number,
  type: ViolationType,
  severity: ViolationSeverity,
  messageContent: string | null,
  settings: GroupSettings
): Promise<{ action: ActionType; muteDuration: string | null; reason: string; violationCount: number }> {
  const db = getDb();

  // Record the violation
  await db('violations').insert({
    user_id: userId,
    group_id: groupId,
    type,
    severity,
    message_content: null, // Don't store content by default for privacy
    content_hash: messageContent
      ? createHash('sha256').update(messageContent).digest('hex')
      : null,
    action_taken: 'NONE', // Will be updated after action is taken
  });

  // Get total active violation count for this user in this group
  const result = await db('violations')
    .where({ user_id: userId, group_id: groupId })
    .count('id as count')
    .first();

  const violationCount = parseInt(String(result?.count || '0'), 10);

  // Get escalation action
  const escalation = getEscalation(violationCount, settings);

  logger.info({
    userId, groupId, type, severity, violationCount,
    action: escalation.action, muteDuration: escalation.muteDuration,
  }, 'Violation recorded');

  return {
    action: escalation.action as ActionType,
    muteDuration: escalation.muteDuration,
    reason: escalation.reason,
    violationCount,
  };
}

/**
 * Record a profanity violation with severity-aware escalation.
 */
export async function recordProfanityViolation(
  userId: number,
  groupId: number,
  profanitySeverity: 'LIGHT' | 'MEDIUM' | 'HEAVY',
  messageContent: string | null,
  settings: GroupSettings
): Promise<{ action: ActionType; muteDuration: string | null; reason: string; violationCount: number }> {
  const db = getDb();

  const severityMap: Record<string, ViolationSeverity> = {
    LIGHT: 'LOW',
    MEDIUM: 'MEDIUM',
    HEAVY: 'HIGH',
  };

  await db('violations').insert({
    user_id: userId,
    group_id: groupId,
    type: 'PROFANITY',
    severity: severityMap[profanitySeverity] || 'MEDIUM',
    content_hash: messageContent
      ? createHash('sha256').update(messageContent).digest('hex')
      : null,
    action_taken: 'NONE',
  });

  const result = await db('violations')
    .where({ user_id: userId, group_id: groupId })
    .count('id as count')
    .first();

  const violationCount = parseInt(String(result?.count || '0'), 10);
  const escalation = getSeverityAction(profanitySeverity, violationCount, settings);

  return {
    action: escalation.action as ActionType,
    muteDuration: escalation.muteDuration,
    reason: escalation.reason,
    violationCount,
  };
}

/**
 * Update the action taken on a violation.
 */
export async function updateViolationAction(violationId: number, action: ActionType): Promise<void> {
  const db = getDb();
  await db('violations')
    .where({ id: violationId })
    .update({ action_taken: action });
}

/**
 * Get total violation count for a user in a group.
 */
export async function getViolationCount(userId: number, groupId: number): Promise<number> {
  const db = getDb();
  const result = await db('violations')
    .where({ user_id: userId, group_id: groupId })
    .count('id as count')
    .first();
  return parseInt(String(result?.count || '0'), 10);
}
