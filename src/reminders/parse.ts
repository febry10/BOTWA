/**
 * Reminder time parsing — supports relative, absolute, daily and weekly schedules.
 */
import { DateTime } from 'luxon';

export type RepeatMode = 'NONE' | 'DAILY' | 'WEEKLY';

export interface ParsedReminder {
  remindAt: Date;
  repeat: RepeatMode;
  message: string;
}

const WEEKDAYS: Record<string, number> = {
  senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6, minggu: 7, ahad: 7,
};

const RELATIVE_UNITS: Record<string, number> = {
  m: 1, mnt: 1, menit: 1, h: 60, j: 60, jam: 60, d: 1440, hari: 1440,
};

function parseClock(value: string): { hour: number; minute: number } | null {
  const m = value.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Parse "<when> | <message>". Returns an error string (Indonesian) when invalid.
 */
export function parseReminder(input: string, zone: string, now: DateTime = DateTime.now()): ParsedReminder | { error: string } {
  const sep = input.indexOf('|');
  if (sep === -1) return { error: 'Pisahkan waktu dan pesan dengan tanda |' };
  const when = input.slice(0, sep).trim().toLowerCase().replace(/\s+/g, ' ');
  const message = input.slice(sep + 1).trim();
  if (!message) return { error: 'Pesan pengingat tidak boleh kosong' };
  if (message.length > 1000) return { error: 'Pesan pengingat maksimal 1000 karakter' };

  const local = now.setZone(zone);
  let at: DateTime | null = null;
  let repeat: RepeatMode = 'NONE';
  let m: RegExpMatchArray | null;

  if ((m = when.match(/^(\d+)\s*([a-z]+)$/)) && RELATIVE_UNITS[m[2]]) {
    at = local.plus({ minutes: Number(m[1]) * RELATIVE_UNITS[m[2]] });
  } else if ((m = when.match(/^(harian|setiap hari|tiap hari|daily) (\S+)$/))) {
    const clock = parseClock(m[2]);
    if (!clock) return { error: 'Format jam salah, contoh 07:00' };
    repeat = 'DAILY';
    at = local.set({ ...clock, second: 0, millisecond: 0 });
    if (at <= local) at = at.plus({ days: 1 });
  } else if ((m = when.match(/^(mingguan|setiap|tiap|weekly) (\S+) (\S+)$/))) {
    const weekday = WEEKDAYS[m[2]];
    const clock = parseClock(m[3]);
    if (!weekday) return { error: 'Nama hari tidak dikenal (senin - minggu)' };
    if (!clock) return { error: 'Format jam salah, contoh 20:00' };
    repeat = 'WEEKLY';
    at = local.set({ ...clock, second: 0, millisecond: 0 });
    at = at.plus({ days: (weekday - at.weekday + 7) % 7 });
    if (at <= local) at = at.plus({ weeks: 1 });
  } else if ((m = when.match(/^(besok|lusa) (\S+)$/))) {
    const clock = parseClock(m[2]);
    if (!clock) return { error: 'Format jam salah, contoh 19:30' };
    at = local.plus({ days: m[1] === 'besok' ? 1 : 2 }).set({ ...clock, second: 0, millisecond: 0 });
  } else if (parseClock(when)) {
    at = local.set({ ...parseClock(when)!, second: 0, millisecond: 0 });
    if (at <= local) at = at.plus({ days: 1 });
  } else {
    for (const fmt of ['yyyy-MM-dd HH:mm', 'd/M/yyyy HH:mm', 'd-M-yyyy HH:mm', 'd/M/yyyy H:mm', 'yyyy-MM-dd H:mm', 'd-M-yyyy H:mm']) {
      const dt = DateTime.fromFormat(when.replace('.', ':'), fmt, { zone });
      if (dt.isValid) { at = dt; break; }
    }
  }

  if (!at || !at.isValid) {
    return { error: 'Format waktu tidak dikenal' };
  }
  if (at <= local) return { error: 'Waktu pengingat sudah lewat' };

  return { remindAt: at.toJSDate(), repeat, message };
}

/**
 * Next run time for a repeating reminder (skips occurrences missed while the bot was offline).
 */
export function nextOccurrence(remindAt: Date, repeat: RepeatMode, now: Date = new Date()): Date | null {
  if (repeat === 'NONE') return null;
  let next = DateTime.fromJSDate(remindAt);
  do {
    next = repeat === 'DAILY' ? next.plus({ days: 1 }) : next.plus({ weeks: 1 });
  } while (next.toJSDate() <= now);
  return next.toJSDate();
}

export function formatReminderTime(date: Date, zone: string): string {
  return DateTime.fromJSDate(date).setZone(zone).setLocale('id').toFormat('cccc, d LLL yyyy HH:mm');
}
