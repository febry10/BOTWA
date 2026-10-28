import { describe, it, expect } from 'vitest';
import { matchProfanity, affixForms, collapseSpacedLetters } from '../src/moderation/profanity/detector.js';
import { DEFAULT_BLACKLIST_WORDS } from '../src/database/seeds/default_blacklist_words.js';
import type { BlacklistWord } from '../src/moderation/profanity/word-list.js';

let id = 0;
const words: BlacklistWord[] = (Object.entries(DEFAULT_BLACKLIST_WORDS) as [BlacklistWord['severity'], string[]][])
  .flatMap(([severity, list]) => list.map(word => ({ id: ++id, word, severity, group_id: null })));

const detect = (text: string) => matchProfanity(text, words);

describe('profanity matching', () => {
  it('detects plain, leet, repeated and spaced profanity', () => {
    expect(detect('dasar goblok').matchedWord).toBe('goblok');
    expect(detect('k0nt0l').matchedWord).toBe('kontol');
    expect(detect('bangsaaaat lu').matchedWord).toBe('bangsat');
    expect(detect('k o n t o l').matchedWord).toBe('kontol');
    expect(detect('a.n.j.i.n.g lu').detected).toBe(true);
  });

  it('detects words with Indonesian affixes', () => {
    expect(detect('goblokmu itu').matchedWord).toBe('goblok');
    expect(detect('dasar bangsatnya').matchedWord).toBe('bangsat');
    expect(detect('mau dientot').matchedWord).toBe('entot');
  });

  it('detects multi-word entries', () => {
    expect(detect('kamu kurang ajar ya').matchedWord).toBe('kurang ajar');
  });

  it('does not flag innocent words', () => {
    for (const text of [
      'ayo ke pantai besok', 'tolong kirim filenya', 'cukup sekian', 'ketahuan deh',
      'kontan saja bayarnya', 'aku punya anjing lucu', 'cek dulu ya', 'setengah jam lagi',
      'kon tolong ambilkan', 'asuransi kesehatan', 'pantat panci gosong',
    ]) {
      expect(detect(text).detected, text).toBe(false);
    }
  });

  it('builds affix forms only for long enough bases', () => {
    expect(affixForms('anjingnya')).toContain('anjing');
    expect(affixForms('tainya')).not.toContain('tai');
    expect(collapseSpacedLetters(['k', 'o', 'n', 'lu', 'a', 'b'])).toEqual(['kon', 'lu', 'ab']);
  });
});
