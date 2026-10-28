/**
 * Level-up announcements — only sent when a member levels up or reaches a new rank.
 */
import { GroupSettings } from '../config/defaults.js';
import { LevelChange, rankForLevel, formatRank } from '../rpg/leveling.js';
import { jidToMention } from '../utils/jid.js';
import { sendMessage } from './client.js';

export async function announceLevelChange(
  groupJid: string,
  userJid: string,
  change: LevelChange,
  settings: GroupSettings
): Promise<void> {
  if (!change.levelUp || !settings.leveling.announce) return;

  const mention = jidToMention(userJid);
  const rank = formatRank(rankForLevel(change.newLevel));
  const text = change.rankUp
    ? `🎉 *RANK BARU!*\n\nSelamat ${mention}! Kamu naik ke *Level ${change.newLevel}* dan meraih rank *${rank}* 🥳`
    : `⬆️ *LEVEL UP!*\n\n${mention} naik ke *Level ${change.newLevel}* (${rank}). Terus aktif ya! 💪`;
  await sendMessage(groupJid, text, [userJid]);
}
