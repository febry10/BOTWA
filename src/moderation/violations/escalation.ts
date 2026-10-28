/**
 * Escalation Engine — Maps violation counts to punishment tiers.
 */
import { GroupSettings } from '../../config/defaults.js';
import { parseDuration, formatDuration } from '../../utils/duration.js';

export type EscalationAction = 'WARN' | 'MUTE' | 'KICK' | 'BAN';

export interface EscalationResult {
  action: EscalationAction;
  muteDuration: string | null;
  reason: string;
}

/**
 * Determine the appropriate action based on violation count and group settings.
 */
export function getEscalation(
  violationCount: number,
  settings: GroupSettings
): EscalationResult {
  // Check kick threshold
  if (settings.escalation.enabled && settings.escalation.kick_at > 0 && violationCount >= settings.escalation.kick_at) {
    return {
      action: 'KICK',
      muteDuration: null,
      reason: `Mencapai ${violationCount} pelanggaran (batas kick: ${settings.escalation.kick_at})`,
    };
  }

  // Check ban threshold
  if (settings.escalation.enabled && settings.escalation.ban_at > 0 && violationCount >= settings.escalation.ban_at) {
    return {
      action: 'BAN',
      muteDuration: null,
      reason: `Mencapai ${violationCount} pelanggaran (batas ban: ${settings.escalation.ban_at})`,
    };
  }

  // Check mute tiers (highest first)
  const muteTiers = settings.mute_tiers;
  const tierKeys = Object.keys(muteTiers)
    .map(k => parseInt(k, 10))
    .sort((a, b) => b - a); // Descending

  for (const threshold of tierKeys) {
    if (violationCount >= threshold) {
      const duration = muteTiers[String(threshold)];
      return {
        action: 'MUTE',
        muteDuration: duration,
        reason: `Mencapai ${violationCount} pelanggaran (batas mute: ${threshold})`,
      };
    }
  }

  // Default: warning
  return {
    action: 'WARN',
    muteDuration: null,
    reason: `Pelanggaran ke-${violationCount}`,
  };
}

/**
 * Get the specific action for a profanity severity level.
 */
export function getSeverityAction(
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY',
  violationCount: number,
  settings: GroupSettings
): EscalationResult {
  // Heavy severity: immediate mute
  if (severity === 'HEAVY') {
    return {
      action: 'MUTE',
      muteDuration: '1h',
      reason: 'Kata kasar kategori berat',
    };
  }

  // Medium severity: contributes 2 warning weight
  if (severity === 'MEDIUM') {
    return getEscalation(violationCount, settings);
  }

  // Light severity: standard warning
  return {
    action: 'WARN',
    muteDuration: null,
    reason: 'Kata kasar kategori ringan',
  };
}
