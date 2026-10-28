/**
 * Duration utility unit tests.
 */
import { parseDuration, formatDuration } from '../src/utils/duration.js';

describe('Duration Parser', () => {
  it('should parse minutes', () => {
    expect(parseDuration('30m')).toBe(30 * 60 * 1000);
    expect(parseDuration('5m')).toBe(5 * 60 * 1000);
  });

  it('should parse hours', () => {
    expect(parseDuration('2h')).toBe(2 * 60 * 60 * 1000);
    expect(parseDuration('1h')).toBe(60 * 60 * 1000);
  });

  it('should parse days', () => {
    expect(parseDuration('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('should parse seconds', () => {
    expect(parseDuration('30s')).toBe(30 * 1000);
  });

  it('should return null for invalid input', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('0')).toBeNull();
  });
});

describe('Duration Formatter', () => {
  it('should format milliseconds to human-readable', () => {
    expect(formatDuration(30 * 60 * 1000)).toBe('30 menit');
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe('2 jam');
    expect(formatDuration(24 * 60 * 60 * 1000)).toBe('1 hari');
  });

  it('should handle combined durations', () => {
    const duration = (1 * 60 * 60 * 1000) + (30 * 60 * 1000);
    const result = formatDuration(duration);
    expect(result).toContain('1 jam');
    expect(result).toContain('30 menit');
  });
});
