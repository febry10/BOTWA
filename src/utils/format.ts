/**
 * Message formatting utilities.
 */

/**
 * Format a mention for WhatsApp message.
 */
export function mention(jid: string): string {
  const number = jid.replace(/@.*$/, '');
  return `@${number}`;
}

/**
 * Bold text for WhatsApp.
 */
export function bold(text: string): string {
  return `*${text}*`;
}

/**
 * Italic text for WhatsApp.
 */
export function italic(text: string): string {
  return `_${text}_`;
}

/**
 * Monospace text for WhatsApp.
 */
export function mono(text: string): string {
  return `\`\`\`${text}\`\`\``;
}

/**
 * Strikethrough text for WhatsApp.
 */
export function strike(text: string): string {
  return `~${text}~`;
}

/**
 * Format a number with thousand separators.
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('id-ID');
}

/**
 * Truncate text to a maximum length.
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Create a separator line.
 */
export function separator(): string {
  return '━━━━━━━━━━━━━━━━━━━━';
}

/**
 * Format a list of items with numbers.
 */
export function numberedList(items: string[]): string {
  return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
}

/**
 * Format uptime from milliseconds to human readable.
 */
export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
