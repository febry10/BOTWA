/**
 * Role resolution — combines DB roles with live WhatsApp group admin status.
 */
import { Role } from '../config/permissions.js';
import { getUserRole, updateMemberRole } from '../services/member.service.js';
import { getGroupMetadata } from './client.js';
import { jidToNumber } from '../utils/jid.js';

/**
 * Resolve a user's effective role in a group.
 * WhatsApp group admins are always at least ADMIN (creator = OWNER), and the DB is synced.
 */
export async function resolveRole(
  groupJid: string,
  userJid: string,
  userId: number,
  groupId: number
): Promise<Role> {
  const dbRole = await getUserRole(userId, groupId);

  const metadata = await getGroupMetadata(groupJid);
  if (!metadata) return dbRole;

  const userNumber = jidToNumber(userJid);
  const participant = metadata.participants.find(p =>
    [p.id, p.lid, p.phoneNumber].some(id => id && jidToNumber(id) === userNumber)
  );
  if (!participant) return dbRole;

  if (participant.admin === 'superadmin') {
    if (dbRole !== Role.OWNER) await updateMemberRole(userId, groupId, 'OWNER');
    return Role.OWNER;
  }
  if (participant.admin === 'admin') {
    if (dbRole < Role.ADMIN) {
      await updateMemberRole(userId, groupId, 'ADMIN');
      return Role.ADMIN;
    }
    return dbRole;
  }
  return dbRole;
}
