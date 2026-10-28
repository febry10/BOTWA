import { describe, it, expect } from 'vitest';
import {
  xpForNextLevel, totalXpForLevel, levelFromXp, rankForLevel, levelChange, simulateDuel, hunt, progressBar, formatCooldown,
} from '../src/rpg/leveling.js';

describe('leveling', () => {
  it('has a consistent XP curve', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(totalXpForLevel(3)).toBe(250);
    for (let l = 1; l < 50; l++) {
      expect(totalXpForLevel(l + 1) - totalXpForLevel(l)).toBe(xpForNextLevel(l));
    }
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(250)).toBe(3);
  });

  it('maps levels to ranks and detects rank-ups', () => {
    expect(rankForLevel(1).name).toBe('Warga Baru');
    expect(rankForLevel(5).name).toBe('Anggota Aktif');
    expect(rankForLevel(100).name).toBe('Mitos');
    expect(levelChange(0, 50)).toMatchObject({ levelUp: false, rankUp: false });
    expect(levelChange(0, 100)).toMatchObject({ levelUp: true, rankUp: false, newLevel: 2 });
    expect(levelChange(totalXpForLevel(5) - 1, totalXpForLevel(5))).toMatchObject({ levelUp: true, rankUp: true });
  });

  it('simulates a duel to completion', () => {
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const result = simulateDuel(['A', 'B'], [10, 1], rng);
    expect([0, 1]).toContain(result.winner);
    expect(result.log.length).toBeGreaterThan(0);
    const wins = Array.from({ length: 200 }, () => simulateDuel(['A', 'B'], [30, 1], rng).winner === 0).filter(Boolean).length;
    expect(wins).toBeGreaterThan(150);
  });

  it('hunts and formats helpers', () => {
    expect(hunt(() => 0).text).toContain('kelinci');
    expect(hunt(() => 0.999999)).toBeDefined();
    expect(progressBar(5, 10)).toBe('▰▰▰▰▰▱▱▱▱▱');
    expect(formatCooldown(90 * 60 * 1000)).toBe('1 jam 30 menit');
  });
});
