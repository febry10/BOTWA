/**
 * Profanity Detector — Multi-layer detection with normalization and context analysis.
 */
import { normalizeText, extractWords, normalizeWord } from './normalizer.js';
import { analyzeContext, ContextResult } from './context-analyzer.js';
import { getBlacklistWords, BlacklistWord } from './word-list.js';

export interface ProfanityResult {
  detected: boolean;
  matchedWord: string | null;
  originalWord: string | null;
  severity: 'LIGHT' | 'MEDIUM' | 'HEAVY' | null;
  context: ContextResult | null;
}

const CONTEXT_SENSITIVE_WORDS = new Set(['anjing', 'babi', 'monyet', 'setan', 'iblis']);

// Common Indonesian affixes attached to insults (e.g. "anjingnya", "dientot", "goblokmu")
const SUFFIXES = ['nya', 'lah', 'kah', 'kan', 'mu', 'ku', 'lu', 'lo', 'loe', 'in', 'an'];
const PREFIXES = ['nge', 'ng', 'di', 'ke', 'se'];
const MIN_AFFIX_BASE = 4;

/**
 * Join runs of single-character tokens ("k o n t o l" / "k.o.n.t.o.l") into one word.
 */
export function collapseSpacedLetters(words: string[]): string[] {
  const result: string[] = [];
  let run = '';
  for (const word of words) {
    if (word.length === 1) {
      run += word;
      continue;
    }
    if (run) { result.push(run); run = ''; }
    result.push(word);
  }
  if (run) result.push(run);
  return result;
}

/**
 * Forms of a normalized word with common affixes removed.
 */
export function affixForms(word: string): string[] {
  const forms = new Set([word]);
  const stripSuffix = (w: string) => {
    for (const s of SUFFIXES) {
      if (w.endsWith(s) && w.length - s.length >= MIN_AFFIX_BASE) forms.add(w.slice(0, -s.length));
    }
  };
  stripSuffix(word);
  for (const p of PREFIXES) {
    if (word.startsWith(p) && word.length - p.length >= MIN_AFFIX_BASE) {
      const base = word.slice(p.length);
      forms.add(base);
      stripSuffix(base);
    }
  }
  return [...forms];
}

/**
 * Check a message for profanity.
 * Matches single words (with leetspeak/repeat/affix normalization) and 2-3 word phrases.
 * `allowedWords` lets a group exempt default words.
 */
export async function detectProfanity(
  text: string,
  groupId: number | null = null,
  allowedWords: string[] = []
): Promise<ProfanityResult> {
  const noResult: ProfanityResult = {
    detected: false,
    matchedWord: null,
    originalWord: null,
    severity: null,
    context: null,
  };

  if (!text || text.trim().length === 0) return noResult;

  const allowed = new Set(allowedWords.map(w => w.toLowerCase()));
  const blacklistWords = (await getBlacklistWords(groupId)).filter(bw => !allowed.has(bw.word.toLowerCase()));
  if (blacklistWords.length === 0) return noResult;

  return matchProfanity(text, blacklistWords);
}

/**
 * Pure matching logic (exported for tests).
 */
export function matchProfanity(text: string, blacklistWords: BlacklistWord[]): ProfanityResult {
  const noResult: ProfanityResult = { detected: false, matchedWord: null, originalWord: null, severity: null, context: null };

  const normalizedBlacklist = new Map<string, BlacklistWord>();
  for (const bw of blacklistWords) {
    normalizedBlacklist.set(bw.word.toLowerCase().replace(/[^a-z0-9]/g, ''), bw);
    normalizedBlacklist.set(normalizeWord(bw.word), bw);
  }

  const words = collapseSpacedLetters(extractWords(text));

  // Candidate tokens: single words plus 2- and 3-word phrases (for entries like "kurang ajar")
  const candidates: Array<{ token: string; index: number }> = [];
  for (let i = 0; i < words.length; i++) {
    candidates.push({ token: words[i], index: i });
    if (i + 1 < words.length) candidates.push({ token: words[i] + words[i + 1], index: i });
    if (i + 2 < words.length) candidates.push({ token: words[i] + words[i + 1] + words[i + 2], index: i });
  }

  for (const { token, index } of candidates) {
    for (const variant of normalizeText(token)) {
      for (const form of affixForms(variant)) {
        const matched = normalizedBlacklist.get(form);
        if (!matched) continue;

        if (CONTEXT_SENSITIVE_WORDS.has(matched.word.toLowerCase())) {
          const contextResult = analyzeContext(matched.word, words, index);
          if (!contextResult.isOffensive) continue;
          return { detected: true, matchedWord: matched.word, originalWord: token, severity: matched.severity, context: contextResult };
        }

        return { detected: true, matchedWord: matched.word, originalWord: token, severity: matched.severity, context: null };
      }
    }
  }

  return noResult;
}
