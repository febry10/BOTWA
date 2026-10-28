/**
 * Sticker Commands — !sticker, !toimg, !take, !ttp
 */
import { downloadMediaMessage, normalizeMessageContent, proto, WAMessage, AnyMessageContent } from '@whiskeysockets/baileys';
import pino from 'pino';
import { registerCommand, CommandContext } from './index.js';
import { Role } from '../../config/permissions.js';
import { config } from '../../config/index.js';
import { getContextInfo } from '../../utils/message.js';
import {
  imageToSticker,
  videoToSticker,
  addStickerMetadata,
  stickerToImage,
  textToSticker,
  parseStickerMetadata,
  StickerMetadata,
} from '../../media/sticker.js';

const logger = pino({ name: 'sticker-commands' });

const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 30;

type MediaKind = 'image' | 'video' | 'sticker';

interface TargetMedia {
  kind: MediaKind;
  message: WAMessage;
  content: proto.IMessage;
}

function mediaKind(content: proto.IMessage | undefined): MediaKind | null {
  if (!content) return null;
  if (content.imageMessage) return 'image';
  if (content.videoMessage) return 'video';
  if (content.stickerMessage) return 'sticker';
  if (content.documentMessage?.mimetype?.startsWith('image/')) return 'image';
  if (content.documentMessage?.mimetype?.startsWith('video/')) return 'video';
  return null;
}

/**
 * Find the media to process: media attached to the command message itself, or the replied-to message.
 */
export function findTargetMedia(message: proto.IWebMessageInfo, groupJid: string): TargetMedia | null {
  const own = normalizeMessageContent(message.message);
  const ownKind = mediaKind(own);
  if (own && ownKind) return { kind: ownKind, message: message as WAMessage, content: own };

  const ctxInfo = getContextInfo(own);
  const quoted = normalizeMessageContent(ctxInfo?.quotedMessage);
  const quotedKind = mediaKind(quoted);
  if (!quoted || !quotedKind || !ctxInfo) return null;

  return {
    kind: quotedKind,
    content: quoted,
    message: {
      key: { remoteJid: groupJid, id: ctxInfo.stanzaId, participant: ctxInfo.participant, fromMe: false },
      message: quoted,
    } as WAMessage,
  };
}

function mediaInfo(content: proto.IMessage): { size: number; seconds: number } {
  const media = content.imageMessage || content.videoMessage || content.stickerMessage || content.documentMessage;
  return {
    size: Number(media?.fileLength ?? 0),
    seconds: content.videoMessage?.seconds ?? 0,
  };
}

async function download(ctx: CommandContext, target: TargetMedia): Promise<Buffer> {
  return downloadMediaMessage(target.message, 'buffer', {}, {
    logger: logger as any,
    reuploadRequest: ctx.sock.updateMediaMessage,
  }) as Promise<Buffer>;
}

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

function defaultMetadata(ctx: CommandContext): StickerMetadata {
  return { pack: config.bot.name, author: ctx.message.pushName || 'Bot' };
}

export function registerStickerCommands(): void {
  registerCommand({
    name: 'sticker',
    aliases: ['s', 'stiker', 'stk'],
    description: 'Ubah gambar/GIF/video jadi stiker',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const target = findTargetMedia(ctx.message, ctx.groupJid);
      if (!target) {
        await reply(ctx, {
          text: '❌ Kirim gambar/GIF/video dengan caption *!sticker*, atau reply media dengan *!sticker*.\n\nOpsional: *!sticker NamaPack|Author*',
        });
        return;
      }

      const { size, seconds } = mediaInfo(target.content);
      if (size > MAX_MEDIA_BYTES) {
        await reply(ctx, { text: '❌ Ukuran file terlalu besar (maks 15 MB).' });
        return;
      }
      if (target.kind === 'video' && seconds > MAX_VIDEO_SECONDS) {
        await reply(ctx, { text: `❌ Video terlalu panjang (maks ${MAX_VIDEO_SECONDS} detik). Stiker hanya mengambil 8 detik pertama.` });
        return;
      }

      await react(ctx, '⏳');
      try {
        const media = await download(ctx, target);
        let webp: Buffer;
        if (target.kind === 'sticker') webp = media;
        else if (target.kind === 'video') webp = await videoToSticker(media);
        else webp = await imageToSticker(media);

        const meta = parseStickerMetadata(ctx.args.join(' '), defaultMetadata(ctx));
        await reply(ctx, { sticker: await addStickerMetadata(webp, meta) });
        await react(ctx, '✅');
      } catch (error) {
        logger.error({ error }, 'Failed to create sticker');
        await react(ctx, '❌');
        await reply(ctx, { text: '❌ Gagal membuat stiker. Coba media lain.' });
      }
    },
  });

  registerCommand({
    name: 'toimg',
    aliases: ['toimage', 'togambar'],
    description: 'Ubah stiker jadi gambar',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const target = findTargetMedia(ctx.message, ctx.groupJid);
      if (!target || target.kind !== 'sticker') {
        await reply(ctx, { text: '❌ Reply stiker dengan *!toimg*.' });
        return;
      }

      try {
        const webp = await download(ctx, target);
        const png = await stickerToImage(webp);
        const animated = !!target.content.stickerMessage?.isAnimated;
        await reply(ctx, { image: png, caption: animated ? '✅ Stiker animasi → gambar (frame pertama)' : '✅ Stiker → gambar' });
      } catch (error) {
        logger.error({ error }, 'Failed to convert sticker to image');
        await reply(ctx, { text: '❌ Gagal mengubah stiker jadi gambar.' });
      }
    },
  });

  registerCommand({
    name: 'take',
    aliases: ['wm', 'colong'],
    description: 'Ganti nama pack/author stiker',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const target = findTargetMedia(ctx.message, ctx.groupJid);
      if (!target || target.kind !== 'sticker') {
        await reply(ctx, { text: '❌ Reply stiker dengan *!take NamaPack|Author*.' });
        return;
      }

      try {
        const webp = await download(ctx, target);
        const meta = parseStickerMetadata(ctx.args.join(' '), defaultMetadata(ctx));
        await reply(ctx, { sticker: await addStickerMetadata(webp, meta) });
      } catch (error) {
        logger.error({ error }, 'Failed to retag sticker');
        await reply(ctx, { text: '❌ Gagal mengganti nama pack stiker.' });
      }
    },
  });

  registerCommand({
    name: 'ttp',
    aliases: ['textsticker'],
    description: 'Ubah teks jadi stiker',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      const text = ctx.args.join(' ').trim();
      if (!text) {
        await reply(ctx, { text: '❌ Format: *!ttp teks kamu*' });
        return;
      }
      if (text.length > 100) {
        await reply(ctx, { text: '❌ Teks terlalu panjang (maks 100 karakter).' });
        return;
      }

      try {
        const webp = await textToSticker(text);
        await reply(ctx, { sticker: await addStickerMetadata(webp, defaultMetadata(ctx)) });
      } catch (error) {
        logger.error({ error }, 'Failed to create text sticker');
        await reply(ctx, { text: '❌ Gagal membuat stiker teks.' });
      }
    },
  });
}
