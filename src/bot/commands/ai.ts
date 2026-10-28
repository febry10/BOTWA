/**
 * AI Chat Commands — !ai, !resetai, plus replies when the bot is mentioned or replied to.
 */
import { WAMessage, WASocket, proto } from '@whiskeysockets/baileys';
import pino from 'pino';
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { askAi, clearHistory, isAiConfigured } from '../../ai/chat.js';

const logger = pino({ name: 'ai-chat' });

function stripMentions(text: string): string {
  return text.replace(/@\d+/g, '').trim();
}

/**
 * Answer a message with the AI and reply in the group.
 */
export async function replyWithAi(
  sock: WASocket,
  message: proto.IWebMessageInfo,
  groupJid: string,
  senderJid: string,
  text: string
): Promise<void> {
  const quoted = { quoted: message as WAMessage };
  if (!isAiConfigured()) {
    await sock.sendMessage(groupJid, { text: 'ℹ️ Fitur AI belum aktif. Admin bot perlu mengisi GEMINI_API_KEY (atau OPENAI_API_KEY) di file .env.' }, quoted);
    return;
  }

  const prompt = stripMentions(text);
  if (!prompt) {
    await sock.sendMessage(groupJid, { text: 'Hai! Ada yang mau diobrolin? 😄' }, quoted);
    return;
  }

  try {
    await sock.sendPresenceUpdate('composing', groupJid);
    const answer = await askAi(`${groupJid}:${senderJid}`, message.pushName || 'Teman', prompt);
    await sock.sendMessage(groupJid, { text: answer }, quoted);
  } catch (error) {
    logger.error({ err: error }, 'AI request failed');
    await sock.sendMessage(groupJid, { text: '😵 Maaf, otak AI-ku lagi error. Coba lagi sebentar ya.' }, quoted);
  } finally {
    await sock.sendPresenceUpdate('paused', groupJid).catch(() => undefined);
  }
}

export function registerAiCommands(): void {
  registerCommand({
    name: 'ai',
    aliases: ['bot', 'tanya', 'chat'],
    description: 'Ngobrol dengan AI',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      await replyWithAi(ctx.sock, ctx.message, ctx.groupJid, ctx.senderJid, ctx.args.join(' '));
    },
  });

  registerCommand({
    name: 'resetai',
    aliases: ['lupakan'],
    description: 'Hapus riwayat obrolan AI',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      clearHistory(`${ctx.groupJid}:${ctx.senderJid}`);
      await ctx.sock.sendMessage(ctx.groupJid, { text: '🧹 Oke, obrolan kita sebelumnya sudah aku lupakan.' }, { quoted: ctx.message as WAMessage });
    },
  });
}
