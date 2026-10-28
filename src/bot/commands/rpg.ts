/**
 * RPG & Leveling Commands — !level, !leaderboard, !daily, !berburu, !duel, !terima, !tolak, !leveling
 */
import { WAMessage } from '@whiskeysockets/baileys';
import { registerCommand, CommandContext, getTargetJid } from './index.js';
import { Role } from '../../config/permissions.js';
import { jidToMention, jidToNumber } from '../../utils/jid.js';
import { ensureUser, ensureMembership } from '../../services/member.service.js';
import { updateGroupSetting } from '../../services/group.service.js';
import {
  getStats, addRewards, getLeaderboard, getRankPosition, getUserName, RewardResult,
} from '../../services/rpg.service.js';
import {
  rankForLevel, formatRank, progressBar, totalXpForLevel, xpForNextLevel, simulateDuel, hunt,
  formatCooldown, DAILY_COOLDOWN_MS, HUNT_COOLDOWN_MS, DUEL_COOLDOWN_MS,
} from '../../rpg/leveling.js';
import { announceLevelChange } from '../leveling.js';
import { isBotJid } from '../client.js';

const DUEL_ACCEPT_MS = 2 * 60 * 1000;
const MAX_LOG_LINES = 8;

interface PendingDuel {
  challengerJid: string;
  challengerUserId: number;
  targetUserId: number;
  bet: number;
  expiresAt: number;
}

const pendingDuels = new Map<string, PendingDuel>();
const duelCooldowns = new Map<string, number>();

async function reply(ctx: CommandContext, text: string, mentions: string[] = []): Promise<void> {
  await ctx.sock.sendMessage(ctx.groupJid, { text, mentions }, { quoted: ctx.message as WAMessage });
}

async function notifyLevel(ctx: CommandContext, jid: string, result: RewardResult): Promise<void> {
  await announceLevelChange(ctx.groupJid, jid, result, ctx.settings);
}

function rpgDisabled(ctx: CommandContext): boolean {
  return !ctx.settings.leveling.enabled;
}

async function displayName(userId: number, jid: string): Promise<string> {
  return (await getUserName(userId)) || jidToNumber(jid);
}

async function runDuel(
  ctx: CommandContext,
  challenger: { jid: string; userId: number },
  target: { jid: string; userId: number },
  bet: number
): Promise<void> {
  const [statsA, statsB] = await Promise.all([getStats(challenger.userId, ctx.groupId), getStats(target.userId, ctx.groupId)]);
  if (bet > 0 && (statsA.coins < bet || statsB.coins < bet)) {
    await reply(ctx, `❌ Koin salah satu pemain tidak cukup untuk taruhan ${bet}.`);
    return;
  }

  const names: [string, string] = [await displayName(challenger.userId, challenger.jid), await displayName(target.userId, target.jid)];
  const result = simulateDuel(names, [statsA.level, statsB.level]);
  const winner = result.winner === 0 ? challenger : target;
  const loser = result.winner === 0 ? target : challenger;

  const winReward = await addRewards(winner.userId, ctx.groupId, { xp: 30, coins: 20 + bet, wins: 1 });
  const loseReward = await addRewards(loser.userId, ctx.groupId, { xp: 10, coins: -bet, losses: 1 });

  const log = result.log.length > MAX_LOG_LINES
    ? [...result.log.slice(0, MAX_LOG_LINES - 2), '...', ...result.log.slice(-2)]
    : result.log;

  await reply(
    ctx,
    `⚔️ *DUEL* ⚔️\n${jidToMention(challenger.jid)} (Lv ${statsA.level}) vs ${jidToMention(target.jid)} (Lv ${statsB.level})` +
      `${bet > 0 ? `\n💰 Taruhan: ${bet} koin` : ''}\n\n${log.join('\n')}\n\n` +
      `🏆 Pemenang: ${jidToMention(winner.jid)} (+30 XP, +${20 + bet} koin)\n` +
      `💀 Kalah: ${jidToMention(loser.jid)} (+10 XP${bet > 0 ? `, -${bet} koin` : ''})`,
    [challenger.jid, target.jid]
  );

  await notifyLevel(ctx, winner.jid, winReward);
  await notifyLevel(ctx, loser.jid, loseReward);
}

export function registerRpgCommands(): void {
  registerCommand({
    name: 'level',
    aliases: ['lv', 'rank', 'me', 'xp'],
    description: 'Lihat level, XP, dan rank',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const targetJid = getTargetJid(ctx) ?? ctx.senderJid;
      const userId = targetJid === ctx.senderJid ? ctx.userId : await ensureUser(targetJid);
      const stats = await getStats(userId, ctx.groupId);
      const current = stats.xp - totalXpForLevel(stats.level);
      const needed = xpForNextLevel(stats.level);
      const position = await getRankPosition(ctx.groupId, stats.xp);

      await reply(
        ctx,
        `🎮 *PROFIL LEVEL*\n━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 ${jidToMention(targetJid)}\n` +
          `🏅 Rank: ${formatRank(rankForLevel(stats.level))}\n` +
          `⭐ Level: ${stats.level}\n` +
          `✨ XP: ${current}/${needed} ${progressBar(current, needed)}\n` +
          `💰 Koin: ${stats.coins}\n` +
          `💬 Pesan: ${stats.message_count}\n` +
          `⚔️ Duel: ${stats.wins} menang / ${stats.losses} kalah\n` +
          `🏆 Peringkat grup: #${position}`,
        [targetJid]
      );
    },
  });

  registerCommand({
    name: 'leaderboard',
    aliases: ['lb', 'top', 'toplevel', 'topaktif'],
    description: 'Leaderboard keaktifan grup',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const rows = await getLeaderboard(ctx.groupId, 10);
      if (rows.length === 0) {
        await reply(ctx, 'ℹ️ Belum ada data keaktifan. Ayo ngobrol dulu! 💬');
        return;
      }
      const medals = ['🥇', '🥈', '🥉'];
      const lines = rows.map((r, i) =>
        `${medals[i] ?? `${i + 1}.`} *${r.name || jidToNumber(r.wa_id)}* — Lv ${r.level} ${rankForLevel(r.level).emoji} • ${r.xp} XP • ${r.message_count} pesan`
      );
      await reply(ctx, `🏆 *LEADERBOARD KEAKTIFAN*\n━━━━━━━━━━━━━━━━━━━━\n\n${lines.join('\n')}`);
    },
  });

  registerCommand({
    name: 'daily',
    aliases: ['harian', 'klaim'],
    description: 'Klaim hadiah harian',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      if (rpgDisabled(ctx)) return void (await reply(ctx, 'ℹ️ Fitur level/RPG sedang dimatikan admin.'));
      const stats = await getStats(ctx.userId, ctx.groupId);
      const last = stats.last_daily_at ? new Date(stats.last_daily_at).getTime() : 0;
      const remaining = last + DAILY_COOLDOWN_MS - Date.now();
      if (remaining > 0) {
        await reply(ctx, `⏳ Hadiah harian sudah diklaim. Coba lagi dalam *${formatCooldown(remaining)}*.`);
        return;
      }
      const coins = 100 + Math.floor(Math.random() * 101);
      const result = await addRewards(ctx.userId, ctx.groupId, { xp: 50, coins, extra: { last_daily_at: new Date() } });
      await reply(ctx, `🎁 *HADIAH HARIAN*\n\nKamu mendapat *${coins} koin* dan *50 XP*!\n💰 Total koin: ${result.stats.coins}`);
      await notifyLevel(ctx, ctx.senderJid, result);
    },
  });

  registerCommand({
    name: 'berburu',
    aliases: ['hunt', 'adventure', 'petualang'],
    description: 'Berpetualang mencari koin & XP',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      if (rpgDisabled(ctx)) return void (await reply(ctx, 'ℹ️ Fitur level/RPG sedang dimatikan admin.'));
      const stats = await getStats(ctx.userId, ctx.groupId);
      const last = stats.last_hunt_at ? new Date(stats.last_hunt_at).getTime() : 0;
      const remaining = last + HUNT_COOLDOWN_MS - Date.now();
      if (remaining > 0) {
        await reply(ctx, `😮‍💨 Kamu masih capek. Istirahat dulu *${formatCooldown(remaining)}* lagi.`);
        return;
      }
      const outcome = hunt();
      const result = await addRewards(ctx.userId, ctx.groupId, { xp: outcome.xp, coins: outcome.coins, extra: { last_hunt_at: new Date() } });
      const coinText = outcome.coins >= 0 ? `+${outcome.coins}` : `${outcome.coins}`;
      await reply(ctx, `🏹 *BERBURU*\n\nKamu ${outcome.text}!\n${coinText} koin • +${outcome.xp} XP\n💰 Total koin: ${result.stats.coins}`);
      await notifyLevel(ctx, ctx.senderJid, result);
    },
  });

  registerCommand({
    name: 'duel',
    aliases: ['battle', 'fight', 'tarung'],
    description: 'Duel simulasi dengan member lain',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      if (rpgDisabled(ctx)) return void (await reply(ctx, 'ℹ️ Fitur level/RPG sedang dimatikan admin.'));
      const targetJid = getTargetJid(ctx);
      if (!targetJid) {
        await reply(ctx, '❌ Format: *!duel @user* atau *!duel @user 50* (taruhan koin)');
        return;
      }
      if (jidToNumber(targetJid) === jidToNumber(ctx.senderJid) || isBotJid(targetJid)) {
        await reply(ctx, '❌ Pilih lawan member lain.');
        return;
      }

      const cooldownKey = `${ctx.groupJid}:${jidToNumber(ctx.senderJid)}`;
      const cooldownUntil = duelCooldowns.get(cooldownKey) ?? 0;
      if (cooldownUntil > Date.now()) {
        await reply(ctx, `⏳ Tunggu *${formatCooldown(cooldownUntil - Date.now())}* sebelum duel lagi.`);
        return;
      }

      const bet = Math.max(0, parseInt(ctx.args.find(a => /^\d+$/.test(a)) ?? '0', 10));
      const targetUserId = await ensureUser(targetJid);
      await ensureMembership(targetUserId, ctx.groupId);
      duelCooldowns.set(cooldownKey, Date.now() + DUEL_COOLDOWN_MS);

      if (bet === 0) {
        await runDuel(ctx, { jid: ctx.senderJid, userId: ctx.userId }, { jid: targetJid, userId: targetUserId }, 0);
        return;
      }

      const stats = await getStats(ctx.userId, ctx.groupId);
      if (stats.coins < bet) {
        duelCooldowns.delete(cooldownKey);
        await reply(ctx, `❌ Koin kamu tidak cukup (punya ${stats.coins}).`);
        return;
      }
      pendingDuels.set(`${ctx.groupJid}:${jidToNumber(targetJid)}`, {
        challengerJid: ctx.senderJid,
        challengerUserId: ctx.userId,
        targetUserId,
        bet,
        expiresAt: Date.now() + DUEL_ACCEPT_MS,
      });
      await reply(
        ctx,
        `⚔️ ${jidToMention(ctx.senderJid)} menantang ${jidToMention(targetJid)} duel dengan taruhan *${bet} koin*!\n\n` +
          `Ketik *!terima* untuk menerima atau *!tolak* untuk menolak (2 menit).`,
        [ctx.senderJid, targetJid]
      );
    },
  });

  registerCommand({
    name: 'terima',
    aliases: ['accept'],
    description: 'Terima tantangan duel',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const key = `${ctx.groupJid}:${jidToNumber(ctx.senderJid)}`;
      const pending = pendingDuels.get(key);
      pendingDuels.delete(key);
      if (!pending || pending.expiresAt < Date.now()) {
        await reply(ctx, 'ℹ️ Tidak ada tantangan duel untukmu.');
        return;
      }
      await runDuel(
        ctx,
        { jid: pending.challengerJid, userId: pending.challengerUserId },
        { jid: ctx.senderJid, userId: ctx.userId },
        pending.bet
      );
    },
  });

  registerCommand({
    name: 'tolak',
    aliases: ['decline'],
    description: 'Tolak tantangan duel',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const key = `${ctx.groupJid}:${jidToNumber(ctx.senderJid)}`;
      const pending = pendingDuels.get(key);
      pendingDuels.delete(key);
      if (!pending || pending.expiresAt < Date.now()) {
        await reply(ctx, 'ℹ️ Tidak ada tantangan duel untukmu.');
        return;
      }
      await reply(ctx, `🏳️ ${jidToMention(ctx.senderJid)} menolak tantangan ${jidToMention(pending.challengerJid)}.`, [ctx.senderJid, pending.challengerJid]);
    },
  });

  registerCommand({
    name: 'leveling',
    aliases: [],
    description: 'Atur fitur level/RPG (on/off/silent)',
    minRole: Role.ADMIN,
    handler: async (ctx: CommandContext) => {
      const mode = ctx.args[0]?.toLowerCase();
      if (mode === 'on') {
        await updateGroupSetting(ctx.groupId, 'leveling.enabled', true);
        await updateGroupSetting(ctx.groupId, 'leveling.announce', true);
        await reply(ctx, '✅ Leveling & RPG aktif. Bot akan mengumumkan saat member naik level/rank.');
      } else if (mode === 'silent') {
        await updateGroupSetting(ctx.groupId, 'leveling.enabled', true);
        await updateGroupSetting(ctx.groupId, 'leveling.announce', false);
        await reply(ctx, '✅ Leveling aktif tanpa pengumuman naik level.');
      } else if (mode === 'off') {
        await updateGroupSetting(ctx.groupId, 'leveling.enabled', false);
        await reply(ctx, '✅ Leveling & RPG dimatikan.');
      } else {
        await reply(ctx, '❌ Format: *!leveling on* | *!leveling silent* | *!leveling off*');
      }
    },
  });
}
