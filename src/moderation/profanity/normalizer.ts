/**
 * Text Normalizer — Converts leet speak, special characters, and spacing tricks
 * to standard text for profanity detection.
 */

/**
 * Character substitution map for leet speak normalization.
 */
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '@': 'a',
  '$': 's',
  '!': 'i',
  '+': 't',
  '|': 'i',
  '(': 'c',
  ')': 'j',
  '<': 'c',
  '{': 'c',
  '}': 'j',
};

/**
 * Normalize text for profanity detection.
 * Handles: leet speak, spacing, special chars, repeated chars, uppercase.
 */
export function normalizeText(input: string): string[] {
  // Generate multiple normalized variants to check
  const variants: string[] = [];

  // Variant 1: Lowercase, strip all non-alphanumeric
  const stripped = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (stripped.length > 0) variants.push(stripped);

  // Variant 2: Leet speak conversion
  const leetConverted = input
    .toLowerCase()
    .split('')
    .map(c => LEET_MAP[c] || c)
    .join('')
    .replace(/[^a-z]/g, '');
  if (leetConverted.length > 0 && leetConverted !== stripped) {
    variants.push(leetConverted);
  }

  // Variant 3: Remove repeated characters (e.g., "goobblookk" → "goblok")
  const deduped = stripped.replace(/(.)\1+/g, '$1');
  if (deduped.length > 0 && !variants.includes(deduped)) {
    variants.push(deduped);
  }

  // Variant 4: Leet + dedup
  const leetDeduped = leetConverted.replace(/(.)\1+/g, '$1');
  if (leetDeduped.length > 0 && !variants.includes(leetDeduped)) {
    variants.push(leetDeduped);
  }

  // Variant 5: Remove spaces and dots between chars
  const noSep = input.toLowerCase().replace(/[\s.\-_,;:]/g, '');
  const noSepClean = noSep.replace(/[^a-z0-9]/g, '');
  if (noSepClean.length > 0 && !variants.includes(noSepClean)) {
    variants.push(noSepClean);
  }

  // Variant 6: No separator + leet
  const noSepLeet = noSep
    .split('')
    .map(c => LEET_MAP[c] || c)
    .join('')
    .replace(/[^a-z]/g, '');
  if (noSepLeet.length > 0 && !variants.includes(noSepLeet)) {
    variants.push(noSepLeet);
  }

  return variants;
}

/**
 * Extract individual words from text, preserving potential multi-word profanity.
 */
export function extractWords(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[\s,.!?;:]+/)
    .filter(w => w.length > 0);
}

/**
 * Normalize a single word for comparison.
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .split('')
    .map(c => LEET_MAP[c] || c)
    .join('')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1');
}
