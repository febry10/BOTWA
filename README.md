# 🤖 GroupGuard — WhatsApp Group Moderation Bot

Bot WhatsApp Group production-ready, modular, aman, dan berkinerja tinggi yang dibangun khusus untuk mengelola dan memoderasi grup WhatsApp secara otomatis.

---

## 🌟 Fitur Utama

- **🛡️ Moderasi Otomatis & Real-time:**
  - **Deteksi Kata Kasar (Anti-Toxic):** Deteksi bertingkat (Exact match, Normalisasi leet speak & variasi karakter, serta Context Analysis untuk meminimalkan false positive).
  - **Sistem Warning:** Akumulasi peringatan otomatis dengan reset periodik & batas auto-action.
  - **Sistem Soft Mute:** Mute pengguna berbasis waktu (database-tracked) tanpa mengeluarkan dari grup.
  - **Anti Spam:** Sliding window rate limiting (berbasis Redis / In-memory fallback).
  - **Anti Flood:** Deteksi pesan berulang (duplicate), klausa emoji berlebihan, karakter berulang, dan tag/mention masal.
  - **Anti Link & Anti Invite:** Pengaturan pembatasan link domain (whitelist/blacklist) dan deteksi otomatis invite WhatsApp/Telegram/Discord.
- **👑 Sistem Akses & Peran Berjenjang:**
  - `OWNER` → `SUPER_ADMIN` → `ADMIN` → `MODERATOR` → `MEMBER`
  - Perlindungan otomatis admin dari aksi moderasi otomatis.
- **⚙️ Konfigurasi Per-Grup:**
  - Setiap grup memiliki pengaturan mandiri (rules, welcome, goodbye, toggle fitur, batas warning, duration mute, dll).
- **📊 Logging & Audit Trail:**
  - Log aktivitas moderasi dan log perintah admin tersimpan lengkap di database.
- **🖥️ Dashboard Web Admin:**
  - Tampilan monitoring modern berbasis Express.js + EJS untuk statistik grup, daftar member, log pelanggaran, dan konfigurasi.
- **💾 Auto Backup & Expiry Task:**
  - Periodic task untuk otomatis melepas mute/warning/ban yang kedaluwarsa serta scheduled `pg_dump` backup.

---

## 🛠️ Arsitektur & Teknologi

- **Runtime:** Node.js 20+ / TypeScript
- **WA Engine:** `@whiskeysockets/baileys`
- **Database:** PostgreSQL 16 (Knex.js Query Builder & Migrations)
- **Cache / Rate Limit:** Redis 7 (ioredis, dengan in-memory fallback otomatis)
- **Dashboard:** Express.js, EJS, Helmet, Express-Session
- **Testing:** Jest

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Prasyarat System
- Node.js >= 20.0.0
- PostgreSQL Server >= 14.0
- Redis Server (Opsional, disarankan)
- FFmpeg (wajib untuk fitur stiker GIF/video; sudah termasuk di image Docker)
- Docker & Docker Compose (Opsional, untuk kemudahan deployment)

### 2. Setup Manual

```bash
# Clone & install dependensi
npm install

# Salin berkas lingkungan (.env)
cp .env.example .env

# Edit .env sesuaikan dengan konfigurasi DB dan API Anda
nano .env

# Jalankan migrasi database & seed data awal
npm run db:migrate
npm run db:seed

# Build TypeScript
npm run build

# Jalankan bot
npm start
```

### 3. Setup dengan Docker Compose (Direkomendasikan untuk Production)

```bash
# Salin berkas .env
cp .env.example .env

# Jalankan semua service (Bot, Postgres, Redis)
docker-compose up -d --build

# Cek logs bot untuk melakukan Scan QR WhatsApp
docker-compose logs -f bot
```

---

## 📋 Daftar Command Bot

Prefix default: `!` (bisa diubah per grup menggunakan `!set prefix <char>`).

### 🌐 Umum (Setiap Member)
- `!help` / `!menu` — Menampilkan daftar command
- `!rules` — Menampilkan peraturan grup
- `!ping` — Cek respon & latensi bot
- `!info` — Informasi umum bot
- `!stats` — Statistik moderasi grup
- `!status` — Status kesehatan & uptime bot

### 🎨 Stiker (Setiap Member)
- `!sticker` / `!s` — Kirim gambar/GIF/video dengan caption `!s`, atau reply media dengan `!s` (video/GIF maks 30 detik, diambil 8 detik pertama)
- `!sticker NamaPack|Author` — Stiker dengan nama pack & author sendiri
- `!toimg` — Reply stiker untuk mengubahnya jadi gambar
- `!take NamaPack|Author` — Reply stiker untuk mengganti nama pack/author
- `!ttp <teks>` — Ubah teks jadi stiker

### 🎉 Seru-seruan di Grup
- `!dadu [jumlah]` — Lempar dadu (1-10 dadu)
- `!coinflip` — Lempar koin
- `!pilih a, b, c` — Bot memilihkan secara acak
- `!truth` / `!dare` — Main truth or dare
- `!jodoh @a @b` — Cek kecocokan (tanpa mention = dipasangkan acak)
- `!siapa <pertanyaan>` — Bot menunjuk member acak
- `!rate <sesuatu>` — Nilai 0-100
- `!apakah <pertanyaan>` / `!kapan <pertanyaan>` — Kerang ajaib
- `!quote` — Kata-kata motivasi
- `!tagall [pesan]` / `!hidetag [pesan]` — Tag semua member (Moderator ke atas)

### 🛡️ Moderasi (Moderator / Admin)
- `!warn @user [alasan]` — Memberikan peringatan ke pengguna
- `!warnings @user` — Melihat daftar peringatan aktif pengguna
- `!resetwarning @user` — Menghapus semua peringatan pengguna
- `!mute @user [durasi] [alasan]` — Mute pengguna (contoh: `!mute @user 30m spam`)
- `!unmute @user` — Melepas mute pengguna
- `!mutestatus @user` — Cek status mute pengguna
- `!kick @user [alasan]` — Mengeluarkan pengguna dari grup
- `!ban @user [alasan]` — Ban permanen pengguna
- `!tempban @user <durasi> [alasan]` — Ban sementara (contoh: `!tempban @user 1d melanggar rules`)
- `!unban @user` — Unban pengguna
- `!profile [@user]` — Melihat profil moderasi pengguna

### ⚙️ Pengaturan & Filter (Admin / Owner)
- `!settings` — Menampilkan status fitur & konfigurasi grup
- `!set <fitur> <on|off|value>` — Mengubah setting (contoh: `!set profanity on`, `!set warninglimit 3`)
- `!addword <kata> [LIGHT|MEDIUM|HEAVY]` — Menambah kata ke kata kasar terlarang
- `!delword <kata>` — Menghapus kata dari daftar kata kasar
- `!listword` — Melihat daftar kata kasar terlarang
- `!allowlink <domain>` — Mengizinkan domain (whitelist link)
- `!blocklink <domain>` — Memblokir domain (blacklist link)
- `!listlink` — Melihat daftar domain
- `!setwelcome <teks>` — Mengatur pesan selamat datang
- `!setgoodbye <teks>` — Mengatur pesan perpisahan
- `!setrules <teks>` — Mengatur peraturan grup
- `!whitelist @user` / `!unwhitelist @user` — Mengelola whitelist member
- `!blacklist @user [alasan]` / `!unblacklist @user` — Mengelola blacklist member
- `!promote @user` / `!demote @user` — Promosi/demosi admin

---

## 🧪 Pengujian (Testing)

Proyek ini telah dilengkapi dengan unit test untuk komponen inti moderasi:

```bash
# Jalankan unit test
npm test
```

---

## 📁 Struktur Direktori Proyek

```
BOTWA/
├── dist/                   # Output kompilasi JavaScript
├── src/
│   ├── api/                # Dashboard web Express & EJS views
│   ├── bot/                # Core Baileys WhatsApp client, events & commands
│   ├── config/             # Konfigurasi aplikasi & default settings
│   ├── database/           # Connection, Knex migrations (16 files) & seeds
│   ├── messages/           # Response templates & multi-language localization
│   ├── moderation/         # Engine deteksi (profanity, spam, flood, link, violation)
│   ├── services/           # Service layer DB (warning, mute, member, group, stats, logs)
│   ├── utils/              # Helper formatting, time, duration, JID
│   └── index.ts            # Main application entry point
├── tests/                  # Unit tests (Jest)
├── .env.example            # Template env vars
├── docker-compose.yml      # Orchestration container
├── Dockerfile              # Production Dockerfile
├── knexfile.ts             # Migration config
├── tsconfig.json           # Compiler options
└── package.json            # Project manifest
```

---

## 📄 Lisensi & Disclaimer

Aplikasi ini dikembangkan untuk penggunaan legal moderasi grup WhatsApp. Baileys adalah pustaka tidak resmi (*unofficial API*); harap gunakan secara bijak sesuai *Terms of Service* WhatsApp.
