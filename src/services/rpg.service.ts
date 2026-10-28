/**
 * RPG Service — Per-group XP, levels, coins and duel records.
 */
import { getDb } from '../database/connection.js';
import { levelChange, LevelChange, messageXp, MESSAGE_XP_COOLDOWN_MS } from '../rpg/leveling.js';

export interface UserStats {
  id: number;
  user_id: number;
  group_id: number;
  xp: number;
  level: number;
  coins: number;
  message_count: number;
  wins: number;
  losses: number;
  last_xp_at: Date | null;
  last_daily_at: Date | null;
  last_hunt_at: Date | null;
}

export interface Rewards {
  xp?: number;
  coins?: number;
  wins?: number;
  losses?: number;
  messages?: number;
  extra?: Partial<Pick<UserStats, 'last_xp_at' | 'last_daily_at' | 'last_hunt_at'>>;
}

export type RewardResult = LevelChange & { stats: UserStats };

export async function getStats(userId: number, groupId: number): Promise<UserStats> {
  const db = getDb();
  await db('user_stats').insert({ user_id: userId, group_id: groupId }).onConflict(['user_id', 'group_id']).ignore();
  return db('user_stats').where({ user_id: userId, group_id: groupId }).first();
}

async function applyRewards(stats: UserStats, r: Rewards): Promise<RewardResult> {
  const db = getDb();
  const newXp = Math.max(0, stats.xp + (r.xp ?? 0));
  const change = levelChange(stats.xp, newXp);
  const update = {
    xp: newXp,
    level: change.newLevel,
    coins: Math.max(0, stats.coins + (r.coins ?? 0)),
    wins: stats.wins + (r.wins ?? 0),
    losses: stats.losses + (r.losses ?? 0),
    message_count: stats.message_count + (r.messages ?? 0),
    ...r.extra,
    updated_at: new Date(),
  };
  await db('user_stats').where({ id: stats.id }).update(update);
  return { ...change, stats: { ...stats, ...update } };
}

export async function addRewards(userId: number, groupId: number, rewards: Rewards): Promise<RewardResult> {
  return applyRewards(await getStats(userId, groupId), rewards);
}

/**
 * Award XP for a chat message. Returns null while the per-user cooldown is active (only counts the message).
 */
export async function awardMessageXp(userId: number, groupId: number, now = new Date()): Promise<RewardResult | null> {
  const stats = await getStats(userId, groupId);
  if (stats.last_xp_at && now.getTime() - new Date(stats.last_xp_at).getTime() < MESSAGE_XP_COOLDOWN_MS) {
    await getDb()('user_stats').where({ id: stats.id }).increment('message_count', 1);
    return null;
  }
  return applyRewards(stats, { xp: messageXp(), coins: 1, messages: 1, extra: { last_xp_at: now } });
}

export async function getLeaderboard(groupId: number, limit = 10): Promise<Array<{
  user_id: number; wa_id: string; name: string | null; xp: number; level: number; message_count: number;
}>> {
  return getDb()('user_stats')
    .join('users', 'users.id', '=', 'user_stats.user_id')
    .where('user_stats.group_id', groupId)
    .andWhere('user_stats.xp', '>', 0)
    .orderBy('user_stats.xp', 'desc')
    .limit(limit)
    .select('user_stats.user_id', 'users.wa_id', 'users.name', 'user_stats.xp', 'user_stats.level', 'user_stats.message_count');
}

export async function getRankPosition(groupId: number, xp: number): Promise<number> {
  const res = await getDb()('user_stats').where('group_id', groupId).andWhere('xp', '>', xp).count('id as count').first();
  return parseInt(String(res?.count ?? '0'), 10) + 1;
}

export async function getUserName(userId: number): Promise<string | null> {
  const user = await getDb()('users').where({ id: userId }).first('name');
  return user?.name ?? null;
}
