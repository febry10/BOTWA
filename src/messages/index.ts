/**
 * Message template engine with placeholder support.
 */

export type PlaceholderMap = Record<string, string>;

/**
 * Replace placeholders in a template string.
 * Supports {user}, {name}, {group}, {members}, {date}, etc.
 */
export function renderTemplate(template: string, placeholders: PlaceholderMap): string {
  let result = template;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

// Re-export all message modules
export { WARNING_MESSAGES } from './warning.js';
export { MUTE_MESSAGES } from './mute.js';
export { WELCOME_MESSAGES } from './welcome.js';
export { GOODBYE_MESSAGES } from './goodbye.js';
export { ERROR_MESSAGES } from './errors.js';
export { COMMAND_MESSAGES } from './commands.js';
