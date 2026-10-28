/**
 * WhatsApp JID (Jabber ID) utilities.
 */

/**
 * Extract the phone number from a WhatsApp JID.
 * e.g., "6281234567890@s.whatsapp.net" → "6281234567890"
 */
export function jidToNumber(jid: string): string {
  return jid.replace(/@.*$/, '').replace(/:\d+/, '');
}

/**
 * Extract phone number from JID (alias to jidToNumber).
 */
export function getPhoneNumber(jid: string): string {
  return jidToNumber(jid);
}

/**
 * Convert a phone number to a user JID.
 */
export function numberToJid(number: string): string {
  const cleaned = number.replace(/[^0-9]/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Check if a JID is a group JID.
 */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith('@g.us');
}

/**
 * Check if a JID is a user JID.
 */
export function isUserJid(jid: string): boolean {
  return jid.endsWith('@s.whatsapp.net');
}

/**
 * Extract the group ID portion from a group JID.
 */
export function extractGroupId(jid: string): string {
  return jid.replace(/@g\.us$/, '');
}

/**
 * Get a normalized JID (lowercase, trimmed, without device/lid suffix).
 */
export function normalizeJid(jid: string): string {
  const cleaned = jid.trim().toLowerCase();
  const domainIndex = cleaned.indexOf('@');
  if (domainIndex === -1) return cleaned;

  const user = cleaned.slice(0, domainIndex).replace(/:\d+/, '');
  const domain = cleaned.slice(domainIndex);
  return `${user}${domain}`;
}

/**
 * Format a JID for mention in messages.
 * Returns "@number" format.
 */
export function jidToMention(jid: string): string {
  return `@${jidToNumber(jid)}`;
}

/**
 * Extract mentioned JIDs from a message text.
 * WhatsApp mentions are in format @628xxx
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\d{10,15})/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(`${match[1]}@s.whatsapp.net`);
  }
  return mentions;
}

/**
 * Get the participant JID from a message key (for group messages).
 */
export function getParticipantJid(key: { participant?: string; remoteJid?: string; fromMe?: boolean }): string | null {
  if (key.fromMe) return null;
  return key.participant || key.remoteJid || null;
}
