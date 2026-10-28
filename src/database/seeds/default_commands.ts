import type { Knex } from 'knex';

/**
 * Default command registry seed.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex('commands').del();

  const commands = [
    // ── General ──
    { name: 'help', description: 'Tampilkan daftar command', category: 'general', permission_level: 'MEMBER', usage: '!help' },
    { name: 'menu', description: 'Tampilkan menu bot', category: 'general', permission_level: 'MEMBER', usage: '!menu' },
    { name: 'rules', description: 'Tampilkan peraturan grup', category: 'general', permission_level: 'MEMBER', usage: '!rules' },
    { name: 'ping', description: 'Cek apakah bot aktif', category: 'general', permission_level: 'MEMBER', usage: '!ping' },
    { name: 'info', description: 'Informasi bot', category: 'general', permission_level: 'MEMBER', usage: '!info' },
    { name: 'stats', description: 'Statistik grup', category: 'general', permission_level: 'MEMBER', usage: '!stats' },
    { name: 'status', description: 'Status bot', category: 'general', permission_level: 'MEMBER', usage: '!status' },
    { name: 'profile', description: 'Profil moderasi user', category: 'general', permission_level: 'MEMBER', usage: '!profile @user' },

    // ── Moderation ──
    { name: 'warn', description: 'Berikan warning ke user', category: 'moderation', permission_level: 'MODERATOR', usage: '!warn @user [alasan]' },
    { name: 'warning', description: 'Berikan warning ke user (alias)', category: 'moderation', permission_level: 'MODERATOR', usage: '!warning @user' },
    { name: 'warnings', description: 'Lihat warning user', category: 'moderation', permission_level: 'MODERATOR', usage: '!warnings @user' },
    { name: 'resetwarning', description: 'Reset warning user', category: 'moderation', permission_level: 'MODERATOR', usage: '!resetwarning @user' },
    { name: 'mute', description: 'Mute user', category: 'moderation', permission_level: 'MODERATOR', usage: '!mute @user 30m [alasan]' },
    { name: 'unmute', description: 'Unmute user', category: 'moderation', permission_level: 'MODERATOR', usage: '!unmute @user' },
    { name: 'mutestatus', description: 'Cek status mute user', category: 'moderation', permission_level: 'MODERATOR', usage: '!mutestatus @user' },
    { name: 'kick', description: 'Kick user dari grup', category: 'moderation', permission_level: 'ADMIN', usage: '!kick @user [alasan]' },
    { name: 'ban', description: 'Ban user (permanent)', category: 'moderation', permission_level: 'ADMIN', usage: '!ban @user [alasan]' },
    { name: 'unban', description: 'Unban user', category: 'moderation', permission_level: 'ADMIN', usage: '!unban @user' },
    { name: 'tempban', description: 'Ban sementara', category: 'moderation', permission_level: 'ADMIN', usage: '!tempban @user 1h [alasan]' },

    // ── Filter ──
    { name: 'addword', description: 'Tambah kata terlarang', category: 'filter', permission_level: 'ADMIN', usage: '!addword kata [LIGHT|MEDIUM|HEAVY]' },
    { name: 'delword', description: 'Hapus kata terlarang', category: 'filter', permission_level: 'ADMIN', usage: '!delword kata' },
    { name: 'listword', description: 'Daftar kata terlarang', category: 'filter', permission_level: 'ADMIN', usage: '!listword' },

    // ── Link ──
    { name: 'allowlink', description: 'Izinkan domain', category: 'link', permission_level: 'ADMIN', usage: '!allowlink youtube.com' },
    { name: 'blocklink', description: 'Blokir domain', category: 'link', permission_level: 'ADMIN', usage: '!blocklink spam.com' },
    { name: 'listlink', description: 'Daftar domain', category: 'link', permission_level: 'ADMIN', usage: '!listlink' },

    // ── Group ──
    { name: 'setwelcome', description: 'Atur pesan selamat datang', category: 'group', permission_level: 'ADMIN', usage: '!setwelcome teks' },
    { name: 'setgoodbye', description: 'Atur pesan perpisahan', category: 'group', permission_level: 'ADMIN', usage: '!setgoodbye teks' },
    { name: 'setrules', description: 'Atur peraturan grup', category: 'group', permission_level: 'ADMIN', usage: '!setrules teks' },
    { name: 'welcome', description: 'Toggle welcome on/off', category: 'group', permission_level: 'ADMIN', usage: '!welcome on/off' },
    { name: 'goodbye', description: 'Toggle goodbye on/off', category: 'group', permission_level: 'ADMIN', usage: '!goodbye on/off' },

    // ── Admin ──
    { name: 'admins', description: 'Daftar admin grup', category: 'admin', permission_level: 'ADMIN', usage: '!admins' },
    { name: 'promote', description: 'Promosikan user jadi admin', category: 'admin', permission_level: 'OWNER', usage: '!promote @user' },
    { name: 'demote', description: 'Turunkan admin jadi member', category: 'admin', permission_level: 'OWNER', usage: '!demote @user' },
    { name: 'whitelist', description: 'Whitelist user', category: 'admin', permission_level: 'ADMIN', usage: '!whitelist @user' },
    { name: 'unwhitelist', description: 'Hapus whitelist user', category: 'admin', permission_level: 'ADMIN', usage: '!unwhitelist @user' },
    { name: 'whitelistlist', description: 'Daftar user whitelist', category: 'admin', permission_level: 'ADMIN', usage: '!whitelistlist' },
    { name: 'blacklist', description: 'Blacklist user', category: 'admin', permission_level: 'ADMIN', usage: '!blacklist @user [alasan]' },
    { name: 'unblacklist', description: 'Hapus blacklist user', category: 'admin', permission_level: 'ADMIN', usage: '!unblacklist @user' },
    { name: 'blacklistlist', description: 'Daftar user blacklist', category: 'admin', permission_level: 'ADMIN', usage: '!blacklistlist' },

    // ── Configuration ──
    { name: 'settings', description: 'Tampilkan pengaturan grup', category: 'config', permission_level: 'ADMIN', usage: '!settings' },
    { name: 'set', description: 'Ubah pengaturan', category: 'config', permission_level: 'ADMIN', usage: '!set profanity on/off' },
  ];

  await knex('commands').insert(commands);
}
