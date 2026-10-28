/**
 * Profile Commands — !profile @user, !mutestatus
 */
import { registerCommand, CommandContext } from './index.js';
import { Role, roleToString } from '../../config/permissions.js';
import { sendMessage } from '../client.js';
import { renderTemplate } from '../../messages/index.js';
import { COMMAND_MESSAGES } from '../../messages/commands.js';
import { ERROR_MESSAGES } from '../../messages/errors.js';
import { jidToMention } from '../../utils/jid.js';
import { ensureUser, getUserProfile } from '../../services/member.service.js';
import { formatTimestamp } from '../../utils/time.js';
import { parseRole } from '../../config/permissions.js';

export function registerProfileCommands(): void {
  registerCommand({
    name: 'profile',
    aliases: ['profil'],
    description: 'Profil moderasi user',
    minRole: Role.MEMBER,
    handler: async (ctx: CommandContext) => {
      // If no mention, show own profile
      const targetJid = ctx.mentionedJids[0] || ctx.senderJid;
      const targetUserId = await ensureUser(targetJid);
      const profile = await getUserProfile(targetUserId, ctx.groupId);

      const mention = jidToMention(targetJid);
      const msg = renderTemplate(COMMAND_MESSAGES.profile, {
        user: mention,
        role: roleToString(parseRole(profile.role)),
        warnings: String(profile.warnings),
        violations: String(profile.violations),
        muted: profile.muted ? '🔇 Ya' : '❌ Tidak',
        muteUntil: profile.muteUntil
          ? formatTimestamp(new Date(profile.muteUntil))
          : '-',
        blacklisted: profile.blacklisted ? '🚫 Ya' : '❌ Tidak',
        joined: profile.joined
          ? formatTimestamp(new Date(profile.joined))
          : 'Tidak diketahui',
        lastViolation: profile.lastViolation
          ? formatTimestamp(new Date(profile.lastViolation))
          : 'Tidak ada',
      });

      await sendMessage(ctx.groupJid, msg, [targetJid]);
    },
  });
}
