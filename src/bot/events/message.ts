/**
 * Message Event Handler — Processes incoming messages through command system and moderation pipeline.
 */
import { WASocket, proto, normalizeMessageContent } from '@whiskeysockets/baileys';
import { isGroupJid } from '../../utils/jid.js';
import { getContextInfo } from '../../utils/message.js';
import { ensureGroup, getGroupSettings } from '../../services/group.service.js';
import { ensureUser, ensureMembership } from '../../services/member.service.js';
import { logMessageAction } from '../../services/logging.service.js';
import { checkMuteStatus } from '../../services/mute.service.js';
import { handleCommand, initializeCommands } from '../commands/index.js';
import { runModerationPipeline, ModerationContext } from '../handlers/index.js';
import { Role } from '../../config/permissions.js';
import { resolveRole } from '../roles.js';
import pino from 'pino';

const logger = pino({ name: 'message-event' });

let commandsInitialized = false;

/**
 * Extract text content from a message.
 */
export function extractText(message: proto.IMessage | null | undefined): string {
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
  return getContextInfo(message)?.mentionedJid || [];
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

  // Unwrap ephemeral / view-once wrappers
  const content = normalizeMessageContent(msg.message);
  if (!content) return;

  // Skip protocol/reaction messages
  if (content.protocolMessage || content.reactionMessage) return;

  const senderJid = msg.key?.participant || msg.key?.remoteJid;
  if (!senderJid) return;

  const text = extractText(content);
  const mentionedJids = extractMentionedJids(content);
  const messageType = getMessageType(content);

  // Ensure group and user exist in database
  const groupId = await ensureGroup(remoteJid);
  const userId = await ensureUser(senderJid, msg.pushName || undefined);
  await ensureMembership(userId, groupId);

  // Get group settings
  const settings = await getGroupSettings(groupId);

  // Resolve user role
  let userRole = Role.MEMBER;
  try {
    userRole = await resolveRole(remoteJid, senderJid, userId, groupId);
  } catch (error) {
    logger.debug({ error }, 'Failed to resolve role');
  }

  // Log the message (action=NONE for normal messages)
  await logMessageAction(groupId, userId, messageType, text, 'NONE', null);

  // ── Step 1: Try to handle as a command (muted members cannot use commands) ──
  if (text) {
    const muted = userRole < Role.MODERATOR && (await checkMuteStatus(userId, groupId)).muted;
    if (!muted) {
      const normalizedMsg: proto.IWebMessageInfo = { ...msg, message: content };
      const isCommand = await handleCommand(
        sock, normalizedMsg, remoteJid, senderJid,
        userId, groupId, userRole,
        text, mentionedJids, settings
      );

      if (isCommand) return; // Command handled, skip moderation
    }
  }

  // ── Step 2: Run moderation pipeline (also for media so mutes/blacklists are enforced) ──
  const ctx: ModerationContext = {
    sock,
    message: msg,
    groupJid: remoteJid,
    senderJid,
    userId,
    groupId,
    userRole,
    text,
    messageType,
    mentions: mentionedJids,
    settings,
  };

  await runModerationPipeline(ctx);
}
