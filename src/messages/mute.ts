export const MUTE_MESSAGES = {
  muted: '🔇 {user} telah di-mute selama *{duration}*.\nAlasan: {reason}',

  unmuted: '🔊 {user} telah di-unmute.',

  autoUnmuted: '🔊 {user} telah di-unmute secara otomatis.',

  alreadyMuted: '⚠️ {user} sudah dalam status mute hingga {until}.',

  notMuted: 'ℹ️ {user} tidak sedang di-mute.',

  status: (active: boolean, until?: Date): string => {
    if (!active) return 'ℹ️ {user} tidak sedang di-mute.';
    const untilStr = until ? until.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : 'Unknown';
    return `🔇 {user} sedang di-mute.\nBerakhir: ${untilStr}`;
  },

  deletedMutedMessage: '🗑️ Pesan dari {user} dihapus (sedang di-mute).',

  deleteFailedLog: 'Gagal menghapus pesan dari {user} yang sedang di-mute: {error}',

  escalationMute: '🔇 {user} telah di-mute selama *{duration}*.\nAlasan: mencapai {count} pelanggaran.',
};
