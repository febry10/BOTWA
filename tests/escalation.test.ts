/**
 * Escalation engine unit tests.
 */
import { getEscalation, getSeverityAction } from '../src/moderation/violations/escalation.js';
import { DEFAULT_GROUP_SETTINGS } from '../src/config/defaults.js';

describe('Escalation Engine', () => {
  const settings = DEFAULT_GROUP_SETTINGS;

  it('should warn on first violation', () => {
    const result = getEscalation(1, settings);
    expect(result.action).toBe('WARN');
  });

  it('should mute at configured threshold', () => {
    const result = getEscalation(3, settings);
    expect(result.action).toBe('MUTE');
    expect(result.muteDuration).toBeTruthy();
  });

  it('should escalate to kick at configured threshold', () => {
    const customSettings = {
      ...settings,
      escalation: { ...settings.escalation, enabled: true, kick_at: 10 },
    };
    const result = getEscalation(10, customSettings);
    expect(result.action).toBe('KICK');
  });
});

describe('Severity Action', () => {
  const settings = DEFAULT_GROUP_SETTINGS;

  it('should immediately mute on HEAVY severity', () => {
    const result = getSeverityAction('HEAVY', 1, settings);
    expect(result.action).toBe('MUTE');
    expect(result.muteDuration).toBe('1h');
  });

  it('should warn on LIGHT severity', () => {
    const result = getSeverityAction('LIGHT', 1, settings);
    expect(result.action).toBe('WARN');
  });

  it('should use escalation for MEDIUM severity', () => {
    const result = getSeverityAction('MEDIUM', 3, settings);
    expect(result.action).toBe('MUTE');
  });
});
