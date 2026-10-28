/**
 * Context Analyzer — Reduces false positives in profanity detection.
 * Analyzes surrounding words to determine if a flagged word is used offensively.
 */

/**
 * Insult marker words that increase offensive probability when near a flagged word.
 */
const INSULT_MARKERS = [
  'dasar', 'emang', 'memang', 'lu', 'lo', 'kamu', 'elu', 'ente',
  'gua', 'gue', 'gw', 'bangsat', 'sial', 'brengsek', 'tai',
  'ya', 'eh', 'woy', 'woi', 'heh', 'hey', 'bego',
];

/**
 * Non-offensive context patterns that decrease offensive probability.
 */
const SAFE_PATTERNS = [
  // Animal context
  { words: ['anjing', 'kucing', 'hewan', 'binatang', 'peliharaan', 'ras', 'breeding'], related: ['anjing'] },
  { words: ['sapi', 'kambing', 'ternak', 'peternakan', 'kandang'], related: ['babi'] },
  { words: ['punya', 'saya', 'aku', 'ku', 'milik', 'lucu', 'imut', 'kecil', 'besar', 'sakit', 'makan'], related: ['anjing', 'babi', 'monyet'] },

  // General safe context
  { words: ['film', 'movie', 'lagu', 'judul', 'buku', 'game', 'acara'], related: ['*'] },
];

/**
 * Pronouns targeting others that increase offensive probability.
 */
const TARGET_PRONOUNS = ['lu', 'lo', 'kamu', 'elu', 'ente', 'dia', 'kau', 'mu', 'nya'];

export interface ContextResult {
  isOffensive: boolean;
  confidence: number; // 0.0 - 1.0
  reason: string;
}

/**
 * Analyze the context of a flagged word to determine if it's used offensively.
 *
 * @param flaggedWord The word that was flagged by the profanity detector
 * @param allWords All words in the message
 * @param flaggedIndex Index of the flagged word in allWords
 */
export function analyzeContext(
  flaggedWord: string,
  allWords: string[],
  flaggedIndex: number
): ContextResult {
  const windowSize = 3; // words before and after
  const start = Math.max(0, flaggedIndex - windowSize);
  const end = Math.min(allWords.length, flaggedIndex + windowSize + 1);
  const surroundingWords = allWords.slice(start, end).map(w => w.toLowerCase());

  let offensiveScore = 0.5; // Start neutral

  // Check for insult markers nearby
  const hasInsultMarker = surroundingWords.some(w => INSULT_MARKERS.includes(w));
  if (hasInsultMarker) {
    offensiveScore += 0.3;
  }

  // Check for target pronouns nearby
  const hasTargetPronoun = surroundingWords.some(w => TARGET_PRONOUNS.includes(w));
  if (hasTargetPronoun) {
    offensiveScore += 0.2;
  }

  // Check for safe context patterns
  for (const pattern of SAFE_PATTERNS) {
    if (!pattern.related.includes('*') && !pattern.related.includes(flaggedWord)) {
      continue;
    }
    const hasSafeContext = surroundingWords.some(w => pattern.words.includes(w));
    if (hasSafeContext) {
      offensiveScore -= 0.4;
    }
  }

  // If message is very short (1-2 words), standalone profanity is likely offensive
  if (allWords.length <= 2) {
    offensiveScore += 0.1;
  }

  // Clamp score
  offensiveScore = Math.max(0, Math.min(1, offensiveScore));

  // Threshold: 0.5+ = offensive
  const isOffensive = offensiveScore >= 0.5;

  let reason: string;
  if (isOffensive) {
    if (hasInsultMarker && hasTargetPronoun) {
      reason = 'Insult marker dan target pronoun terdeteksi';
    } else if (hasInsultMarker) {
      reason = 'Insult marker terdeteksi di sekitar kata';
    } else if (hasTargetPronoun) {
      reason = 'Kata ditujukan ke orang lain';
    } else {
      reason = 'Konteks terdeteksi sebagai ofensif';
    }
  } else {
    reason = 'Konteks terdeteksi sebagai non-ofensif';
  }

  return { isOffensive, confidence: offensiveScore, reason };
}
