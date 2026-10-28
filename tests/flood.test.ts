/**
 * Flood detector unit tests.
 */
import { detectFlood, checkMentionSpam } from '../src/moderation/flood/detector.js';
import { DEFAULT_GROUP_SETTINGS } from '../src/config/defaults.js';

describe('Flood Detector', () => {
  const settings = { ...DEFAULT_GROUP_SETTINGS, flood: { ...DEFAULT_GROUP_SETTINGS.flood, enabled: true } };

  it('should not flag normal messages', () => {
    const result = detectFlood('Hello everyone!', 'user1@s.whatsapp.net', 'group1@g.us', 0, settings);
    expect(result.isFlood).toBe(false);
  });

  it('should detect excessive emoji', () => {
    const emojiStr = '😀'.repeat(35);
    const result = detectFlood(emojiStr, 'user2@s.whatsapp.net', 'group1@g.us', 0, settings);
    expect(result.isFlood).toBe(true);
    expect(result.type).toBe('EMOJI');
  });

  it('should detect character repetition', () => {
    const repeatedChar = 'a'.repeat(25);
    const result = detectFlood(repeatedChar, 'user3@s.whatsapp.net', 'group1@g.us', 0, settings);
    expect(result.isFlood).toBe(true);
    expect(result.type).toBe('CHAR_REPEAT');
  });
});

describe('Mention Spam Detector', () => {
  const settings = { ...DEFAULT_GROUP_SETTINGS, mention: { ...DEFAULT_GROUP_SETTINGS.mention, enabled: true } };

  it('should not flag normal mention count', () => {
    const result = checkMentionSpam(2, settings);
    expect(result.isSpam).toBe(false);
  });

  it('should flag excessive mentions for warning', () => {
    const result = checkMentionSpam(6, settings);
    expect(result.isSpam).toBe(true);
    expect(result.action).toBe('WARN');
  });

  it('should flag very high mentions for mute', () => {
    const result = checkMentionSpam(25, settings);
    expect(result.isSpam).toBe(true);
    expect(result.action).toBe('MUTE');
  });
});
