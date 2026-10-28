import { describe, it, expect } from 'vitest';
import {
  pickRandom, rollDice, flipCoin, parseChoices, seededPercent, compatibility, compatibilityComment,
} from '../src/fun/games.js';

describe('fun games', () => {
  it('picks using the rng', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c');
  });

  it('rolls dice within bounds and clamps count', () => {
    expect(rollDice(3, () => 0)).toEqual([1, 1, 1]);
    expect(rollDice(1, () => 0.999)).toEqual([6]);
    expect(rollDice(100).length).toBe(10);
    expect(rollDice(NaN).length).toBe(1);
  });

  it('flips a coin', () => {
    expect(flipCoin(() => 0.1)).toBe('Kepala');
    expect(flipCoin(() => 0.9)).toBe('Ekor');
  });

  it('parses choices', () => {
    expect(parseChoices('bakso, mie ayam, nasi goreng')).toEqual(['bakso', 'mie ayam', 'nasi goreng']);
    expect(parseChoices('tidur atau main')).toEqual(['tidur', 'main']);
    expect(parseChoices('a | b')).toEqual(['a', 'b']);
  });

  it('gives deterministic scores', () => {
    const s = seededPercent('Wajahku');
    expect(s).toBe(seededPercent('wajahku '));
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(compatibility('1', '2')).toBe(compatibility('2', '1'));
    expect(compatibilityComment(95)).toContain('Jodoh');
  });
});
