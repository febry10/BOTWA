/**
 * Fun helpers — pure logic for group games (easy to unit test).
 */
import { createHash } from 'crypto';

export type Rng = () => number;

export function pickRandom<T>(items: readonly T[], rng: Rng = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}

export function rollDice(count: number, rng: Rng = Math.random): number[] {
  const n = Math.min(Math.max(Math.floor(count) || 1, 1), 10);
  return Array.from({ length: n }, () => 1 + Math.floor(rng() * 6));
}

export function flipCoin(rng: Rng = Math.random): 'Kepala' | 'Ekor' {
  return rng() < 0.5 ? 'Kepala' : 'Ekor';
}

/**
 * Split "a, b, c" / "a | b" / "a atau b" into choices.
 */
export function parseChoices(text: string): string[] {
  return text
    .split(/\s*(?:,|\||\batau\b|\bor\b)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Deterministic 0-100 score for a key, so asking the same thing twice gives the same answer.
 */
export function seededPercent(key: string): number {
  const hash = createHash('md5').update(key.trim().toLowerCase()).digest();
  return hash.readUInt32BE(0) % 101;
}

export function compatibility(a: string, b: string): number {
  return seededPercent([a, b].sort().join('|') + '|jodoh');
}

export function compatibilityComment(score: number): string {
  if (score >= 90) return 'Jodoh dunia akhirat! 💍';
  if (score >= 75) return 'Cocok banget, gas aja! 😍';
  if (score >= 50) return 'Lumayan, bisa dicoba 😊';
  if (score >= 25) return 'Hmm... perlu usaha lebih 😅';
  return 'Mending temenan aja 🤝';
}

export const APAKAH_ANSWERS = [
  'Iya', 'Tidak', 'Bisa jadi', 'Mungkin', 'Coba tanya lagi nanti',
  'Pastinya iya!', 'Jelas tidak', 'Sepertinya iya', 'Sepertinya tidak', 'Rahasia 🤫',
];

export const KAPAN_ANSWERS = [
  'Besok', 'Lusa', 'Minggu depan', 'Bulan depan', 'Tahun depan', '5 menit lagi',
  'Nanti malam', 'Sekarang juga!', 'Tidak akan pernah 😭', '10 tahun lagi', 'Kalau kamu sudah siap',
];

export const TRUTHS = [
  'Siapa orang yang terakhir kamu stalk di sosmed?',
  'Pernah naksir teman satu grup ini? Siapa?',
  'Apa kebohongan terbesar yang pernah kamu lakukan ke orang tua?',
  'Apa hal paling memalukan yang pernah kamu alami?',
  'Siapa mantan yang masih sering kamu pikirkan?',
  'Kapan terakhir kali kamu menangis dan kenapa?',
  'Apa kebiasaan burukmu yang belum ada yang tahu?',
  'Kalau bisa tukar hidup dengan 1 orang di grup ini, pilih siapa?',
  'Pernah pura-pura sakit supaya tidak sekolah/kerja?',
  'Apa isi chat terakhir yang kamu hapus?',
  'Siapa orang di grup ini yang paling kamu percaya?',
  'Apa hal paling konyol yang pernah kamu beli?',
  'Pernah ketahuan bohong? Ceritakan!',
  'Apa ketakutan terbesarmu?',
  'Siapa crush pertamamu?',
];

export const DARES = [
  'Kirim voice note nyanyi lagu favoritmu 15 detik!',
  'Ganti foto profil WA dengan foto lucu selama 1 jam!',
  'Chat orang terakhir di kontakmu dan bilang "aku kangen" 😆',
  'Kirim foto selfie dengan ekspresi paling jelek!',
  'Ketik nama crush kamu pakai siku!',
  'Pakai status WA "Aku lagi galau" selama 30 menit!',
  'Kirim stiker paling aneh yang kamu punya!',
  'Puji 3 member grup ini dengan tulus!',
  'Kirim voice note tertawa ala nenek sihir!',
  'Ceritakan lelucon paling garing yang kamu tahu!',
  'Tulis pantun untuk admin grup!',
  'Kirim screenshot riwayat pencarian terakhirmu!',
  'Bicara pakai bahasa daerah di 3 chat berikutnya!',
  'Kirim emoji yang menggambarkan perasaanmu ke setiap member yang balas!',
  'Rekam suara bilang "Aku cinta grup ini" dengan penuh semangat!',
];

export const QUOTES = [
  'Jangan menyerah, awal memang selalu sulit. — Anonim',
  'Kesuksesan adalah hasil dari persiapan, kerja keras, dan belajar dari kegagalan. — Colin Powell',
  'Hidup itu seperti bersepeda. Untuk menjaga keseimbangan, kamu harus terus bergerak. — Albert Einstein',
  'Mimpi tidak akan terwujud dengan sendirinya. Kamu harus bangun dan berusaha. — Anonim',
  'Orang yang hebat bukan yang tidak pernah jatuh, tapi yang selalu bangkit setelah jatuh. — Confucius',
  'Waktu adalah hal yang paling berharga, jangan sia-siakan. — Anonim',
  'Lakukan yang terbaik, biar Tuhan yang mengurus sisanya. — Anonim',
  'Belajar dari kemarin, hidup untuk hari ini, berharap untuk besok. — Albert Einstein',
  'Rezeki tidak akan tertukar. — Pepatah',
  'Sabar itu ada batasnya, kalau tidak ada batasnya namanya gratis ongkir. — Anonim 😄',
  'Rajin pangkal pandai, hemat pangkal kaya. — Pepatah',
  'Bukan seberapa cepat kamu sampai, tapi seberapa jauh kamu tidak berhenti. — Anonim',
];
