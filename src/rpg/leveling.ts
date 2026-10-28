/**
 * Leveling & RPG — pure game logic (XP curve, ranks, duels, hunting).
 */
export type Rng = () => number;

export const MESSAGE_XP_COOLDOWN_MS = 60 * 1000;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const HUNT_COOLDOWN_MS = 10 * 60 * 1000;
export const DUEL_COOLDOWN_MS = 3 * 60 * 1000;

/** XP needed to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

/** Total XP needed to reach `level` from zero. */
export function totalXpForLevel(level: number): number {
  const n = Math.max(level - 1, 0);
  return 100 * n + 25 * n * (n - 1);
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= totalXpForLevel(level + 1)) level++;
  return level;
}

export interface Rank {
  minLevel: number;
  name: string;
  emoji: string;
}

export const RANKS: Rank[] = [
  { minLevel: 1, name: 'Warga Baru', emoji: '🌱' },
  { minLevel: 5, name: 'Anggota Aktif', emoji: '🌿' },
  { minLevel: 10, name: 'Petualang', emoji: '🧭' },
  { minLevel: 15, name: 'Pejuang', emoji: '⚔️' },
  { minLevel: 20, name: 'Ksatria', emoji: '🛡️' },
  { minLevel: 30, name: 'Jagoan', emoji: '🔥' },
  { minLevel: 40, name: 'Master', emoji: '💎' },
  { minLevel: 50, name: 'Legenda', emoji: '👑' },
  { minLevel: 75, name: 'Mitos', emoji: '🐉' },
];

export function rankForLevel(level: number): Rank {
  let rank = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) rank = r;
  return rank;
}

export function formatRank(rank: Rank): string {
  return `${rank.emoji} ${rank.name}`;
}

export function progressBar(current: number, total: number, width = 10): string {
  const filled = total > 0 ? Math.min(width, Math.max(0, Math.round((current / total) * width))) : 0;
  return '▰'.repeat(filled) + '▱'.repeat(width - filled);
}

/** XP gained per (non-cooldown) chat message. */
export function messageXp(rng: Rng = Math.random): number {
  return 5 + Math.floor(rng() * 11);
}

export interface LevelChange {
  oldLevel: number;
  newLevel: number;
  levelUp: boolean;
  rankUp: boolean;
}

export function levelChange(oldXp: number, newXp: number): LevelChange {
  const oldLevel = levelFromXp(oldXp);
  const newLevel = levelFromXp(newXp);
  return {
    oldLevel,
    newLevel,
    levelUp: newLevel > oldLevel,
    rankUp: rankForLevel(newLevel).minLevel > rankForLevel(oldLevel).minLevel,
  };
}

// ── Duel ──

export interface FighterStats {
  hp: number;
  atk: number;
  def: number;
}

export function fighterStats(level: number): FighterStats {
  return { hp: 100 + level * 10, atk: 12 + level * 2, def: 4 + level };
}

export interface DuelResult {
  winner: 0 | 1;
  log: string[];
  remainingHp: [number, number];
}

/**
 * Simulate a turn-based duel between two fighters. Higher level helps but upsets are possible.
 */
export function simulateDuel(
  names: [string, string],
  levels: [number, number],
  rng: Rng = Math.random,
  maxRounds = 20
): DuelResult {
  const stats = [fighterStats(levels[0]), fighterStats(levels[1])];
  const hp: [number, number] = [stats[0].hp, stats[1].hp];
  const log: string[] = [];
  let attacker: 0 | 1 = rng() < 0.5 ? 0 : 1;

  for (let round = 0; round < maxRounds && hp[0] > 0 && hp[1] > 0; round++) {
    const defender: 0 | 1 = attacker === 0 ? 1 : 0;
    if (rng() < 0.1) {
      log.push(`💨 ${names[defender]} menghindari serangan ${names[attacker]}!`);
    } else {
      const crit = rng() < 0.15;
      const base = stats[attacker].atk * (0.8 + rng() * 0.4) - stats[defender].def * 0.5;
      const damage = Math.max(1, Math.round(base * (crit ? 1.8 : 1)));
      hp[defender] = Math.max(0, hp[defender] - damage);
      log.push(`${crit ? '💥 KRITIS! ' : '⚔️ '}${names[attacker]} → ${names[defender]} -${damage} HP (${hp[defender]})`);
    }
    attacker = defender;
  }

  let winner: 0 | 1;
  if (hp[0] <= 0) winner = 1;
  else if (hp[1] <= 0) winner = 0;
  else winner = hp[0] / stats[0].hp >= hp[1] / stats[1].hp ? 0 : 1;

  return { winner, log, remainingHp: hp };
}

// ── Hunting ──

export interface HuntOutcome {
  text: string;
  coins: number;
  xp: number;
}

const HUNT_OUTCOMES: Array<HuntOutcome & { weight: number }> = [
  { text: 'menangkap kelinci 🐇', coins: 15, xp: 10, weight: 25 },
  { text: 'menemukan peti harta karun 💰', coins: 80, xp: 25, weight: 6 },
  { text: 'mengalahkan serigala 🐺', coins: 40, xp: 30, weight: 15 },
  { text: 'memancing ikan besar 🐟', coins: 25, xp: 15, weight: 20 },
  { text: 'menemukan permata langka 💎', coins: 150, xp: 40, weight: 2 },
  { text: 'mengalahkan naga kecil 🐉', coins: 120, xp: 60, weight: 2 },
  { text: 'tersesat di hutan dan pulang dengan tangan kosong 🌲', coins: 0, xp: 5, weight: 15 },
  { text: 'dikejar beruang dan menjatuhkan dompet 🐻', coins: -20, xp: 5, weight: 10 },
  { text: 'membantu petani dan diberi upah 🌾', coins: 30, xp: 20, weight: 5 },
];

export function hunt(rng: Rng = Math.random): HuntOutcome {
  const total = HUNT_OUTCOMES.reduce((s, o) => s + o.weight, 0);
  let roll = rng() * total;
  for (const o of HUNT_OUTCOMES) {
    roll -= o.weight;
    if (roll < 0) return { text: o.text, coins: o.coins, xp: o.xp };
  }
  const last = HUNT_OUTCOMES[HUNT_OUTCOMES.length - 1];
  return { text: last.text, coins: last.coins, xp: last.xp };
}

export function formatCooldown(ms: number): string {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} jam ${minutes} menit`;
  return `${minutes} menit`;
}
