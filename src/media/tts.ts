/**
 * Text to Speech — Google Translate TTS, converted to a WhatsApp voice note (ogg/opus).
 */
import googleTTS from 'google-tts-api';
import { spawn } from 'child_process';

export const TTS_MAX_CHARS = 500;

export const TTS_LANGUAGES: Record<string, string> = {
  id: 'Indonesia', en: 'Inggris', ja: 'Jepang', ko: 'Korea', ar: 'Arab', jw: 'Jawa',
  su: 'Sunda', ms: 'Melayu', zh: 'Mandarin', es: 'Spanyol', fr: 'Prancis', de: 'Jerman',
  hi: 'Hindi', th: 'Thailand', ru: 'Rusia', it: 'Italia', pt: 'Portugis', tr: 'Turki',
};

/**
 * Parse "!tts [lang] text" arguments.
 */
export function parseTtsArgs(args: string[]): { lang: string; text: string } {
  const first = args[0]?.toLowerCase();
  if (first && TTS_LANGUAGES[first] && args.length > 1) {
    return { lang: first, text: args.slice(1).join(' ').trim() };
  }
  return { lang: 'id', text: args.join(' ').trim() };
}

function mp3ToOpus(mp3: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-i', 'pipe:0', '-vn', '-c:a', 'libopus', '-b:a', '48k', '-f', 'ogg', 'pipe:1'], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const chunks: Buffer[] = [];
    proc.stdout.on('data', c => chunks.push(c));
    proc.on('error', reject);
    proc.on('close', code => (code === 0 ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg exited with ${code}`))));
    proc.stdin.on('error', () => { /* handled by close */ });
    proc.stdin.end(mp3);
  });
}

/**
 * Synthesize speech and return an ogg/opus voice note.
 */
export async function textToSpeech(text: string, lang = 'id'): Promise<Buffer> {
  const parts = await googleTTS.getAllAudioBase64(text, { lang, slow: false, host: 'https://translate.google.com', splitPunct: ',.?!' });
  const mp3 = Buffer.concat(parts.map(p => Buffer.from(p.base64, 'base64')));
  return mp3ToOpus(mp3);
}
