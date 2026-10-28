import type { Knex } from 'knex';

/**
 * Default Indonesian profanity word list.
 * Categorized by severity: LIGHT, MEDIUM, HEAVY.
 * This is a starter list — admins can add/remove per group.
 */
export async function seed(knex: Knex): Promise<void> {
  // Clear existing global words (group_id = null)
  await knex('blacklist_words').whereNull('group_id').del();

  const words: Array<{ word: string; severity: string; group_id: null; added_by: string }> = [
    // ── LIGHT ──
    ...[
      'bodoh', 'bego', 'tolol', 'idiot', 'dungu', 'oon', 'gendeng',
      'pekok', 'bloon', 'geblek', 'dodol', 'kampret', 'sialan',
      'brengsek', 'kurang ajar',
    ].map(w => ({ word: w, severity: 'LIGHT', group_id: null as null, added_by: 'SYSTEM' })),

    // ── MEDIUM ──
    ...[
      'goblok', 'bangsat', 'bajingan', 'keparat', 'bedebah',
      'biadab', 'laknat', 'setan', 'iblis', 'terkutuk',
      'monyet', 'babi', 'anjing', 'asu', 'jancuk', 'jancok',
      'cuk', 'diamput', 'taik', 'tai', 'matamu',
    ].map(w => ({ word: w, severity: 'MEDIUM', group_id: null as null, added_by: 'SYSTEM' })),

    // ── HEAVY ──
    ...[
      'kontol', 'memek', 'ngentot', 'entot', 'pepek', 'itil',
      'ngewe', 'pantek', 'pantat', 'puki', 'pukimak', 'kimak',
      'lonte', 'pelacur', 'sundal', 'lacur', 'pecun',
    ].map(w => ({ word: w, severity: 'HEAVY', group_id: null as null, added_by: 'SYSTEM' })),
  ];

  await knex('blacklist_words').insert(words);
}
