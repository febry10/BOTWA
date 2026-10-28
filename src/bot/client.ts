/**
 * WhatsApp Bot Client using Baileys.
 * Handles connection, reconnection, and session management.
 */
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  proto,
  WAMessageKey,
  Browsers,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

import qrcode from 'qrcode-terminal';

const logger = pino({ level: config.logging.level, name: 'wa-client' });

let sock: WASocket | null = null;
let retryCount = 0;
const MAX_RETRIES = 5;
const startTime = Date.now();

/**
 * Get the WhatsApp socket instance.
 */
export function getSocket(): WASocket | null {
  return sock;
}

/**
 * Get bot uptime in milliseconds.
 */
export function getUptime(): number {
  return Date.now() - startTime;
}

/**
 * Initialize and connect to WhatsApp.
 */
export async function connectToWhatsApp(
  onMessage: (sock: WASocket, messages: proto.IWebMessageInfo[]) => Promise<void>,
  onGroupParticipantsUpdate: (sock: WASocket, update: {
    id: string;
    participants: string[];
    action: 'add' | 'remove' | 'promote' | 'demote' | string;
  }) => Promise<void>,
): Promise<WASocket> {
  const sessionDir = path.resolve(config.whatsapp.sessionDir);

  // Ensure session directory exists
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  let state: any;
  let saveCreds: any;

  try {
    const auth = await useMultiFileAuthState(sessionDir);
    state = auth.state;
    saveCreds = auth.saveCreds;
  } catch (err) {
    logger.error({ err }, 'Failed to load auth state. Cleaning session directory for fresh login...');
    clearSessionDirectory(sessionDir);
    const auth = await useMultiFileAuthState(sessionDir);
    state = auth.state;
    saveCreds = auth.saveCreds;
  }

  const { version } = await fetchLatestBaileysVersion();

  logger.info({ version }, 'Connecting to WhatsApp');

  sock = makeWASocket({
    version,
    browser: Browsers.ubuntu('Chrome'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
  });

  // ── Connection Update Handler ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info('QR code generated. Please scan with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const error = (lastDisconnect?.error as Boom)?.output;
      const statusCode = error?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { statusCode, shouldReconnect, retryCount },
        'Connection closed'
      );

      if (shouldReconnect && retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
        logger.info({ delay, retryCount }, 'Reconnecting...');
        await new Promise(r => setTimeout(r, delay));
        await connectToWhatsApp(onMessage, onGroupParticipantsUpdate);
      } else if (statusCode === DisconnectReason.loggedOut) {
        logger.error('Bot has been logged out (401). Cleaning up session directory and generating new QR code...');
        clearSessionDirectory(sessionDir);
        retryCount = 0;
        await new Promise(r => setTimeout(r, 2000));
        await connectToWhatsApp(onMessage, onGroupParticipantsUpdate);
      } else {
        logger.error({ retryCount, MAX_RETRIES }, 'Max retries reached. Please restart the bot manually.');
      }
    }

    if (connection === 'open') {
      retryCount = 0;
      logger.info('Connected to WhatsApp successfully!');
    }
  });

  // ── Credentials Update Handler ──
  sock.ev.on('creds.update', saveCreds);

  // ── Message Handler ──
  sock.ev.on('messages.upsert', async (upsert) => {
    if (upsert.type !== 'notify') return;

    try {
      await onMessage(sock!, upsert.messages);
    } catch (error) {
      logger.error({ error }, 'Error processing messages');
    }
  });

  // ── Group Participants Update Handler ──
  sock.ev.on('group-participants.update', async (update) => {
    try {
      await onGroupParticipantsUpdate(sock!, {
        id: update.id,
        participants: update.participants.map(p => (typeof p === 'string' ? p : (p as any).id)),
        action: update.action,
      });
    } catch (error) {
      logger.error({ error }, 'Error processing group participants update');
    }
  });

  return sock;
}

/**
 * Send a text message to a chat.
 */
export async function sendMessage(
  jid: string,
  text: string,
  mentions?: string[]
): Promise<proto.IWebMessageInfo | undefined> {
  if (!sock) {
    logger.error('Cannot send message: socket not initialized');
    return undefined;
  }

  try {
    const msg = await sock.sendMessage(jid, {
      text,
      mentions: mentions || [],
    });
    return (msg as proto.IWebMessageInfo) || undefined;
  } catch (error) {
    logger.error({ error, jid }, 'Failed to send message');
    return undefined;
  }
}

/**
 * Delete a message (for everyone, if bot is admin).
 */
export async function deleteMessage(
  jid: string,
  messageKey: WAMessageKey
): Promise<boolean> {
  if (!sock) {
    logger.error('Cannot delete message: socket not initialized');
    return false;
  }

  try {
    await sock.sendMessage(jid, { delete: messageKey });
    return true;
  } catch (error) {
    logger.error({ error, jid, messageKey }, 'Failed to delete message');
    return false;
  }
}

/**
 * Remove a participant from a group.
 */
export async function removeParticipant(
  groupJid: string,
  participantJid: string
): Promise<boolean> {
  if (!sock) return false;

  try {
    await sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove');
    return true;
  } catch (error) {
    logger.error({ error, groupJid, participantJid }, 'Failed to remove participant');
    return false;
  }
}

/**
 * Promote a participant to admin.
 */
export async function promoteParticipant(
  groupJid: string,
  participantJid: string
): Promise<boolean> {
  if (!sock) return false;

  try {
    await sock.groupParticipantsUpdate(groupJid, [participantJid], 'promote');
    return true;
  } catch (error) {
    logger.error({ error, groupJid, participantJid }, 'Failed to promote participant');
    return false;
  }
}

/**
 * Demote an admin to regular participant.
 */
export async function demoteParticipant(
  groupJid: string,
  participantJid: string
): Promise<boolean> {
  if (!sock) return false;

  try {
    await sock.groupParticipantsUpdate(groupJid, [participantJid], 'demote');
    return true;
  } catch (error) {
    logger.error({ error, groupJid, participantJid }, 'Failed to demote participant');
    return false;
  }
}

/**
 * Get group metadata (name, participants, admins, etc.).
 */
export async function getGroupMetadata(groupJid: string) {
  if (!sock) return null;

  try {
    return await sock.groupMetadata(groupJid);
  } catch (error) {
    logger.error({ error, groupJid }, 'Failed to get group metadata');
    return null;
  }
}

/**
 * Check if the bot is an admin in a group.
 */
export async function isBotAdmin(groupJid: string): Promise<boolean> {
  const metadata = await getGroupMetadata(groupJid);
  if (!metadata || !sock) return false;

  const botJid = sock.user?.id;
  if (!botJid) return false;

  const botNumber = botJid.replace(/@.*$/, '').replace(/:\d+/, '');
  return metadata.participants.some(
    p => p.id.replace(/@.*$/, '').replace(/:\d+/, '') === botNumber &&
         (p.admin === 'admin' || p.admin === 'superadmin')
  );
}

/**
 * Gracefully disconnect the bot.
 */
export async function disconnectBot(): Promise<void> {
  if (sock) {
    sock.end(undefined);
    sock = null;
    logger.info('Bot disconnected');
  }
}

/**
 * Safely remove all session files to allow fresh QR authentication.
 */
export function clearSessionDirectory(sessionDir: string): void {
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });
    logger.info({ sessionDir }, 'Session directory cleared successfully');
  } catch (error) {
    logger.error({ error, sessionDir }, 'Failed to clear session directory');
  }
}

