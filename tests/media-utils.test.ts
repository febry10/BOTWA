import { describe, it, expect } from 'vitest';
import { detectPlatform } from '../src/media/downloader.js';
import { parseTtsArgs } from '../src/media/tts.js';

describe('downloader platform detection', () => {
  it('accepts supported platforms', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    expect(detectPlatform('https://vt.tiktok.com/ZSabc/')).toBe('tiktok');
    expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBe('instagram');
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(detectPlatform('https://m.youtube.com/watch?v=x')).toBe('youtube');
  });

  it('rejects other URLs', () => {
    expect(detectPlatform('https://evil.com/tiktok.com')).toBeNull();
    expect(detectPlatform('https://tiktok.com.evil.com/x')).toBeNull();
    expect(detectPlatform('file:///etc/passwd')).toBeNull();
    expect(detectPlatform('not a url')).toBeNull();
  });
});

describe('tts args', () => {
  it('parses optional language', () => {
    expect(parseTtsArgs(['en', 'hello', 'world'])).toEqual({ lang: 'en', text: 'hello world' });
    expect(parseTtsArgs(['halo', 'semua'])).toEqual({ lang: 'id', text: 'halo semua' });
    expect(parseTtsArgs(['en'])).toEqual({ lang: 'id', text: 'en' });
  });
});
