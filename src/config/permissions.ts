/**
 * Permission levels for command access control.
 * Higher numeric value = higher privilege.
 */
export enum Role {
  BOT = 0,
  MEMBER = 1,
  MODERATOR = 2,
  ADMIN = 3,
  SUPER_ADMIN = 4,
  OWNER = 5,
}

/**
 * Maps command names to the minimum role required to execute them.
 */
export const COMMAND_PERMISSIONS: Record<string, Role> = {
  // ── General (MEMBER) ──
  help: Role.MEMBER,
  menu: Role.MEMBER,
  rules: Role.MEMBER,
  ping: Role.MEMBER,
  info: Role.MEMBER,
  stats: Role.MEMBER,
  status: Role.MEMBER,
  profile: Role.MEMBER,

  // Sticker
  sticker: Role.MEMBER,
  toimg: Role.MEMBER,
  take: Role.MEMBER,
  ttp: Role.MEMBER,

  // Fun
  dadu: Role.MEMBER,
  coinflip: Role.MEMBER,
  pilih: Role.MEMBER,
  truth: Role.MEMBER,
  dare: Role.MEMBER,
  jodoh: Role.MEMBER,
  siapa: Role.MEMBER,
  rate: Role.MEMBER,
  apakah: Role.MEMBER,
  kapan: Role.MEMBER,
  quote: Role.MEMBER,
  tagall: Role.MODERATOR,
  hidetag: Role.MODERATOR,

  // ── Moderation (MODERATOR) ──
  warn: Role.MODERATOR,
  warning: Role.MODERATOR,
  warnings: Role.MODERATOR,
  resetwarning: Role.MODERATOR,
  mute: Role.MODERATOR,
  unmute: Role.MODERATOR,
  mutestatus: Role.MODERATOR,

  // ── Admin ──
  kick: Role.ADMIN,
  ban: Role.ADMIN,
  unban: Role.ADMIN,
  tempban: Role.ADMIN,
  blacklist: Role.ADMIN,
  unblacklist: Role.ADMIN,
  blacklistlist: Role.ADMIN,
  whitelist: Role.ADMIN,
  unwhitelist: Role.ADMIN,
  whitelistlist: Role.ADMIN,
  addword: Role.ADMIN,
  delword: Role.ADMIN,
  listword: Role.ADMIN,
  allowlink: Role.ADMIN,
  blocklink: Role.ADMIN,
  listlink: Role.ADMIN,
  setwelcome: Role.ADMIN,
  setgoodbye: Role.ADMIN,
  setrules: Role.ADMIN,
  welcome: Role.ADMIN,
  goodbye: Role.ADMIN,
  admins: Role.ADMIN,
  settings: Role.ADMIN,
  set: Role.ADMIN,

  // ── Owner ──
  promote: Role.OWNER,
  demote: Role.OWNER,
};

/**
 * Get the required role for a command.
 */
export function getRequiredRole(commandName: string): Role {
  return COMMAND_PERMISSIONS[commandName.toLowerCase()] ?? Role.OWNER;
}

/**
 * Check if a role has permission to execute a command.
 */
export function hasPermission(userRole: Role, commandName: string): boolean {
  const requiredRole = getRequiredRole(commandName);
  return userRole >= requiredRole;
}

/**
 * Convert string role name to Role enum.
 */
export function parseRole(roleName: string): Role {
  const upper = roleName.toUpperCase().replace(/\s+/g, '_');
  switch (upper) {
    case 'OWNER': return Role.OWNER;
    case 'SUPER_ADMIN': return Role.SUPER_ADMIN;
    case 'ADMIN': return Role.ADMIN;
    case 'MODERATOR': return Role.MODERATOR;
    case 'MEMBER': return Role.MEMBER;
    case 'BOT': return Role.BOT;
    default: return Role.MEMBER;
  }
}

/**
 * Convert Role enum to display string.
 */
export function roleToString(role: Role): string {
  switch (role) {
    case Role.OWNER: return 'Owner';
    case Role.SUPER_ADMIN: return 'Super Admin';
    case Role.ADMIN: return 'Admin';
    case Role.MODERATOR: return 'Moderator';
    case Role.MEMBER: return 'Member';
    case Role.BOT: return 'Bot';
    default: return 'Unknown';
  }
}
