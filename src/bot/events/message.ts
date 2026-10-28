/**
 * Message Event Handler — Processes incoming messages through command system and moderation pipeline.
 */
import { WASocket, proto } from '@whiskeysockets/baileys';
import { isGroupJid } from '../../utils/jid.js';
import { ensureGroup, getGroupSettings } from '../../services/group.service.js';
import { ensureUser, ensureMembership, getUserRole } from '../../services/member.service.js';
import { logMessageAction } from '../../services/logging.service.js';
import { handleCommand, initializeCommands } from '../commands/index.js';
import { runModerationPipeline, ModerationContext } from '../handlers/index.js';
import { Role } from '../../config/permissions.js';
import { getGroupMetadata } from '../client.js';
import pino from 'pino';

const logger = pino({ name: 'message-event' });

let commandsInitialized = false;

/**
 * Extract text content from a message.
 */
function extractText(message: proto.IMessage | null | undefined): string {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ''
  );
}

/**
 * Extract mentioned JIDs from a message.
 */
function extractMentionedJids(message: proto.IMessage | null | undefined): string[] {
  if (!message) return [];
  const ctx = message.extendedTextMessage?.contextInfo;
  return ctx?.mentionedJid || [];
}

/**
 * Get the message type string.
 */
function getMessageType(message: proto.IMessage | null | undefined): string {
  if (!message) return 'unknown';
  if (message.conversation || message.extendedTextMessage) return 'text';
  if (message.imageMessage) return 'image';
  if (message.videoMessage) return 'video';
  if (message.audioMessage) return 'audio';
  if (message.stickerMessage) return 'sticker';
  if (message.documentMessage) return 'document';
  if (message.contactMessage) return 'contact';
  if (message.locationMessage) return 'location';
  return 'other';
}

/**
 * Determine the user's role based on WhatsApp group metadata.
 */
async function resolveRole(
  sock: WASocket,
  senderJid: string,
  groupJid: string,
  dbUserId: number,
  dbGroupId: number
): Promise<Role> {
  // First check database role
  const dbRole = await getUserRole(dbUserId, dbGroupId);
  if (dbRole > Role.MEMBER) return dbRole;

  // Fall back to WhatsApp group metadata
  try {
    const metadata = await getGroupMetadata(groupJid);
    if (!metadata) return Role.MEMBER;

    const senderNumber = senderJid.replace(/@.*$/, '').replace(/:\d+/, '');
    const participant = metadata.participants.find(
      p => p.id.replace(/@.*$/, '').replace(/:\d+/, '') === senderNumber
    );

    if (!participant) return Role.MEMBER;

    if (participant.admin === 'superadmin') {
      // Update DB role
      const { updateMemberRole } = await import('../../services/member.service.js');
      await updateMemberRole(dbUserId, dbGroupId, 'OWNER');
      return Role.OWNER;
    }
    if (participant.admin === 'admin') {
      const { updateMemberRole } = await import('../../services/member.service.js');
      await updateMemberRole(dbUserId, dbGroupId, 'ADMIN');
      return Role.ADMIN;
    }
  } catch (error) {
    logger.debug({ error }, 'Failed to resolve role from metadata');
  }

  return Role.MEMBER;
}

/**
 * Handle incoming messages.
 */
export async function handleMessages(
  sock: WASocket,
  messages: proto.IWebMessageInfo[]
): Promise<void> {
  // Initialize commands once
  if (!commandsInitialized) {
    initializeCommands();
    commandsInitialized = true;
  }

  for (const msg of messages) {
    try {
      await processMessage(sock, msg);
    } catch (error) {
      logger.error({ error, messageId: msg.key?.id }, 'Error processing message');
    }
  }
}

/**
 * Process a single message.
 */
async function processMessage(sock: WASocket, msg: proto.IWebMessageInfo): Promise<void> {
  const remoteJid = msg.key?.remoteJid;
  if (!remoteJid) return;

  // Only process group messages
  if (!isGroupJid(remoteJid)) return;

  // Skip bot's own messages
  if (msg.key?.fromMe) return;

  // Skip protocol messages (status updates, reactions, etc.)
  if (!msg.message) return;

  const senderJid = msg.key?.participant || msg.key?.remoteJid;
  if (!senderJid) return;

  const text = extractText(msg.message);
  const mentionedJids = extractMentionedJids(msg.message);
  const messageType = getMessageType(msg.message);

  // Ensure group and user exist in database
  const groupId = await ensureGroup(remoteJid);
  const userId = await ensureUser(senderJid, msg.pushName || undefined);
  await ensureMembership(userId, groupId);

  // Get group settings
  const settings = await getGroupSettings(groupId);

  // Resolve user role
  const userRole = await resolveRole(sock, senderJid, remoteJid, userId, groupId);

  // Log the message (action=NONE for normal messages)
  await logMessageAction(groupId, userId, messageType, text, 'NONE', null);

  // ── Step 1: Try to handle as a command ──
  if (text && text.length > 0) {
    const isCommand = await handleCommand(
      sock, msg, remoteJid, senderJid,
      userId, groupId, userRole,
      text, mentionedJids, settings
    );

    if (isCommand) return; // Command handled, skip moderation
  }

  // ── Step 2: Run moderation pipeline ──
  if (text && text.length > 0) {
    const ctx: ModerationContext = {
      sock,
      message: msg,
      groupJid: remoteJid,
      senderJid,
      userId,
      groupId,
      userRole,
      text,
      mentions: mentionedJids,
      settings,
    };

    await runModerationPipeline(ctx);
  }
}
