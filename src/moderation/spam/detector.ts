/**
 * Spam Detector — Rate-based spam detection using Redis sliding window.
 */
import { Redis } from 'ioredis';
import { config } from '../../config/index.js';
import { GroupSettings } from '../../config/defaults.js';
import pino from 'pino';

const logger = pino({ name: 'spam-detector' });

let redisClient: Redis | null = null;

// Fallback in-memory rate tracker when Redis is unavailable
const memoryTracker = new Map<string, number[]>();

function getRedis(): Redis | null {
  if (!redisClient) {
    try {
      redisClient = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
        db: config.redis.db,
        lazyConnect: true,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.warn('Redis unavailable, using in-memory fallback');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 2000);
        },
      });

      redisClient.on('error', (err: Error) => {
        logger.error({ error: err.message }, 'Redis error');
      });

      redisClient.connect().catch(() => {
        logger.warn('Redis connection failed, using in-memory fallback');
        redisClient = null;
      });
    } catch {
      logger.warn('Redis initialization failed, using in-memory fallback');
      redisClient = null;
    }
  }
  return redisClient;
}

export interface SpamResult {
  isSpam: boolean;
  messageCount: number;
  threshold: number;
  action: 'WARN' | 'MUTE' | null;
  muteDuration: string | null;
}

/**
 * Track a message and check for spam.
 */
export async function checkSpam(
  userId: string,
  groupId: string,
  settings: GroupSettings
): Promise<SpamResult> {
  if (!settings.spam.enabled) {
    return { isSpam: false, messageCount: 0, threshold: 0, action: null, muteDuration: null };
  }

  const now = Date.now();

  // Check each threshold (from strictest to most lenient)
  const sortedThresholds = [...settings.spam.thresholds].sort((a, b) => b.messages - a.messages);

  for (const threshold of sortedThresholds) {
    const key = `spam:${groupId}:${userId}:${threshold.seconds}`;
    const windowMs = threshold.seconds * 1000;
    const count = await getMessageCount(key, now, windowMs);

    if (count >= threshold.messages) {
      return {
        isSpam: true,
        messageCount: count,
        threshold: threshold.messages,
        action: threshold.action,
        muteDuration: 'mute_duration' in threshold ? (threshold as any).mute_duration : null,
      };
    }
  }

  // Record this message for all windows
  for (const threshold of settings.spam.thresholds) {
    const key = `spam:${groupId}:${userId}:${threshold.seconds}`;
    await recordMessage(key, now, threshold.seconds * 1000);
  }

  return { isSpam: false, messageCount: 0, threshold: 0, action: null, muteDuration: null };
}

/**
 * Get message count in a sliding window.
 */
async function getMessageCount(key: string, now: number, windowMs: number): Promise<number> {
  const r = getRedis();

  if (r) {
    try {
      // Use sorted set with timestamp as score
      await r.zremrangebyscore(key, 0, now - windowMs);
      const count = await r.zcard(key);
      return count;
    } catch {
      // Fallback to memory
    }
  }

  // In-memory fallback
  const timestamps = memoryTracker.get(key) || [];
  const cutoff = now - windowMs;
  const valid = timestamps.filter(t => t > cutoff);
  memoryTracker.set(key, valid);
  return valid.length;
}

/**
 * Record a message timestamp.
 */
async function recordMessage(key: string, now: number, windowMs: number): Promise<void> {
  const r = getRedis();

  if (r) {
    try {
      await r.zadd(key, now, `${now}-${Math.random()}`);
      await r.expire(key, Math.ceil(windowMs / 1000) + 10);
      return;
    } catch {
      // Fallback to memory
    }
  }

  // In-memory fallback
  const timestamps = memoryTracker.get(key) || [];
  timestamps.push(now);
  // Clean old entries
  const cutoff = now - windowMs;
  memoryTracker.set(key, timestamps.filter(t => t > cutoff));
}

/**
 * Check command rate limiting.
 */
export async function checkCommandRate(
  userId: string,
  groupId: string,
  maxCommands: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `cmdrate:${groupId}:${userId}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const count = await getMessageCount(key, now, windowMs);
  if (count >= maxCommands) {
    return false; // Rate limited
  }

  await recordMessage(key, now, windowMs);
  return true; // Allowed
}

/**
 * Clean up in-memory tracker (called periodically).
 */
export function cleanupMemoryTracker(): void {
  const now = Date.now();
  const maxAge = 120000; // 2 minutes

  for (const [key, timestamps] of memoryTracker.entries()) {
    const valid = timestamps.filter(t => t > now - maxAge);
    if (valid.length === 0) {
      memoryTracker.delete(key);
    } else {
      memoryTracker.set(key, valid);
    }
  }
}
