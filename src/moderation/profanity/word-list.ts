/**
 * Word List Manager — Loads and manages profanity word lists from database.
 */
import { getDb } from '../../database/connection.js';

export interface BlacklistWord {
  id: number;
  word: string;
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY';
  group_id: number | null;
}

// In-memory cache for word lists
const wordCache = new Map<string, { words: BlacklistWord[]; expiresAt: number }>();
const CACHE_TTL = 120000; // 2 minutes

/**
 * Get all blacklisted words for a group (including global words).
 */
export async function getBlacklistWords(groupId: number | null): Promise<BlacklistWord[]> {
  const cacheKey = `words_${groupId || 'global'}`;
  const cached = wordCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.words;
  }

  const db = getDb();
  const words = await db('blacklist_words')
    .where(function () {
      this.whereNull('group_id'); // Global words
      if (groupId) {
        this.orWhere('group_id', groupId); // Group-specific words
      }
    })
    .select('id', 'word', 'severity', 'group_id');

  wordCache.set(cacheKey, { words, expiresAt: Date.now() + CACHE_TTL });
  return words;
}

/**
 * Add a word to the blacklist.
 */
export async function addBlacklistWord(
  word: string,
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'MEDIUM',
  groupId: number | null = null,
  addedBy: string | null = null
): Promise<boolean> {
  const db = getDb();

  const existing = await db('blacklist_words')
    .where({ word: word.toLowerCase(), group_id: groupId })
    .first();

  if (existing) return false;

  await db('blacklist_words').insert({
    word: word.toLowerCase(),
    severity,
    group_id: groupId,
    added_by: addedBy,
  });

  // Invalidate cache
  wordCache.delete(`words_${groupId || 'global'}`);
  return true;
}

/**
 * Remove a word from the blacklist.
 */
export async function removeBlacklistWord(word: string, groupId: number | null = null): Promise<boolean> {
  const db = getDb();
  const deleted = await db('blacklist_words')
    .where({ word: word.toLowerCase() })
    .andWhere(function () {
      if (groupId) {
        this.where('group_id', groupId);
      } else {
        this.whereNull('group_id');
      }
    })
    .del();

  // Invalidate cache
  wordCache.delete(`words_${groupId || 'global'}`);
  return deleted > 0;
}

/**
 * Invalidate the word list cache (e.g., after adding/removing words).
 */
export function invalidateWordCache(groupId?: number): void {
  if (groupId) {
    wordCache.delete(`words_${groupId}`);
  }
  wordCache.delete('words_global');
}
