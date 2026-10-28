/**
 * Timezone-aware timestamp utilities.
 */
import { config } from '../config/index.js';

/**
 * Get the current time as a Date object.
 */
export function now(): Date {
  return new Date();
}

/**
 * Format a date to the configured timezone string.
 */
export function formatTimestamp(date: Date): string {
  return date.toLocaleString('id-ID', {
    timeZone: config.bot.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format a date to time-only string.
 */
export function formatTime(date: Date): string {
  return date.toLocaleString('id-ID', {
    timeZone: config.bot.timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format a date to date-only string.
 */
export function formatDate(date: Date): string {
  return date.toLocaleString('id-ID', {
    timeZone: config.bot.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * Check if a timestamp has expired (is in the past).
 */
export function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return new Date() >= expiresAt;
}

/**
 * Get the start of today in the configured timezone.
 */
export function startOfToday(): Date {
  const d = new Date();
  const formatted = d.toLocaleDateString('en-CA', { timeZone: config.bot.timezone });
  return new Date(formatted + 'T00:00:00');
}

/**
 * Get a date N days ago.
 */
export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
