/**
 * Flood Detector — Detects duplicate messages, excessive characters, emojis, and mentions.
 */
import { createHash } from 'crypto';
import { GroupSettings } from '../../config/defaults.js';

// In-memory tracker for recent messages per user per group
const recentMessages = new Map<string, Array<{ hash: string; timestamp: number }>>();
const CLEANUP_INTERVAL = 120000; // 2 minutes

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - 120000;
  for (const [key, messages] of recentMessages.entries()) {
    const valid = messages.filter(m => m.timestamp > cutoff);
    if (valid.length === 0) {
      recentMessages.delete(key);
    } else {
      recentMessages.set(key, valid);
    }
  }
}, CLEANUP_INTERVAL);

export interface FloodResult {
  isFlood: boolean;
  type: 'DUPLICATE' | 'EMOJI' | 'CHAR_REPEAT' | 'MENTION' | null;
  details: string;
}

/**
 * Check a message for flood patterns.
 */
export function detectFlood(
  text: string,
  userId: string,
  groupId: string,
  mentionCount: number,
  settings: GroupSettings
): FloodResult {
  const noFlood: FloodResult = { isFlood: false, type: null, details: '' };

  if (!settings.flood.enabled || !text) return noFlood;

  // ── Check 1: Duplicate messages ──
  const key = `${groupId}:${userId}`;
  const hash = createHash('md5').update(text.trim().toLowerCase()).digest('hex');
  const now = Date.now();
  const windowMs = (settings.flood.duplicate_window_seconds || 60) * 1000;

  const recent = recentMessages.get(key) || [];
  const cutoff = now - windowMs;
  const validRecent = recent.filter(m => m.timestamp > cutoff);

  const duplicateCount = validRecent.filter(m => m.hash === hash).length;
  if (duplicateCount >= (settings.flood.duplicate_limit || 5)) {
    return {
      isFlood: true,
      type: 'DUPLICATE',
      details: `Pesan yang sama dikirim ${duplicateCount + 1} kali dalam ${settings.flood.duplicate_window_seconds}s`,
    };
  }

  // Record this message
  validRecent.push({ hash, timestamp: now });
  recentMessages.set(key, validRecent);

  // ── Check 2: Excessive emoji ──
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiMatches = text.match(emojiRegex) || [];
  if (emojiMatches.length > (settings.flood.max_emoji_count || 30)) {
    return {
      isFlood: true,
      type: 'EMOJI',
      details: `Emoji berlebihan: ${emojiMatches.length} emoji terdeteksi`,
    };
  }

  // ── Check 3: Character repetition ──
  const charRepeatRegex = /(.)\1{19,}/; // Same character repeated 20+ times
  const maxRepeat = settings.flood.max_char_repeat || 20;
  const repeatRegex = new RegExp(`(.)\\1{${maxRepeat - 1},}`);
  if (repeatRegex.test(text)) {
    return {
      isFlood: true,
      type: 'CHAR_REPEAT',
      details: `Karakter berulang berlebihan terdeteksi`,
    };
  }

  // ── Check 4: Mention spam ──
  if (settings.mention.enabled && mentionCount > 0) {
    if (mentionCount >= (settings.mention.mute_limit || 20)) {
      return {
        isFlood: true,
        type: 'MENTION',
        details: `Mention berlebihan: ${mentionCount} mention (batas mute: ${settings.mention.mute_limit})`,
      };
    }
  }

  return noFlood;
}

/**
 * Check mention count against settings thresholds.
 */
export function checkMentionSpam(
  mentionCount: number,
  settings: GroupSettings
): { isSpam: boolean; action: 'WARN' | 'DELETE' | 'MUTE' | null; details: string } {
  if (!settings.mention.enabled || mentionCount === 0) {
    return { isSpam: false, action: null, details: '' };
  }

  if (mentionCount >= (settings.mention.mute_limit || 20)) {
    return {
      isSpam: true,
      action: 'MUTE',
      details: `${mentionCount} mentions (batas mute: ${settings.mention.mute_limit})`,
    };
  }

  if (mentionCount >= (settings.mention.delete_limit || 10)) {
    return {
      isSpam: true,
      action: 'DELETE',
      details: `${mentionCount} mentions (batas delete: ${settings.mention.delete_limit})`,
    };
  }

  if (mentionCount >= (settings.mention.warn_limit || 5)) {
    return {
      isSpam: true,
      action: 'WARN',
      details: `${mentionCount} mentions (batas warn: ${settings.mention.warn_limit})`,
    };
  }

  return { isSpam: false, action: null, details: '' };
}
