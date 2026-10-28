/**
 * Context analyzer unit tests.
 */
import { analyzeContext } from '../src/moderation/profanity/context-analyzer.js';

describe('Context Analyzer', () => {
  it('should detect offensive context with insult markers', () => {
    const words = ['dasar', 'anjing', 'lu'];
    const result = analyzeContext('anjing', words, 1);
    expect(result.isOffensive).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should detect non-offensive context with safe patterns', () => {
    const words = ['anjing', 'saya', 'lucu'];
    const result = analyzeContext('anjing', words, 0);
    expect(result.isOffensive).toBe(false);
    expect(result.confidence).toBeLessThan(0.5);
  });

  it('should handle target pronouns', () => {
    const words = ['kamu', 'babi'];
    const result = analyzeContext('babi', words, 1);
    expect(result.isOffensive).toBe(true);
  });

  it('should handle film/media context', () => {
    const words = ['film', 'anjing', 'baru'];
    const result = analyzeContext('anjing', words, 1);
    expect(result.isOffensive).toBe(false);
  });

  it('should handle standalone profanity', () => {
    const words = ['babi'];
    const result = analyzeContext('babi', words, 0);
    // Standalone with no insult marker — should be close to threshold
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });
});
