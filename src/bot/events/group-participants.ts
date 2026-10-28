/**
 * Group Participants Update Handler — Welcome/goodbye messages and member tracking.
 */
import { WASocket } from '@whiskeysockets/baileys';
import { ensureGroup, getGroupSettings } from '../../services/group.service.js';
import { ensureUser, ensureMembership, removeMember, updateMemberRole } from '../../services/member.service.js';
import { isBlacklisted } from '../../services/member.service.js';
import { sendMessage, removeParticipant, getGroupMetadata } from '../client.js';
import { renderTemplate } from '../../messages/index.js';
import { jidToMention } from '../../utils/jid.js';
import { formatDate } from '../../utils/time.js';
import { logAdminAction } from '../../services/logging.service.js';
import pino from 'pino';

const logger = pino({ name: 'group-participants' });

export interface GroupParticipantsUpdate {
  id: string;           // Group JID
  participants: string[]; // Participant JIDs
  action: 'add' | 'remove' | 'promote' | 'demote' | string;
}

/**
 * Handle group participants updates (join/leave/promote/demote).
 */
export async function handleGroupParticipantsUpdate(
  sock: WASocket,
  update: GroupParticipantsUpdate
): Promise<void> {
  const { id: groupJid, participants, action } = update;

  try {
    const groupId = await ensureGroup(groupJid);
    const settings = await getGroupSettings(groupId);

    for (const participantJid of participants) {
      try {
        switch (action) {
          case 'add':
            await handleMemberJoin(sock, groupJid, groupId, participantJid, settings);
            break;

          case 'remove':
            await handleMemberLeave(sock, groupJid, groupId, participantJid, settings);
            break;

          case 'promote':
            await handleMemberPromote(groupId, participantJid);
            break;

          case 'demote':
            await handleMemberDemote(groupId, participantJid);
            break;
        }
      } catch (error) {
        logger.error({ error, participantJid, action }, 'Error handling participant update');
      }
    }
  } catch (error) {
    logger.error({ error, groupJid, action }, 'Error handling group participants update');
  }
}

/**
 * Handle a new member joining.
 */
async function handleMemberJoin(
  sock: WASocket,
  groupJid: string,
  groupId: number,
  participantJid: string,
  settings: any
): Promise<void> {
  const userId = await ensureUser(participantJid);
  await ensureMembership(userId, groupId);

  // Check if user is blacklisted
  const blacklisted = await isBlacklisted(userId, groupId);
  if (blacklisted) {
    logger.info({ userId, groupId }, 'Blacklisted user attempted to join, removing');
    await removeParticipant(groupJid, participantJid);
    return;
  }

  // Send welcome message
  if (settings.welcome?.enabled) {
    const metadata = await getGroupMetadata(groupJid);
    const groupName = metadata?.subject || 'Grup';
    const memberCount = metadata?.participants?.length || 0;

    const welcomeTemplate = settings.welcome.message || '🎉 Selamat datang {user} di *{group}*!';
    const mention = jidToMention(participantJid);

    const msg = renderTemplate(welcomeTemplate, {
      user: mention,
      name: mention,
      group: groupName,
      members: String(memberCount),
      date: formatDate(new Date()),
    });

    await sendMessage(groupJid, msg, [participantJid]);
  }

  logger.info({ userId, groupId, participantJid }, 'Member joined');
}

/**
 * Handle a member leaving.
 */
async function handleMemberLeave(
  sock: WASocket,
  groupJid: string,
  groupId: number,
  participantJid: string,
  settings: any
): Promise<void> {
  const userId = await ensureUser(participantJid);

  // Send goodbye message
  if (settings.goodbye?.enabled) {
    const goodbyeTemplate = settings.goodbye.message || '👋 {user} telah keluar dari grup.';
    const mention = jidToMention(participantJid);

    const msg = renderTemplate(goodbyeTemplate, {
      user: mention,
      name: mention,
    });

    await sendMessage(groupJid, msg, [participantJid]);
  }

  // Remove membership record
  await removeMember(userId, groupId);

  logger.info({ userId, groupId, participantJid }, 'Member left');
}

/**
 * Handle a member being promoted to admin.
 */
async function handleMemberPromote(groupId: number, participantJid: string): Promise<void> {
  const userId = await ensureUser(participantJid);
  await updateMemberRole(userId, groupId, 'ADMIN');
  logger.info({ userId, groupId, participantJid }, 'Member promoted to admin');
}

/**
 * Handle an admin being demoted to member.
 */
async function handleMemberDemote(groupId: number, participantJid: string): Promise<void> {
  const userId = await ensureUser(participantJid);
  await updateMemberRole(userId, groupId, 'MEMBER');
  logger.info({ userId, groupId, participantJid }, 'Admin demoted to member');
}
