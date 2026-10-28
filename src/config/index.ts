import dotenv from 'dotenv';
dotenv.config();

export const config = {
  bot: {
    prefix: process.env.BOT_PREFIX || '!',
    name: process.env.BOT_NAME || 'GroupGuard',
    timezone: process.env.BOT_TIMEZONE || 'Asia/Jakarta',
    dryRun: process.env.DRY_RUN === 'true',
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'botwa',
    user: process.env.DB_USER || 'botwa_user',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  api: {
    enabled: process.env.API_ENABLED !== 'false',
    port: parseInt(process.env.API_PORT || '3000', 10),
    host: process.env.API_HOST || '0.0.0.0',
    sessionSecret: process.env.SESSION_SECRET || 'change-this-secret-in-production-min-32-chars',
    dashboardUsername: process.env.DASHBOARD_USERNAME || 'admin',
    dashboardPassword: process.env.DASHBOARD_PASSWORD || 'admin123',
  },

  whatsapp: {
    sessionDir: process.env.WA_SESSION_DIR || './sessions',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
  },

  ai: {
    provider: (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY ? 'openai' : 'gemini')) as 'gemini' | 'openai',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || '',
  },

  downloader: {
    ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
    maxSizeMb: parseInt(process.env.DOWNLOAD_MAX_MB || '50', 10),
    cookiesFile: process.env.YTDLP_COOKIES || '',
  },

  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    dir: process.env.BACKUP_DIR || './backups',
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    cron: process.env.BACKUP_CRON || '0 2 * * *',
  },
} as const;

export type Config = typeof config;
