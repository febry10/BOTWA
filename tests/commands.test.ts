import { describe, it, expect } from 'vitest';
import { initializeCommands, getRegisteredCommands, getCommand } from '../src/bot/commands/index.js';
import { COMMAND_PERMISSIONS } from '../src/config/permissions.js';

describe('command registry', () => {
  initializeCommands();
  const defs = getRegisteredCommands();

  it('registers the new sticker and fun commands', () => {
    for (const name of ['sticker', 'toimg', 'take', 'ttp', 'tagall', 'hidetag', 'dadu', 'jodoh', 'truth', 'dare']) {
      expect(getCommand(name)?.name, name).toBe(name);
    }
    expect(getCommand('s')?.name).toBe('sticker');
  });

  it('gives every command an explicit permission', () => {
    for (const def of defs) {
      expect(COMMAND_PERMISSIONS[def.name], `permission for ${def.name}`).toBeDefined();
    }
  });

  it('has no name/alias clashes', () => {
    for (const def of defs) {
      for (const key of [def.name, ...def.aliases]) {
        expect(getCommand(key), `trigger ${key} of ${def.name}`).toBe(def);
      }
    }
  });
});
