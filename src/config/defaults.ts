/**
 * Default bot settings applied to new groups.
 * Per-group settings override these via deep merge.
 */
export const DEFAULT_GROUP_SETTINGS = {
  auto_moderation: true,
  dry_run: false,
  prefix: '!',

  profanity: {
    enabled: true,
    action: 'WARN' as const,
  },

  spam: {
    enabled: true,
    thresholds: [
      { messages: 8, seconds: 10, action: 'WARN' as const },
      { messages: 15, seconds: 10, action: 'MUTE' as const, mute_duration: '5m' },
      { messages: 30, seconds: 30, action: 'MUTE' as const, mute_duration: '30m' },
    ],
  },

  flood: {
    enabled: true,
    duplicate_limit: 5,
    duplicate_window_seconds: 60,
    max_emoji_count: 30,
    max_char_repeat: 20,
    action: 'WARN' as const,
  },

  links: {
    enabled: true,
    mode: 'DELETE' as 'OFF' | 'DELETE' | 'WARNING' | 'MUTE',
  },

  invite: {
    enabled: true,
    action: 'DELETE' as const,
  },

  mention: {
    enabled: true,
    warn_limit: 5,
    delete_limit: 10,
    mute_limit: 20,
  },

  warning: {
    limit: 3,
    auto_reset: true,
    reset_after_days: 7,
  },

  mute_tiers: {
    '3': '30m',
    '5': '1h',
    '7': '6h',
    '10': '24h',
  } as Record<string, string>,

  escalation: {
    enabled: true,
    kick_at: 10,
    ban_at: 0, // 0 = disabled
  },

  welcome: {
    enabled: true,
    message: '🎉 Selamat datang {user} di *{group}*!\n\nSilakan baca peraturan grup dengan mengetik *!rules*.\n\n📊 Jumlah anggota: {members}',
  },

  goodbye: {
    enabled: true,
    message: '👋 {user} telah keluar dari grup.',
  },

  rules: '📜 *PERATURAN GRUP*\n\n1. Dilarang berkata kasar.\n2. Dilarang spam.\n3. Dilarang promosi tanpa izin.\n4. Dilarang mengirim link terlarang.\n5. Hormati anggota lain.',

  protected_roles: ['OWNER', 'SUPER_ADMIN', 'ADMIN'] as string[],
  moderate_admin: false,

  auto_delete_commands: true,

  command_rate_limit: {
    member: { max: 5, seconds: 10 },
    admin: { max: 15, seconds: 10 },
  },
};

export type GroupSettings = typeof DEFAULT_GROUP_SETTINGS;

/**
 * Deep merge settings with defaults.
 */
export function mergeWithDefaults(custom: Partial<GroupSettings>): GroupSettings {
  return deepMerge(DEFAULT_GROUP_SETTINGS, custom) as GroupSettings;
}

function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
