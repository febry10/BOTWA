export const COMMAND_MESSAGES = {
  ping: '🏓 Pong! Bot aktif.\nResponse time: {latency}ms',

  info: `🤖 *{botName}*
━━━━━━━━━━━━━━━━━━━━
Versi: 1.0.0
Prefix: {prefix}
Grup aktif: {groups}
Uptime: {uptime}
━━━━━━━━━━━━━━━━━━━━
Bot moderasi grup WhatsApp.
Ketik *{prefix}help* untuk bantuan.`,

  help: `📋 *DAFTAR PERINTAH*
━━━━━━━━━━━━━━━━━━━━

📌 *Umum*
{prefix}help — Bantuan
{prefix}rules — Peraturan grup
{prefix}ping — Cek bot
{prefix}info — Info bot
{prefix}stats — Statistik grup
{prefix}status — Status bot
{prefix}profile @user — Profil user

🎨 *Stiker*
{prefix}sticker / {prefix}s — Gambar/GIF/video jadi stiker (kirim dengan caption atau reply media)
{prefix}sticker pack|author — Stiker dengan nama pack sendiri
{prefix}toimg — Stiker jadi gambar (reply stiker)
{prefix}take pack|author — Ganti nama pack stiker (reply stiker)
{prefix}ttp teks — Teks jadi stiker

🎉 *Seru-seruan*
{prefix}dadu [jumlah] — Lempar dadu
{prefix}coinflip — Lempar koin
{prefix}pilih a, b, c — Pilihkan acak
{prefix}truth / {prefix}dare — Truth or dare
{prefix}jodoh @a @b — Cek kecocokan
{prefix}siapa pertanyaan — Tunjuk member acak
{prefix}rate sesuatu — Beri nilai 0-100
{prefix}apakah pertanyaan — Kerang ajaib
{prefix}kapan pertanyaan — Ramalan waktu
{prefix}quote — Kata-kata hari ini
{prefix}tagall pesan — Tag semua member (mod)
{prefix}hidetag pesan — Tag semua tanpa terlihat (mod)

🎮 *Level & RPG*
{prefix}level [@user] — Level, XP & rank
{prefix}leaderboard — Top member teraktif
{prefix}daily — Hadiah harian
{prefix}berburu — Berpetualang cari koin & XP
{prefix}duel @user [taruhan] — Duel simulasi
{prefix}terima / {prefix}tolak — Jawab tantangan duel
{prefix}leveling on/off/silent — Atur leveling (admin)

🤖 *AI & Media*
{prefix}ai pertanyaan — Ngobrol dengan AI (atau tag/reply bot)
{prefix}resetai — Hapus riwayat obrolan AI
{prefix}dl link — Unduh TikTok / IG Reels / YouTube
{prefix}ytmp3 link — Unduh audio mp3
{prefix}tts [kode bahasa] teks — Teks jadi suara

📅 *Pengingat*
{prefix}addreminder waktu | pesan — Tambah pengingat (admin)
{prefix}reminders — Daftar pengingat
{prefix}delreminder nomor — Hapus pengingat (admin)

🛡️ *Moderasi*
{prefix}warn @user — Warning
{prefix}warnings @user — Lihat warning
{prefix}resetwarning @user — Reset warning
{prefix}mute @user 30m — Mute user
{prefix}unmute @user — Unmute user
{prefix}mutestatus @user — Status mute
{prefix}kick @user — Kick user
{prefix}ban @user — Ban user
{prefix}unban @user — Unban user
{prefix}tempban @user 1h — Ban sementara

🔤 *Filter Kata*
{prefix}addword kata — Tambah kata
{prefix}delword kata — Hapus kata
{prefix}listword — Daftar kata

🔗 *Filter Link*
{prefix}allowlink domain — Izinkan domain
{prefix}blocklink domain — Blokir domain
{prefix}listlink — Daftar domain

👥 *Grup*
{prefix}setwelcome teks — Atur welcome
{prefix}setgoodbye teks — Atur goodbye
{prefix}setrules teks — Atur rules
{prefix}welcome on/off — Toggle welcome
{prefix}goodbye on/off — Toggle goodbye

👑 *Admin*
{prefix}admins — Daftar admin
{prefix}promote @user — Promosi admin
{prefix}demote @user — Turunkan admin
{prefix}whitelist @user — Whitelist user
{prefix}blacklist @user — Blacklist user

⚙️ *Pengaturan*
{prefix}settings — Lihat pengaturan
{prefix}set [option] [value] — Ubah pengaturan`,

  menu: `🤖 *{botName} — MENU*
━━━━━━━━━━━━━━━━━━━━

1️⃣ *{prefix}help* — Semua perintah
2️⃣ *{prefix}rules* — Peraturan
3️⃣ *{prefix}stats* — Statistik
4️⃣ *{prefix}settings* — Pengaturan
5️⃣ *{prefix}status* — Status bot

━━━━━━━━━━━━━━━━━━━━
Prefix: *{prefix}*
Ketik perintah untuk memulai.`,

  stats: `📊 *STATISTIK GRUP*
━━━━━━━━━━━━━━━━━━━━
Members: {members}
Warnings: {warnings}
Muted: {muted}
Banned: {banned}
Pesan dihapus: {deleted}
Spam terdeteksi: {spam}
Pesan toxic: {toxic}
━━━━━━━━━━━━━━━━━━━━
Periode: {period}`,

  botStatus: `🤖 *BOT STATUS*
━━━━━━━━━━━━━━━━━━━━
Status: {status}
Uptime: {uptime}
Grup: {groups}
Members dipantau: {members}
Pesan diproses: {processed}
Pesan dihapus: {deleted}
━━━━━━━━━━━━━━━━━━━━`,

  profile: `👤 *PROFIL MODERASI*
━━━━━━━━━━━━━━━━━━━━
User: {user}
Role: {role}
Warnings: {warnings}
Pelanggaran: {violations}
Muted: {muted}
Mute sampai: {muteUntil}
Blacklist: {blacklisted}
Bergabung: {joined}
Pelanggaran terakhir: {lastViolation}
━━━━━━━━━━━━━━━━━━━━`,

  settings: `⚙️ *PENGATURAN GRUP*
━━━━━━━━━━━━━━━━━━━━
Auto Moderation: {autoMod}
Profanity: {profanity}
Anti Spam: {antiSpam}
Anti Link: {antiLink}
Anti Flood: {antiFlood}
Welcome: {welcome}
Goodbye: {goodbye}

Warning Limit: {warningLimit}
Mute Duration: {muteDuration}
Auto Kick: {autoKick}
Dry Run: {dryRun}
━━━━━━━━━━━━━━━━━━━━`,

  settingUpdated: '✅ Pengaturan *{setting}* telah diubah menjadi *{value}*.',

  adminList: `👑 *DAFTAR ADMIN*
━━━━━━━━━━━━━━━━━━━━
{list}
━━━━━━━━━━━━━━━━━━━━`,

  promoted: '✅ {user} telah dipromosikan menjadi admin.',
  demoted: '✅ {user} telah diturunkan menjadi member.',

  kicked: '🚫 {user} telah dikeluarkan dari grup.\nAlasan: {reason}',
  banned: '🚫 {user} telah di-ban dari grup.\nAlasan: {reason}',
  unbanned: '✅ {user} telah di-unban.',
  tempBanned: '🚫 {user} telah di-ban selama *{duration}*.\nAlasan: {reason}',

  whitelisted: '✅ {user} telah ditambahkan ke whitelist.',
  unwhitelisted: '✅ {user} telah dihapus dari whitelist.',

  blacklisted: '🚫 {user} telah di-blacklist.\nAlasan: {reason}',
  unblacklisted: '✅ {user} telah dihapus dari blacklist.',

  wordAdded: '✅ Kata "*{word}*" telah ditambahkan ke daftar terlarang [{severity}].',
  wordDeleted: '✅ Kata "*{word}*" telah dihapus dari daftar terlarang.',
  wordExists: '⚠️ Kata "*{word}*" sudah ada di daftar terlarang.',
  wordNotFound: '❌ Kata "*{word}*" tidak ditemukan di daftar terlarang.',

  linkAllowed: '✅ Domain *{domain}* telah diizinkan.',
  linkBlocked: '🚫 Domain *{domain}* telah diblokir.',
  linkRemoved: '✅ Domain *{domain}* telah dihapus dari daftar.',

  rulesSet: '✅ Peraturan grup telah diperbarui.',

  // Anti-spam/flood notifications
  spamDetected: '⚠️ {user} terdeteksi melakukan spam.',
  floodDetected: '⚠️ {user} terdeteksi melakukan flood.',
  linkDetected: '🔗 {user} mengirim link yang tidak diizinkan.',
  inviteDetected: '🔗 {user} mengirim link undangan yang tidak diizinkan.',
  mentionSpam: '⚠️ {user} melakukan mention berlebihan.',
  profanityDetected: '🚫 {user} menggunakan kata yang tidak diperbolehkan.',
};
