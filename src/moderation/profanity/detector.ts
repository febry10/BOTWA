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

/**
 * Check a message for profanity.
 * Uses three-layer detection: exact match → normalized match → context analysis.
 */
export async function detectProfanity(
  text: string,
  groupId: number | null = null
): Promise<ProfanityResult> {
  const noResult: ProfanityResult = {
    detected: false,
    matchedWord: null,
    originalWord: null,
    severity: null,
    context: null,
  };

  if (!text || text.trim().length === 0) return noResult;

  const blacklistWords = await getBlacklistWords(groupId);
  if (blacklistWords.length === 0) return noResult;

  // Build a set of normalized blacklist words mapped to their entries
  const normalizedBlacklist = new Map<string, BlacklistWord>();
  for (const bw of blacklistWords) {
    const normalized = normalizeWord(bw.word);
    normalizedBlacklist.set(normalized, bw);
    // Also add the raw lowercase version
    normalizedBlacklist.set(bw.word.toLowerCase(), bw);
  }

  // Extract words from the message
  const words = extractWords(text);

  // Check each word
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const normalizedVariants = normalizeText(word);

    for (const variant of normalizedVariants) {
      const matched = normalizedBlacklist.get(variant);
      if (matched) {
        // Found a match — now check context for certain words
        const contextSensitiveWords = ['anjing', 'babi', 'monyet', 'setan', 'iblis'];
        const needsContext = contextSensitiveWords.includes(matched.word.toLowerCase());

        if (needsContext) {
          const contextResult = analyzeContext(matched.word, words, i);
          if (!contextResult.isOffensive) {
            // Context says it's not offensive — skip
            continue;
          }
          return {
            detected: true,
            matchedWord: matched.word,
            originalWord: word,
            severity: matched.severity,
            context: contextResult,
          };
        }

        // Not context-sensitive — direct match = violation
        return {
          detected: true,
          matchedWord: matched.word,
          originalWord: word,
          severity: matched.severity,
          context: null,
        };
      }
    }
  }

  // Also check full-text normalized variants for multi-word profanity
  const fullTextVariants = normalizeText(text);
  for (const variant of fullTextVariants) {
    for (const [normalizedBw, bw] of normalizedBlacklist) {
      if (normalizedBw.length >= 3 && variant.includes(normalizedBw)) {
        // Found substring match — check if it's a standalone word or embedded
        // To avoid false positives, require the match to be significant portion of a word
        const idx = variant.indexOf(normalizedBw);
        const before = idx > 0 ? variant[idx - 1] : '';
        const after = idx + normalizedBw.length < variant.length ? variant[idx + normalizedBw.length] : '';

        // Only flag if it's at a word boundary (simple heuristic)
        // or if the blacklisted word is the entire variant
        if (variant === normalizedBw || normalizedBw.length >= variant.length * 0.6) {
          return {
            detected: true,
            matchedWord: bw.word,
            originalWord: text,
            severity: bw.severity,
            context: null,
          };
        }
      }
    }
  }

  return noResult;
}
