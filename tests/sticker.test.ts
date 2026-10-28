import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { spawnSync } from 'child_process';
import {
  imageToSticker,
  videoToSticker,
  textToSticker,
  addStickerMetadata,
  readStickerMetadata,
  stickerToImage,
  parseStickerMetadata,
  wrapText,
  MAX_STICKER_BYTES,
} from '../src/media/sticker.js';

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

async function sampleImage(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
}

function sampleVideo(): Buffer {
  const res = spawnSync('ffmpeg', [
    '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=3',
    '-pix_fmt', 'yuv420p', '-f', 'mp4', '-movflags', 'frag_keyframe+empty_moov', 'pipe:1',
  ], { maxBuffer: 50 * 1024 * 1024 });
  return res.stdout;
}

describe('sticker media', () => {
  it('converts an image to a 512x512 webp', async () => {
    const webp = await imageToSticker(await sampleImage(800, 400));
    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it.skipIf(!hasFfmpeg)('converts a video to an animated webp under the size limit', async () => {
    const webp = await videoToSticker(sampleVideo());
    const meta = await sharp(webp, { animated: true }).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.pages).toBeGreaterThan(1);
    expect(webp.length).toBeLessThanOrEqual(MAX_STICKER_BYTES);
  }, 60000);

  it('renders text to a sticker', async () => {
    const webp = await textToSticker('halo semua apa kabar');
    const meta = await sharp(webp).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('embeds and reads pack metadata', async () => {
    const webp = await imageToSticker(await sampleImage(100, 100));
    const tagged = await addStickerMetadata(webp, { pack: 'Pack Ku', author: 'Febri' });
    expect(await readStickerMetadata(tagged)).toEqual({ pack: 'Pack Ku', author: 'Febri' });
    expect(await readStickerMetadata(webp)).toBeNull();
  });

  it('converts a sticker back to png', async () => {
    const png = await stickerToImage(await imageToSticker(await sampleImage(100, 100)));
    expect((await sharp(png).metadata()).format).toBe('png');
  });

  it('parses pack|author arguments', () => {
    const defaults = { pack: 'Bot', author: 'User' };
    expect(parseStickerMetadata('', defaults)).toEqual(defaults);
    expect(parseStickerMetadata('Keren|Saya', defaults)).toEqual({ pack: 'Keren', author: 'Saya' });
    expect(parseStickerMetadata('Keren', defaults)).toEqual({ pack: 'Keren', author: 'User' });
  });

  it('wraps text', () => {
    expect(wrapText('aku suka makan bakso', 10)).toEqual(['aku suka', 'makan', 'bakso']);
    expect(wrapText('abcdefghijkl', 5)).toEqual(['abcde', 'fghij', 'kl']);
  });
});
