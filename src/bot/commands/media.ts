/**
 * Media Commands — !dl (TikTok / IG Reels / YouTube), !ytmp3, !tts
 */
import { WAMessage, AnyMessageContent, normalizeMessageContent } from '@whiskeysockets/baileys';
import pino from 'pino';
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { getContextInfo } from '../../utils/message.js';
import { detectPlatform, downloadMedia } from '../../media/downloader.js';
import { parseTtsArgs, textToSpeech, TTS_MAX_CHARS, TTS_LANGUAGES } from '../../media/tts.js';

const logger = pino({ name: 'media-commands' });
const MAX_CONCURRENT_DOWNLOADS = 2;
let activeDownloads = 0;

async function reply(ctx: CommandContext, content: AnyMessageContent): Promise<void> {
  await ctx.sock.sendMessage(ctx.groupJid, content, { quoted: ctx.message as WAMessage });
}

async function react(ctx: CommandContext, emoji: string): Promise<void> {
  try {
    await ctx.sock.sendMessage(ctx.groupJid, { react: { text: emoji, key: ctx.message.key! } });
  } catch {
    // Reactions are cosmetic
  }
}

/**
 * URL from the command arguments, or from the replied-to message.
 */
function findUrl(ctx: CommandContext): string | null {
  const fromArgs = ctx.args.find(a => /^https?:\/\//i.test(a));
  if (fromArgs) return fromArgs;
  const quoted = normalizeMessageContent(getContextInfo(ctx.message.message)?.quotedMessage);
  const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
  return quotedText.match(/https?:\/\/\S+/i)?.[0] ?? null;
}

async function handleDownload(ctx: CommandContext, mode: 'video' | 'audio'): Promise<void> {
  const url = findUrl(ctx);
  const platform = url ? detectPlatform(url) : null;
  if (!url || !platform) {
    await reply(ctx, {
      text: mode === 'audio'
        ? '❌ Format: *!ytmp3 <link YouTube/TikTok>*'
        : '❌ Format: *!dl <link>*\nDidukung: TikTok, Instagram Reels, YouTube (maks 720p).',
    });
    return;
  }
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    await reply(ctx, { text: '⏳ Bot sedang mengunduh file lain, coba lagi sebentar.' });
    return;
  }

  activeDownloads++;
  await react(ctx, '⏳');
  try {
    const result = await downloadMedia(url, mode);
    if (mode === 'audio') {
      await reply(ctx, { audio: result.buffer, mimetype: 'audio/mpeg', fileName: `${result.title}.mp3` });
    } else {
      await reply(ctx, { video: result.buffer, mimetype: 'video/mp4', caption: `✅ ${result.title}` });
    }
    await react(ctx, '✅');
  } catch (error) {
    logger.warn({ err: error, platform }, 'Download failed');
    await react(ctx, '❌');
    const hint = platform === 'instagram'
      ? '\nInstagram sering membatasi unduhan tanpa login; pastikan Reels-nya publik.'
      : '\nPastikan link publik dan ukuran video tidak terlalu besar.';
    await reply(ctx, { text: `❌ Gagal mengunduh media.${hint}` });
  } finally {
    activeDownloads--;
  }
}

export function registerMediaCommands(): void {
  registerCommand({
    name: 'download',
    aliases: ['dl', 'tiktok', 'tt', 'ig', 'reels', 'yt', 'ytmp4'],
    description: 'Unduh video TikTok / IG Reels / YouTube',
    minRole: Role.MEMBER,
    handler: (ctx: CommandContext) => handleDownload(ctx, 'video'),
  });

  registerCommand({
    name: 'ytmp3',
    aliases: ['mp3', 'audio', 'lagu'],
    description: 'Unduh audio (mp3) dari YouTube / TikTok',
    minRole: Role.MEMBER,
    handler: (ctx: CommandContext) => handleDownload(ctx, 'audio'),
  });

  registerCommand({
    name: 'tts',
    aliases: ['say', 'suara'],
    description: 'Ubah teks jadi suara',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const { lang, text } = parseTtsArgs(ctx.args);
      if (!text) {
        await reply(ctx, {
          text: `❌ Format: *!tts teks* atau *!tts en hello*\nBahasa: ${Object.keys(TTS_LANGUAGES).join(', ')}`,
        });
        return;
      }
      if (text.length > TTS_MAX_CHARS) {
        await reply(ctx, { text: `❌ Teks terlalu panjang (maks ${TTS_MAX_CHARS} karakter).` });
        return;
      }
      try {
        const audio = await textToSpeech(text, lang);
        await reply(ctx, { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true });
      } catch (error) {
        logger.warn({ err: error }, 'TTS failed');
        await reply(ctx, { text: '❌ Gagal membuat suara. Coba lagi nanti.' });
      }
    },
  });
}
