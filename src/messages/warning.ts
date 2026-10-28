export const WARNING_MESSAGES = {
  issued: (current: number, max: number, reason?: string, matchedContent?: string): string => {
    const emoji = current >= max ? '🔴' : '⚠️';
    let msg = `${emoji} *PERINGATAN (${current}/${max})*\n`;
    msg += `👤 Kepada: {user}\n`;
    if (matchedContent) {
      msg += `🗑️ Pesan dihapus karena mengandung: *"${matchedContent}"*\n`;
    }
    if (reason) msg += `📋 Alasan: ${reason}\n`;
    if (current >= max) {
      msg += `\n🔇 Batas peringatan (${max}/${max}) telah tercapai! Sanksi moderasi diterapkan.`;
    }
    return msg;
  },

  list: (warnings: Array<{ id: number; reason: string | null; severity: string; created_at: Date }>): string => {
    if (warnings.length === 0) {
      return '✅ {user} tidak memiliki warning aktif.';
    }
    let msg = `⚠️ *Warning untuk {user}*\n\n`;
    for (const w of warnings) {
      const date = w.created_at.toLocaleDateString('id-ID');
      msg += `${w.id}. [${w.severity}] ${w.reason || 'Tidak ada alasan'} — ${date}\n`;
    }
    msg += `\nTotal: ${warnings.length} warning aktif`;
    return msg;
  },

  reset: '✅ Warning untuk {user} telah direset.',

  autoReset: '🔄 Warning untuk {user} telah direset otomatis (expired).',
};
