/**
 * Message helpers shared by event handlers and commands.
 */
import { proto } from '@whiskeysockets/baileys';

/**
 * Get the contextInfo of a message regardless of its type.
 */
export function getContextInfo(message: proto.IMessage | null | undefined): proto.IContextInfo | undefined {
  if (!message) return undefined;
  return (
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.stickerMessage?.contextInfo ||
    message.documentMessage?.contextInfo ||
    message.audioMessage?.contextInfo ||
    undefined
  );
}
