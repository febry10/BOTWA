/**
 * Duration parser: converts human-readable durations to milliseconds.
 * Supported formats: 10m, 30m, 1h, 2h, 1d, 7d, 1w
 */

const DURATION_REGEX = /^(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/i;

const MULTIPLIERS: Record<string, number> = {
  s: 1000,
  sec: 1000,
  secs: 1000,
  second: 1000,
  seconds: 1000,
  m: 60 * 1000,
  min: 60 * 1000,
  mins: 60 * 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  h: 60 * 60 * 1000,
  hr: 60 * 60 * 1000,
  hrs: 60 * 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Parse a duration string to milliseconds.
 * Returns null if the format is invalid.
 */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  const match = trimmed.match(DURATION_REGEX);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multiplier = MULTIPLIERS[unit];

  if (!multiplier || value <= 0) return null;
  return value * multiplier;
}

/**
 * Format milliseconds to human-readable string (in Indonesian).
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '0 menit';

  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
  ms %= 7 * 24 * 60 * 60 * 1000;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  ms %= 24 * 60 * 60 * 1000;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  ms %= 60 * 60 * 1000;
  const minutes = Math.floor(ms / (60 * 1000));
  ms %= 60 * 1000;
  const seconds = Math.floor(ms / 1000);

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} minggu`);
  if (days > 0) parts.push(`${days} hari`);
  if (hours > 0) parts.push(`${hours} jam`);
  if (minutes > 0) parts.push(`${minutes} menit`);
  if (seconds > 0 && parts.length === 0) parts.push(`${seconds} detik`);

  return parts.length > 0 ? parts.join(' ') : '0 menit';
}

/**
 * Get a Date object representing "now + duration".
 */
export function durationFromNow(durationStr: string): Date | null {
  const ms = parseDuration(durationStr);
  if (ms === null) return null;
  return new Date(Date.now() + ms);
}
