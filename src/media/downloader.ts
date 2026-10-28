/**
 * Media Downloader — TikTok, Instagram Reels and YouTube via yt-dlp.
 */
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../config/index.js';

export type Platform = 'tiktok' | 'instagram' | 'youtube';

const PLATFORM_HOSTS: Record<Platform, string[]> = {
  tiktok: ['tiktok.com', 'vt.tiktok.com', 'vm.tiktok.com'],
  instagram: ['instagram.com', 'instagr.am'],
  youtube: ['youtube.com', 'youtu.be', 'music.youtube.com'],
};

/**
 * Validate a URL and return its platform, or null if unsupported.
 */
export function detectPlatform(input: string): Platform | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS) as [Platform, string[]][]) {
    if (hosts.some(h => host === h || host.endsWith('.' + h))) return platform;
  }
  return null;
}

export interface DownloadResult {
  buffer: Buffer;
  fileName: string;
  title: string;
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr = (stderr + d.toString()).slice(-2000); });
    const timer = setTimeout(() => { proc.kill('SIGKILL'); reject(new Error('Download timeout')); }, timeoutMs);
    proc.on('error', err => { clearTimeout(timer); reject(err); });
    proc.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

/**
 * Download a video (mp4) or audio (mp3) from a supported URL.
 */
export async function downloadMedia(url: string, mode: 'video' | 'audio'): Promise<DownloadResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dl-'));
  const maxMb = config.downloader.maxSizeMb;
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--restrict-filenames',
    '--max-filesize', `${maxMb}M`,
    '-o', path.join(dir, '%(id)s.%(ext)s'),
    '--print', 'after_move:%(title)s',
  ];
  if (config.downloader.cookiesFile) args.push('--cookies', config.downloader.cookiesFile);
  if (mode === 'audio') {
    args.push('-f', 'bestaudio/best', '-x', '--audio-format', 'mp3');
  } else {
    args.push(
      '-f', 'bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/bv*[height<=720]+ba/b[height<=720]/b',
      '--merge-output-format', 'mp4',
      '--remux-video', 'mp4'
    );
  }
  args.push('--', url);

  try {
    const stdout = await run(config.downloader.ytdlpPath, args, 5 * 60 * 1000);
    const files = await fs.readdir(dir);
    const file = files.find(f => mode === 'audio' ? f.endsWith('.mp3') : f.endsWith('.mp4')) ?? files[0];
    if (!file) throw new Error('File terlalu besar atau tidak ditemukan');
    const buffer = await fs.readFile(path.join(dir, file));
    if (buffer.length > maxMb * 1024 * 1024) throw new Error('File terlalu besar');
    const title = stdout.trim().split('\n').pop() || file;
    return { buffer, fileName: file, title };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
