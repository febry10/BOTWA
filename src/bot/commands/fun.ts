/**
 * Fun Commands — games and entertainment for groups.
 */
import { WAMessage } from '@whiskeysockets/baileys';
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { getGroupMetadata } from '../client.js';
import { jidToMention, jidToNumber } from '../../utils/jid.js';
import {
  pickRandom,
  rollDice,
  flipCoin,
  parseChoices,
  seededPercent,
  compatibility,
  compatibilityComment,
  APAKAH_ANSWERS,
  KAPAN_ANSWERS,
  TRUTHS,
  DARES,
  QUOTES,
} from '../../fun/games.js';

async function reply(ctx: CommandContext, text: string, mentions: string[] = []): Promise<void> {
  await ctx.sock.sendMessage(ctx.groupJid, { text, mentions }, { quoted: ctx.message as WAMessage });
}

/**
 * Get all group member JIDs except the bot itself.
 */
async function getMembers(ctx: CommandContext): Promise<string[]> {
  const metadata = await getGroupMetadata(ctx.groupJid);
  if (!metadata) return [];
  const botIds = [ctx.sock.user?.id, ctx.sock.user?.lid].filter((id): id is string => !!id).map(jidToNumber);
  return metadata.participants
    .filter(p => ![p.id, p.lid, p.phoneNumber].some(id => id && botIds.includes(jidToNumber(id))))
    .map(p => p.id);
}

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function registerFunCommands(): void {
  registerCommand({
    name: 'dadu',
    aliases: ['dice', 'roll'],
    description: 'Lempar dadu',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const rolls = rollDice(parseInt(ctx.args[0] || '1', 10));
      const total = rolls.reduce((a, b) => a + b, 0);
      const faces = rolls.map(r => `${DICE_FACES[r]} ${r}`).join('  ');
      await reply(ctx, `🎲 *Lempar Dadu*\n\n${faces}${rolls.length > 1 ? `\n\nTotal: *${total}*` : ''}`);
    },
  });

  registerCommand({
    name: 'coinflip',
    aliases: ['koin', 'flip'],
    description: 'Lempar koin',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      await reply(ctx, `🪙 Koin dilempar... hasilnya *${flipCoin()}*!`);
    },
  });

  registerCommand({
    name: 'pilih',
    aliases: ['choose'],
    description: 'Pilihkan secara acak',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const choices = parseChoices(ctx.args.join(' '));
      if (choices.length < 2) {
        await reply(ctx, '❌ Format: *!pilih bakso, mie ayam, nasi goreng*');
        return;
      }
      await reply(ctx, `🤔 Dari ${choices.length} pilihan, aku pilih: *${pickRandom(choices)}*`);
    },
  });

  registerCommand({
    name: 'truth',
    aliases: [],
    description: 'Pertanyaan truth',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      await reply(ctx, `🫣 *TRUTH* untuk ${jidToMention(ctx.senderJid)}\n\n${pickRandom(TRUTHS)}`, [ctx.senderJid]);
    },
  });

  registerCommand({
    name: 'dare',
    aliases: [],
    description: 'Tantangan dare',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      await reply(ctx, `🔥 *DARE* untuk ${jidToMention(ctx.senderJid)}\n\n${pickRandom(DARES)}`, [ctx.senderJid]);
    },
  });

  registerCommand({
    name: 'jodoh',
    aliases: ['ship', 'cocok'],
    description: 'Cek kecocokan dua orang',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      let [a, b] = ctx.mentionedJids;
      if (a && !b) b = ctx.senderJid;
      if (!a) {
        const members = await getMembers(ctx);
        if (members.length < 2) {
          await reply(ctx, '❌ Member grup tidak cukup.');
          return;
        }
        a = ctx.senderJid;
        b = pickRandom(members.filter(m => jidToNumber(m) !== jidToNumber(ctx.senderJid)));
      }
      const score = compatibility(jidToNumber(a), jidToNumber(b));
      const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
      await reply(
        ctx,
        `💘 *Cek Jodoh*\n\n${jidToMention(a)} ❤️ ${jidToMention(b)}\n\n${bar} *${score}%*\n${compatibilityComment(score)}`,
        [a, b]
      );
    },
  });

  registerCommand({
    name: 'siapa',
    aliases: ['who'],
    description: 'Tunjuk member acak',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const question = ctx.args.join(' ').trim();
      if (!question) {
        await reply(ctx, '❌ Format: *!siapa yang paling rajin?*');
        return;
      }
      const members = await getMembers(ctx);
      if (members.length === 0) {
        await reply(ctx, '❌ Tidak bisa membaca member grup.');
        return;
      }
      const chosen = pickRandom(members);
      await reply(ctx, `🫵 *Siapa ${question}*\n\nJawabannya: ${jidToMention(chosen)}`, [chosen]);
    },
  });

  registerCommand({
    name: 'rate',
    aliases: ['nilai'],
    description: 'Beri nilai 0-100',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const target = ctx.mentionedJids[0];
      const subject = target ? jidToNumber(target) : ctx.args.join(' ').trim();
      if (!subject) {
        await reply(ctx, '❌ Format: *!rate wajahku* atau *!rate @user*');
        return;
      }
      const label = target ? jidToMention(target) : `*${subject}*`;
      await reply(ctx, `📊 Nilai untuk ${label}: *${seededPercent(subject)}/100*`, target ? [target] : []);
    },
  });

  registerCommand({
    name: 'apakah',
    aliases: [],
    description: 'Tanya kerang ajaib',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const question = ctx.args.join(' ').trim();
      if (!question) {
        await reply(ctx, '❌ Format: *!apakah aku ganteng?*');
        return;
      }
      await reply(ctx, `🐚 *Apakah ${question}*\n\nJawaban: *${pickRandom(APAKAH_ANSWERS)}*`);
    },
  });

  registerCommand({
    name: 'kapan',
    aliases: ['when'],
    description: 'Ramalan waktu',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const question = ctx.args.join(' ').trim();
      if (!question) {
        await reply(ctx, '❌ Format: *!kapan aku kaya?*');
        return;
      }
      await reply(ctx, `🔮 *Kapan ${question}*\n\nJawaban: *${pickRandom(KAPAN_ANSWERS)}*`);
    },
  });

  registerCommand({
    name: 'quote',
    aliases: ['quotes', 'motivasi'],
    description: 'Kata-kata hari ini',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      await reply(ctx, `💬 _${pickRandom(QUOTES)}_`);
    },
  });

  registerCommand({
    name: 'tagall',
    aliases: ['everyone', 'all'],
    description: 'Tag semua member',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const members = await getMembers(ctx);
      if (members.length === 0) {
        await reply(ctx, '❌ Tidak bisa membaca member grup.');
        return;
      }
      const note = ctx.args.join(' ').trim();
      const list = members.map(m => `• ${jidToMention(m)}`).join('\n');
      await ctx.sock.sendMessage(ctx.groupJid, {
        text: `📢 *TAG ALL*${note ? `\n\n${note}` : ''}\n\n${list}`,
        mentions: members,
      });
    },
  });

  registerCommand({
    name: 'hidetag',
    aliases: ['ht'],
    description: 'Tag semua member tanpa terlihat',
    minRole: Role.MODERATOR,
    handler: async (ctx: CommandContext) => {
      const members = await getMembers(ctx);
      if (members.length === 0) {
        await reply(ctx, '❌ Tidak bisa membaca member grup.');
        return;
      }
      await ctx.sock.sendMessage(ctx.groupJid, {
        text: ctx.args.join(' ').trim() || '📢',
        mentions: members,
      });
    },
  });
}
