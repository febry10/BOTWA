/**
 * Sticker Media — Convert images, GIFs and videos to WhatsApp stickers (WebP + EXIF metadata).
 */
import sharp from 'sharp';
import webpmux from 'node-webpmux';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';

export const STICKER_SIZE = 512;
export const MAX_STICKER_BYTES = 1024 * 1024;

export interface StickerMetadata {
  pack: string;
  author: string;
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Convert a static image to a 512x512 WebP sticker.
 */
export async function imageToSticker(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(STICKER_SIZE, STICKER_SIZE, { fit: 'contain', background: TRANSPARENT })
    .webp({ quality: 80 })
    .toBuffer();
}

function runFfmpeg(args: string[], timeoutMs = 60000): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr = (stderr + d.toString()).slice(-2000); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('ffmpeg timeout')); }, timeoutMs);
    proc.on('error', (err) => { clearTimeout(timer); reject(err); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

/**
 * Convert a GIF or video to an animated 512x512 WebP sticker.
 * Quality, frame rate and duration are lowered step by step until it fits WhatsApp's size limit.
 */
export async function videoToSticker(input: Buffer): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sticker-'));
  const inputPath = path.join(dir, 'input');
  const outputPath = path.join(dir, 'output.webp');
  const attempts = [
    { fps: 15, quality: 60, seconds: 8 },
    { fps: 12, quality: 40, seconds: 6 },
    { fps: 10, quality: 25, seconds: 5 },
    { fps: 8, quality: 10, seconds: 4 },
  ];

  try {
    await fs.writeFile(inputPath, input);
    let output: Buffer | null = null;
    for (const { fps, quality, seconds } of attempts) {
      await runFfmpeg([
        '-y', '-i', inputPath,
        '-t', String(seconds),
        '-an',
        '-vf', `fps=${fps},scale=${STICKER_SIZE}:${STICKER_SIZE}:force_original_aspect_ratio=decrease,format=rgba,` +
          `pad=${STICKER_SIZE}:${STICKER_SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`,
        '-c:v', 'libwebp',
        '-lossless', '0',
        '-q:v', String(quality),
        '-compression_level', '6',
        '-loop', '0',
        outputPath,
      ]);
      output = await fs.readFile(outputPath);
      if (output.length <= MAX_STICKER_BYTES) break;
    }
    return output!;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]!));
}

/**
 * Word-wrap text into lines of at most `width` characters.
 */
export function wrapText(text: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    for (let i = 0; i < word.length; i += width) {
      const chunk = word.slice(i, i + width);
      if (!current) current = chunk;
      else if ((current + ' ' + chunk).length <= width) current += ' ' + chunk;
      else { lines.push(current); current = chunk; }
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Render text into a sticker (white text with black outline on transparent background).
 */
export async function textToSticker(text: string): Promise<Buffer> {
  const width = text.length <= 10 ? 6 : text.length <= 40 ? 10 : 16;
  const lines = wrapText(text, width).slice(0, 8);
  const longest = Math.max(...lines.map(l => l.length), 1);
  const fontSize = Math.min(120, Math.floor(STICKER_SIZE / (longest * 0.62)), Math.floor(STICKER_SIZE / (lines.length * 1.2)));
  const lineHeight = fontSize * 1.15;
  const startY = STICKER_SIZE / 2 - (lineHeight * (lines.length - 1)) / 2;

  const tspans = lines
    .map((line, i) => `<text x="50%" y="${startY + i * lineHeight}" dominant-baseline="middle">${escapeXml(line)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${STICKER_SIZE}" height="${STICKER_SIZE}">
<style>text{font-family:'DejaVu Sans',Arial,sans-serif;font-weight:bold;font-size:${fontSize}px;fill:#fff;stroke:#000;stroke-width:${Math.max(2, fontSize / 12)}px;paint-order:stroke;text-anchor:middle}</style>
${tspans}</svg>`;

  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}

/**
 * Embed sticker pack name / author into a WebP sticker (WhatsApp EXIF format).
 */
export async function addStickerMetadata(webp: Buffer, meta: StickerMetadata): Promise<Buffer> {
  const json = {
    'sticker-pack-id': randomUUID(),
    'sticker-pack-name': meta.pack,
    'sticker-pack-publisher': meta.author,
    emojis: ['😀'],
  };
  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf-8');
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);

  const img = new webpmux.Image();
  await img.load(webp);
  img.exif = exif;
  return img.save(null);
}

/**
 * Read sticker pack name / author from a WebP sticker.
 */
export async function readStickerMetadata(webp: Buffer): Promise<StickerMetadata | null> {
  const img = new webpmux.Image();
  await img.load(webp);
  if (!img.exif || img.exif.length <= 22) return null;
  try {
    const json = JSON.parse(img.exif.subarray(22).toString('utf-8'));
    return { pack: json['sticker-pack-name'] ?? '', author: json['sticker-pack-publisher'] ?? '' };
  } catch {
    return null;
  }
}

/**
 * Convert a sticker to a PNG image (first frame for animated stickers).
 */
export async function stickerToImage(webp: Buffer): Promise<Buffer> {
  return sharp(webp).png().toBuffer();
}

/**
 * Parse "pack|author" arguments.
 */
export function parseStickerMetadata(input: string, defaults: StickerMetadata): StickerMetadata {
  if (!input.trim()) return defaults;
  const [pack, author] = input.split('|').map(s => s.trim());
  return { pack: pack || defaults.pack, author: author ?? defaults.author };
}
