/**
 * JID utility unit tests.
 */
import { isGroupJid, getPhoneNumber, jidToMention, normalizeJid } from '../src/utils/jid.js';

describe('JID Utilities', () => {
  describe('isGroupJid', () => {
    it('should return true for group JIDs', () => {
      expect(isGroupJid('120363123456@g.us')).toBe(true);
    });

    it('should return false for personal JIDs', () => {
      expect(isGroupJid('628123456789@s.whatsapp.net')).toBe(false);
    });
  });

  describe('getPhoneNumber', () => {
    it('should extract phone number from JID', () => {
      expect(getPhoneNumber('628123456789@s.whatsapp.net')).toBe('628123456789');
    });

    it('should handle lid format', () => {
      expect(getPhoneNumber('628123456789:23@s.whatsapp.net')).toBe('628123456789');
    });
  });

  describe('jidToMention', () => {
    it('should convert JID to mention format', () => {
      expect(jidToMention('628123456789@s.whatsapp.net')).toBe('@628123456789');
    });
  });

  describe('normalizeJid', () => {
    it('should normalize JID by removing lid suffix', () => {
      const result = normalizeJid('628123456789:23@s.whatsapp.net');
      expect(result).toBe('628123456789@s.whatsapp.net');
    });
  });
});
