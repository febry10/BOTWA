/**
 * Link Detector — URL extraction, domain classification, and invite link detection.
 */
import { getDb } from '../../database/connection.js';
import { GroupSettings } from '../../config/defaults.js';

/**
 * URL patterns to detect.
 */
const URL_REGEX = /https?:\/\/[^\s<>\"{}|\\^`[\]]+|www\.[^\s<>\"{}|\\^`[\]]+/gi;

/**
 * Invite/promo link patterns.
 */
const INVITE_PATTERNS = [
  /chat\.whatsapp\.com\/[a-zA-Z0-9]+/i,        // WhatsApp group invite
  /wa\.me\/[a-zA-Z0-9]+/i,                     // WhatsApp contact/short link
  /t\.me\/[a-zA-Z0-9_]+/i,                     // Telegram
  /telegram\.me\/[a-zA-Z0-9_]+/i,              // Telegram alternate
  /discord\.gg\/[a-zA-Z0-9]+/i,                // Discord invite
  /discord\.com\/invite\/[a-zA-Z0-9]+/i,        // Discord invite alternate
  /bit\.ly\/[a-zA-Z0-9]+/i,                    // Bitly shortener
  /tinyurl\.com\/[a-zA-Z0-9]+/i,               // TinyURL
  /s\.id\/[a-zA-Z0-9]+/i,                      // s.id shortener
  /linktr\.ee\/[a-zA-Z0-9]+/i,                 // Linktree
];

export interface LinkResult {
  hasLink: boolean;
  urls: string[];
  domains: string[];
  hasInvite: boolean;
  inviteType: string | null;
  isWhitelisted: boolean;
  isBlocked: boolean;
}

/**
 * Detect links in a message and classify them.
 */
export async function detectLinks(
  text: string,
  groupId: number,
  settings: GroupSettings
): Promise<LinkResult> {
  const noLink: LinkResult = {
    hasLink: false,
    urls: [],
    domains: [],
    hasInvite: false,
    inviteType: null,
    isWhitelisted: false,
    isBlocked: false,
  };

  if (!text) return noLink;

  // Extract URLs
  const urls = text.match(URL_REGEX) || [];
  if (urls.length === 0) {
    // Also check for invite patterns without http prefix
    const hasInvite = checkInviteLinks(text);
    if (hasInvite.found) {
      return {
        hasLink: true,
        urls: [hasInvite.match!],
        domains: [],
        hasInvite: true,
        inviteType: hasInvite.type,
        isWhitelisted: false,
        isBlocked: false,
      };
    }
    return noLink;
  }

  // Extract domains
  const domains = urls.map(url => extractDomain(url)).filter(Boolean) as string[];

  // Check invite patterns
  const inviteCheck = checkInviteLinks(text);

  // Check whitelist/blacklist if link filter is enabled
  if (!settings.links.enabled) {
    return { hasLink: true, urls, domains, hasInvite: inviteCheck.found, inviteType: inviteCheck.type, isWhitelisted: true, isBlocked: false };
  }

  const db = getDb();

  // Check if any domain is whitelisted
  const whitelisted = await db('allowed_links')
    .where({ group_id: groupId })
    .whereIn('domain', domains)
    .select('domain');

  const whitelistedDomains = new Set(whitelisted.map((w: any) => w.domain));
  const allWhitelisted = domains.every(d => whitelistedDomains.has(d));

  // Check if any domain is blocked
  const blocked = await db('blocked_links')
    .where({ group_id: groupId })
    .whereIn('domain', domains)
    .select('domain');

  const hasBlocked = blocked.length > 0;

  return {
    hasLink: true,
    urls,
    domains,
    hasInvite: inviteCheck.found,
    inviteType: inviteCheck.type,
    isWhitelisted: allWhitelisted,
    isBlocked: hasBlocked,
  };
}

/**
 * Extract domain from a URL.
 */
function extractDomain(url: string): string | null {
  try {
    let cleaned = url;
    if (!cleaned.startsWith('http')) {
      cleaned = 'https://' + cleaned;
    }
    const parsed = new URL(cleaned);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Check for invite/promo links.
 */
function checkInviteLinks(text: string): { found: boolean; type: string | null; match: string | null } {
  const typeMap: Record<number, string> = {
    0: 'WhatsApp Group',
    1: 'WhatsApp',
    2: 'Telegram',
    3: 'Telegram',
    4: 'Discord',
    5: 'Discord',
    6: 'Shortener (bit.ly)',
    7: 'Shortener (tinyurl)',
    8: 'Shortener (s.id)',
    9: 'Linktree',
  };

  for (let i = 0; i < INVITE_PATTERNS.length; i++) {
    const match = text.match(INVITE_PATTERNS[i]);
    if (match) {
      return { found: true, type: typeMap[i] || 'Unknown', match: match[0] };
    }
  }

  return { found: false, type: null, match: null };
}

/**
 * Add a domain to the allowed list.
 */
export async function addAllowedDomain(
  groupId: number,
  domain: string,
  addedBy: string | null = null
): Promise<boolean> {
  const db = getDb();
  try {
    await db('allowed_links')
      .insert({ group_id: groupId, domain: domain.toLowerCase(), added_by: addedBy })
      .onConflict(['group_id', 'domain'])
      .ignore();
    return true;
  } catch {
    return false;
  }
}

/**
 * Add a domain to the blocked list.
 */
export async function addBlockedDomain(
  groupId: number,
  domain: string,
  addedBy: string | null = null
): Promise<boolean> {
  const db = getDb();
  try {
    await db('blocked_links')
      .insert({ group_id: groupId, domain: domain.toLowerCase(), added_by: addedBy })
      .onConflict(['group_id', 'domain'])
      .ignore();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all allowed domains for a group.
 */
export async function getAllowedDomains(groupId: number): Promise<string[]> {
  const db = getDb();
  const rows = await db('allowed_links').where({ group_id: groupId }).select('domain');
  return rows.map((r: any) => r.domain);
}

/**
 * Get all blocked domains for a group.
 */
export async function getBlockedDomains(groupId: number): Promise<string[]> {
  const db = getDb();
  const rows = await db('blocked_links').where({ group_id: groupId }).select('domain');
  return rows.map((r: any) => r.domain);
}
