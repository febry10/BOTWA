/**
 * Main Entry Point — Initializes database, bot, dashboard, and scheduled tasks.
 */
import dotenv from 'dotenv';
dotenv.config();

import pino from 'pino';
import { CronJob } from 'cron';
import { config } from './config/index.js';
import { getDb, checkDbHealth, runMigrations, closeDb } from './database/connection.js';
import { connectToWhatsApp, disconnectBot } from './bot/client.js';
import { handleMessages } from './bot/events/message.js';
import { handleGroupParticipantsUpdate } from './bot/events/group-participants.js';
import { expireWarnings } from './services/warning.service.js';
import { expireMutes } from './services/mute.service.js';
import { expireBans } from './services/blacklist.service.js';
import { createBackup } from './services/backup.service.js';
import { cleanupMemoryTracker } from './moderation/spam/detector.js';

const logger = pino({ level: config.logging.level, name: 'botwa' });

/**
 * Main startup function.
 */
async function main(): Promise<void> {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  🤖 GroupGuard WhatsApp Bot v1.0.0');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info({ env: process.env.NODE_ENV || 'development' }, 'Starting bot...');

  // ── Step 1: Check database connection ──
  logger.info('Checking database connection...');
  const dbHealthy = await checkDbHealth();
  if (!dbHealthy) {
    logger.error('Database connection failed. Please check your configuration.');
    process.exit(1);
  }
  logger.info('Database connected successfully');

  // ── Step 2: Run migrations ──
  logger.info('Running database migrations...');
  await runMigrations();

  // ── Step 3: Start scheduled tasks ──
  startScheduledTasks();

  // ── Step 4: Start dashboard (if enabled) ──
  if (config.api.enabled) {
    try {
      const { startApiServer } = await import('./api/server.js');
      await startApiServer();
      logger.info({ port: config.api.port }, 'Dashboard started');
    } catch (error) {
      logger.warn({ error }, 'Failed to start dashboard (non-critical)');
    }
  }

  // ── Step 5: Connect to WhatsApp ──
  logger.info('Connecting to WhatsApp...');
  await connectToWhatsApp(handleMessages, handleGroupParticipantsUpdate);
}

/**
 * Start periodic scheduled tasks.
 */
function startScheduledTasks(): void {
  // Expire warnings every 15 minutes
  const warningCron = new CronJob('*/15 * * * *', async () => {
    try {
      await expireWarnings();
    } catch (error) {
      logger.error({ error }, 'Warning expiry cron failed');
    }
  });
  warningCron.start();

  // Expire mutes every minute
  const muteCron = new CronJob('* * * * *', async () => {
    try {
      const expired = await expireMutes();
      // Note: Auto-unmute notifications are sent when muted user sends a message.
      // This cron just cleans up the database state.
    } catch (error) {
      logger.error({ error }, 'Mute expiry cron failed');
    }
  });
  muteCron.start();

  // Expire temporary bans every 5 minutes
  const banCron = new CronJob('*/5 * * * *', async () => {
    try {
      await expireBans();
    } catch (error) {
      logger.error({ error }, 'Ban expiry cron failed');
    }
  });
  banCron.start();

  // Cleanup in-memory spam tracker every 2 minutes
  const cleanupCron = new CronJob('*/2 * * * *', () => {
    cleanupMemoryTracker();
  });
  cleanupCron.start();

  // Database backup (configurable schedule)
  if (config.backup.enabled) {
    const backupCron = new CronJob(config.backup.cron, async () => {
      try {
        const filepath = await createBackup();
        if (filepath) {
          logger.info({ filepath }, 'Scheduled backup completed');
        }
      } catch (error) {
        logger.error({ error }, 'Scheduled backup failed');
      }
    });
    backupCron.start();
    logger.info({ schedule: config.backup.cron }, 'Backup scheduler started');
  }

  logger.info('Scheduled tasks started');
}

// ── Graceful Shutdown ──
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down...');

  try {
    await disconnectBot();
    await closeDb();
  } catch (error) {
    logger.error({ error }, 'Error during shutdown');
  }

  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Global Error Handlers ──
process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught exception');
  // Don't exit — let the bot try to recover
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
  // Don't exit — let the bot try to recover
});

// ── Start ──
main().catch((error) => {
  logger.fatal({ error }, 'Fatal error during startup');
  process.exit(1);
});
