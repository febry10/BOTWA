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
  GroupMetadata,
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
const MAX_BACKOFF_MS = 60000;
const startTime = Date.now();

let latestQr: string | null = null;
let connectionState: 'connecting' | 'open' | 'close' = 'close';

const GROUP_METADATA_TTL_MS = 5 * 60 * 1000;
const groupMetadataCache = new Map<string, { data: GroupMetadata; expiresAt: number }>();

export function getConnectionInfo(): { state: 'connecting' | 'open' | 'close'; qr: string | null } {
  return { state: connectionState, qr: latestQr };
}

export function isBotJid(jid: string): boolean {
  const number = jid.replace(/@.*$/, '').replace(/:\d+/, '');
  return [sock?.user?.id, sock?.user?.lid]
    .filter((id): id is string => !!id)
    .some(id => id.replace(/@.*$/, '').replace(/:\d+/, '') === number);
}

export function invalidateGroupMetadata(groupJid: string): void {
  groupMetadataCache.delete(groupJid);
}

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
    cachedGroupMetadata: async (jid) => groupMetadataCache.get(jid)?.data,
  });

  // ── Connection Update Handler ──
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection) connectionState = connection;

    if (qr) {
      latestQr = qr;
      logger.info('QR code generated. Please scan with WhatsApp (or open /qr on the dashboard):');
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

      if (shouldReconnect) {
        retryCount++;
        const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
        logger.info({ delay, retryCount }, 'Reconnecting...');
        await new Promise(r => setTimeout(r, delay));
        await connectToWhatsApp(onMessage, onGroupParticipantsUpdate);
      } else if (statusCode === DisconnectReason.loggedOut) {
        logger.error('Bot has been logged out (401). Cleaning up session directory and generating new QR code...');
        clearSessionDirectory(sessionDir);
        retryCount = 0;
        await new Promise(r => setTimeout(r, 2000));
        await connectToWhatsApp(onMessage, onGroupParticipantsUpdate);
      }
    }

    if (connection === 'open') {
      retryCount = 0;
      latestQr = null;
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

  sock.ev.on('groups.update', (updates) => {
    for (const u of updates) {
      if (u.id) invalidateGroupMetadata(u.id);
    }
  });

  // ── Group Participants Update Handler ──
  sock.ev.on('group-participants.update', async (update) => {
    invalidateGroupMetadata(update.id);
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
export async function getGroupMetadata(groupJid: string): Promise<GroupMetadata | null> {
  const cached = groupMetadataCache.get(groupJid);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (!sock) return null;

  try {
    const data = await sock.groupMetadata(groupJid);
    groupMetadataCache.set(groupJid, { data, expiresAt: Date.now() + GROUP_METADATA_TTL_MS });
    return data;
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

  const botIds = [sock.user?.id, sock.user?.lid]
    .filter((id): id is string => !!id)
    .map(id => id.replace(/@.*$/, '').replace(/:\d+/, ''));
  if (botIds.length === 0) return false;

  return metadata.participants.some(p => {
    const ids = [p.id, p.lid, p.phoneNumber]
      .filter((id): id is string => !!id)
      .map(id => id.replace(/@.*$/, '').replace(/:\d+/, ''));
    return ids.some(id => botIds.includes(id)) && (p.admin === 'admin' || p.admin === 'superadmin');
  });
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

