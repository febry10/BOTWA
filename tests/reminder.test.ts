import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { parseReminder, nextOccurrence } from '../src/reminders/parse.js';

const zone = 'Asia/Jakarta';
// Wednesday 2026-10-28 10:00 WIB
const now = DateTime.fromISO('2026-10-28T10:00:00', { zone });
const at = (input: string) => {
  const r = parseReminder(input, zone, now);
  if ('error' in r) throw new Error(r.error);
  return { ...r, local: DateTime.fromJSDate(r.remindAt).setZone(zone).toFormat('yyyy-MM-dd HH:mm') };
};

describe('reminder parsing', () => {
  it('parses relative times', () => {
    expect(at('30m | rapat').local).toBe('2026-10-28 10:30');
    expect(at('2 jam | rapat').local).toBe('2026-10-28 12:00');
    expect(at('1d | rapat').local).toBe('2026-10-29 10:00');
  });

  it('parses clock times and dates', () => {
    expect(at('19:30 | main').local).toBe('2026-10-28 19:30');
    expect(at('08:00 | pagi').local).toBe('2026-10-29 08:00');
    expect(at('besok 07.15 | x').local).toBe('2026-10-29 07:15');
    expect(at('2026-12-31 23:00 | tahun baru').local).toBe('2026-12-31 23:00');
    expect(at('25/12/2026 09:00 | natal').local).toBe('2026-12-25 09:00');
  });

  it('parses repeating schedules', () => {
    const daily = at('harian 05:00 | subuh');
    expect(daily.repeat).toBe('DAILY');
    expect(daily.local).toBe('2026-10-29 05:00');
    const weekly = at('mingguan jumat 20:00 | nobar');
    expect(weekly.repeat).toBe('WEEKLY');
    expect(weekly.local).toBe('2026-10-30 20:00');
    expect(at('mingguan rabu 09:00 | x').local).toBe('2026-11-04 09:00');
  });

  it('rejects invalid input', () => {
    expect(parseReminder('30m rapat', zone, now)).toHaveProperty('error');
    expect(parseReminder('2020-01-01 10:00 | lama', zone, now)).toHaveProperty('error');
    expect(parseReminder('kapan-kapan | x', zone, now)).toHaveProperty('error');
    expect(parseReminder('25:00 | x', zone, now)).toHaveProperty('error');
    expect(parseReminder('10m | ', zone, now)).toHaveProperty('error');
  });

  it('computes next occurrences', () => {
    const base = new Date('2026-10-28T03:00:00Z');
    expect(nextOccurrence(base, 'NONE')).toBeNull();
    expect(nextOccurrence(base, 'DAILY', base)?.toISOString()).toBe('2026-10-29T03:00:00.000Z');
    expect(nextOccurrence(base, 'WEEKLY', new Date('2026-11-10T00:00:00Z'))?.toISOString()).toBe('2026-11-11T03:00:00.000Z');
  });
});
