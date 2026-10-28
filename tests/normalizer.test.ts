/**
 * Profanity normalizer unit tests.
 */
import { normalizeText, extractWords, normalizeWord } from '../src/moderation/profanity/normalizer.js';

describe('Text Normalizer', () => {
  describe('normalizeText', () => {
    it('should strip non-alphanumeric characters', () => {
      const variants = normalizeText('h-e-l-l-o');
      expect(variants).toContain('hello');
    });

    it('should convert leet speak', () => {
      const variants = normalizeText('4nj1ng');
      const hasExpected = variants.some(v => v.includes('anjing'));
      expect(hasExpected).toBe(true);
    });

    it('should deduplicate repeated characters', () => {
      const variants = normalizeText('goobblookk');
      const hasDeduped = variants.some(v => v === 'goblok');
      expect(hasDeduped).toBe(true);
    });

    it('should handle mixed leet and spacing', () => {
      const variants = normalizeText('b.4.b.1');
      const hasExpected = variants.some(v => v.includes('babi'));
      expect(hasExpected).toBe(true);
    });

    it('should return empty array for empty input', () => {
      const variants = normalizeText('');
      expect(variants.length).toBe(0);
    });
  });

  describe('extractWords', () => {
    it('should split on whitespace and punctuation', () => {
      const words = extractWords('Hello, world! How are you?');
      expect(words).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    it('should filter empty strings', () => {
      const words = extractWords('  spaced   out  ');
      expect(words).toEqual(['spaced', 'out']);
    });
  });

  describe('normalizeWord', () => {
    it('should normalize a single word', () => {
      expect(normalizeWord('4nj1ng')).toBe('anjing');
    });

    it('should deduplicate repeated characters', () => {
      expect(normalizeWord('gooblookk')).toBe('goblok');
    });

    it('should handle mixed case', () => {
      expect(normalizeWord('AnJiNg')).toBe('anjing');
    });
  });
});
