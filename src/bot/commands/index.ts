/**
 * Command Registry & Parser — Handles command routing, permission checking, and rate limiting.
 */
import { WASocket, proto } from '@whiskeysockets/baileys';
import { Role, COMMAND_PERMISSIONS } from '../../config/permissions.js';
import { GroupSettings } from '../../config/defaults.js';
import { checkCommandRate } from '../../moderation/spam/detector.js';
import { deleteMessage, sendMessage } from '../client.js';
import { jidToMention } from '../../utils/jid.js';
import { ERROR_MESSAGES } from '../../messages/errors.js';
import { logAdminAction } from '../../services/logging.service.js';

import { registerGeneralCommands } from './general.js';
import { registerModerationCommands } from './moderation.js';
import { registerFilterCommands } from './filter.js';
import { registerLinkCommands } from './link.js';
import { registerGroupCommands } from './group.js';
import { registerAdminCommands } from './admin.js';
import { registerConfigCommands } from './config.js';
import { registerProfileCommands } from './profile.js';
import { registerStickerCommands } from './sticker.js';
import { registerFunCommands } from './fun.js';

import pino from 'pino';

const logger = pino({ name: 'command-system' });

export interface CommandContext {
  sock: WASocket;
  message: proto.IWebMessageInfo;
  groupJid: string;
  senderJid: string;
  userId: number;
  groupId: number;
  userRole: Role;
  args: string[];
  mentionedJids: string[];
  rawText: string;
  settings: GroupSettings;
}

export type CommandHandler = (ctx: CommandContext) => Promise<void>;

export interface CommandDefinition {
  name: string;
  aliases: string[];
  description: string;
  minRole: Role;
  handler: CommandHandler;
}

// Command registry
const commands = new Map<string, CommandDefinition>();

/**
 * Register a command.
 */
export function registerCommand(def: CommandDefinition): void {
  commands.set(def.name, def);
  for (const alias of def.aliases) {
    commands.set(alias, def);
  }
}

/**
 * Look up a command by name or alias.
 */
export function getCommand(name: string): CommandDefinition | undefined {
  return commands.get(name);
}

/**
 * Get all registered commands (unique definitions).
 */
export function getRegisteredCommands(): CommandDefinition[] {
  return [...new Set(commands.values())];
}

/**
 * Initialize all command modules.
 */
export function initializeCommands(): void {
  registerGeneralCommands();
  registerModerationCommands();
  registerFilterCommands();
  registerLinkCommands();
  registerGroupCommands();
  registerAdminCommands();
  registerConfigCommands();
  registerProfileCommands();
  registerStickerCommands();
  registerFunCommands();

  logger.info({ commandCount: commands.size }, 'Commands initialized');
}

/**
 * Parse and execute a command from a message.
 * Returns true if a command was found and executed.
 */
export async function handleCommand(
  sock: WASocket,
  message: proto.IWebMessageInfo,
  groupJid: string,
  senderJid: string,
  userId: number,
  groupId: number,
  userRole: Role,
  text: string,
  mentionedJids: string[],
  settings: GroupSettings
): Promise<boolean> {
  const prefix = settings.prefix || '!';
  const prefixes = [prefix, '/', '.'];

  // Check if message starts with any prefix
  let commandBody: string | null = null;
  for (const p of prefixes) {
    if (text.startsWith(p)) {
      commandBody = text.slice(p.length).trim();
      break;
    }
  }

  if (!commandBody) return false;

  // Parse command name and args
  const parts = commandBody.split(/\s+/);
  const commandName = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Look up command
  const cmd = commands.get(commandName);
  if (!cmd) return false;

  // Permission check
  const requiredRole = COMMAND_PERMISSIONS[cmd.name] ?? cmd.minRole;
  if (userRole < requiredRole) {
    await sendMessage(groupJid, ERROR_MESSAGES.notAdmin);
    return true;
  }

  // Rate limiting
  const rateConfig = userRole >= Role.ADMIN
    ? settings.command_rate_limit.admin
    : settings.command_rate_limit.member;

  const allowed = await checkCommandRate(senderJid, groupJid, rateConfig.max, rateConfig.seconds);
  if (!allowed) {
    await sendMessage(groupJid, ERROR_MESSAGES.rateLimited);
    return true;
  }

  // Execute command
  const ctx: CommandContext = {
    sock,
    message,
    groupJid,
    senderJid,
    userId,
    groupId,
    userRole,
    args,
    mentionedJids,
    rawText: text,
    settings,
  };

  try {
    await cmd.handler(ctx);

    // Log admin commands
    if (userRole >= Role.MODERATOR) {
      await logAdminAction(
        groupId,
        userId,
        null,
        commandName,
        { args, mentionedJids },
        'success'
      );
    }

    // Auto-delete command message
    if (settings.auto_delete_commands && userRole >= Role.MODERATOR) {
      setTimeout(async () => {
        try {
          await deleteMessage(groupJid, message.key!);
        } catch {
          // Silently ignore — not critical
        }
      }, 2000);
    }
  } catch (error) {
    logger.error({ error, command: commandName }, 'Command execution error');
    await sendMessage(groupJid, ERROR_MESSAGES.generalError);
  }

  return true;
}
