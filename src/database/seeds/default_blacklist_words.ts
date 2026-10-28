import type { Knex } from 'knex';

type Severity = 'LIGHT' | 'MEDIUM' | 'HEAVY';

/**
 * Default Indonesian (plus regional & common English) profanity word list.
 * Admins can add words per group with !addword or allow a default word with !delword.
 */
export const DEFAULT_BLACKLIST_WORDS: Record<Severity, string[]> = {
  LIGHT: [
    'bodoh', 'bego', 'begok', 'tolol', 'tlol', 'idiot', 'dungu', 'oon', 'gendeng',
    'pekok', 'bloon', 'geblek', 'dodol', 'kampret', 'sialan', 'brengsek', 'kurang ajar',
    'bangke', 'bangkai', 'sompret', 'semprul', 'kunyuk', 'dongo', 'goblog', 'gblg',
    'anjir', 'anjrit', 'anjrot', 'njir', 'anjim', 'damn', 'stupid',
  ],
  MEDIUM: [
    'goblok', 'gblk', 'bangsat', 'bgst', 'bngst', 'bajingan', 'bjingan', 'keparat', 'bedebah',
    'biadab', 'laknat', 'setan', 'iblis', 'terkutuk', 'monyet', 'babi', 'anjing', 'anjeng',
    'anjg', 'ajg', 'asu', 'asw', 'jancuk', 'jancok', 'jancik', 'dancok', 'dancuk', 'diancuk',
    'jnck', 'cuk', 'cok', 'diamput', 'damput', 'jamput', 'taik', 'tai', 'tahi', 'taek', 'tae',
    'matamu', 'ndasmu', 'raimu', 'cangkemmu', 'celeng', 'kampang', 'kehed', 'banci', 'bencong',
    'shit', 'bitch', 'bastard', 'asshole', 'wtf', 'stfu', 'sange', 'sangek', 'coli', 'colmek',
    'bokep', 'jablay', 'perek', 'germo',
  ],
  HEAVY: [
    'kontol', 'kntl', 'kontl', 'memek', 'mmk', 'memk', 'ngentot', 'ngentod', 'ngntt', 'ngntd',
    'entot', 'entod', 'pepek', 'itil', 'ngewe', 'pantek', 'puki', 'pukimak', 'kimak', 'cibai',
    'lonte', 'pelacur', 'sundal', 'lacur', 'pecun', 'jembut', 'jembud', 'peler', 'pler',
    'tempik', 'heunceut', 'fuck', 'fck', 'fucking', 'motherfucker', 'dick', 'pussy', 'nigga', 'nigger',
  ],
};

/** Words that older versions seeded but caused false positives. */
const REMOVED_DEFAULT_WORDS = ['pantat'];

/**
 * Sync the global (group_id = null) default words: add missing ones, never touch admin-added words.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex('blacklist_words')
    .whereNull('group_id')
    .where('added_by', 'SYSTEM')
    .whereIn('word', REMOVED_DEFAULT_WORDS)
    .del();

  const existing = new Set(
    (await knex('blacklist_words').whereNull('group_id').select('word')).map((r: { word: string }) => r.word)
  );

  const missing = (Object.entries(DEFAULT_BLACKLIST_WORDS) as [Severity, string[]][])
    .flatMap(([severity, words]) => words.map(word => ({ word, severity })))
    .filter(w => !existing.has(w.word))
    .map(w => ({ ...w, group_id: null, added_by: 'SYSTEM' }));

  if (missing.length > 0) {
    await knex('blacklist_words').insert(missing);
  }
}
