/**
 * Group Service — Group and group settings CRUD.
 */
import { getDb } from '../database/connection.js';
import { DEFAULT_GROUP_SETTINGS, GroupSettings, mergeWithDefaults } from '../config/defaults.js';
import pino from 'pino';

const logger = pino({ name: 'group-service' });

// In-memory cache for group settings to avoid DB hits on every message
const settingsCache = new Map<string, { settings: GroupSettings; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Ensure a group exists in the database, creating it if necessary.
 * Returns the database group ID.
 */
export async function ensureGroup(waGroupId: string, name?: string): Promise<number> {
  const db = getDb();

  let group = await db('groups').where({ wa_group_id: waGroupId }).first();

  if (!group) {
    [group] = await db('groups')
      .insert({ wa_group_id: waGroupId, name: name || null })
      .onConflict('wa_group_id')
      .merge({ name: name || undefined, updated_at: new Date() })
      .returning('*');

    // Create default settings
    await db('group_settings')
      .insert({ group_id: group.id, settings_json: JSON.stringify({}) })
      .onConflict('group_id')
      .ignore();

    logger.info({ groupId: group.id, waGroupId }, 'New group registered');
  }

  return group.id;
}

/**
 * Get the merged group settings (per-group overrides + defaults).
 */
export async function getGroupSettings(groupId: number): Promise<GroupSettings> {
  // Check cache first
  const cacheKey = `group_${groupId}`;
  const cached = settingsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.settings;
  }

  const db = getDb();
  const row = await db('group_settings').where({ group_id: groupId }).first();

  let custom = {};
  if (row && row.settings_json) {
    custom = typeof row.settings_json === 'string'
      ? JSON.parse(row.settings_json)
      : row.settings_json;
  }

  const merged = mergeWithDefaults(custom);

  // Cache it
  settingsCache.set(cacheKey, { settings: merged, expiresAt: Date.now() + CACHE_TTL_MS });

  return merged;
}

/**
 * Update a specific setting for a group.
 */
export async function updateGroupSetting(
  groupId: number,
  path: string,
  value: any
): Promise<void> {
  const db = getDb();

  // Get current custom settings
  let row = await db('group_settings').where({ group_id: groupId }).first();
  let custom: Record<string, any> = {};

  if (row) {
    custom = typeof row.settings_json === 'string'
      ? JSON.parse(row.settings_json)
      : row.settings_json || {};
  }

  // Set nested path
  const keys = path.split('.');
  let obj = custom;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!obj[keys[i]] || typeof obj[keys[i]] !== 'object') {
      obj[keys[i]] = {};
    }
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;

  // Upsert
  if (row) {
    await db('group_settings')
      .where({ group_id: groupId })
      .update({ settings_json: JSON.stringify(custom), updated_at: new Date() });
  } else {
    await db('group_settings')
      .insert({ group_id: groupId, settings_json: JSON.stringify(custom) });
  }

  // Invalidate cache
  settingsCache.delete(`group_${groupId}`);

  logger.info({ groupId, path, value }, 'Group setting updated');
}

/**
 * Get all groups from the database.
 */
export async function getAllGroups(): Promise<Array<{ id: number; wa_group_id: string; name: string | null }>> {
  const db = getDb();
  return db('groups').select('id', 'wa_group_id', 'name').orderBy('name');
}

/**
 * Get group count.
 */
export async function getGroupCount(): Promise<number> {
  const db = getDb();
  const result = await db('groups').count('id as count').first();
  return parseInt(String(result?.count || '0'), 10);
}

/**
 * Invalidate settings cache for a group.
 */
export function invalidateSettingsCache(groupId: number): void {
  settingsCache.delete(`group_${groupId}`);
}
