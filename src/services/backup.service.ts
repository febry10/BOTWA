/**
 * Backup Service — Database backup scheduling and management.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';
import pino from 'pino';

const execAsync = promisify(exec);
const logger = pino({ name: 'backup-service' });

/**
 * Create a database backup using pg_dump.
 */
export async function createBackup(): Promise<string | null> {
  if (!config.backup.enabled) {
    logger.info('Backups are disabled');
    return null;
  }

  const backupDir = path.resolve(config.backup.dir);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `botwa_backup_${timestamp}.sql`;
  const filepath = path.join(backupDir, filename);

  const pgDumpCmd = [
    `PGPASSWORD="${config.database.password}"`,
    'pg_dump',
    `-h ${config.database.host}`,
    `-p ${config.database.port}`,
    `-U ${config.database.user}`,
    `-d ${config.database.name}`,
    '--format=custom',
    `--file="${filepath}"`,
  ].join(' ');

  try {
    await execAsync(pgDumpCmd);
    logger.info({ filepath }, 'Backup created successfully');

    // Clean old backups
    await cleanOldBackups(backupDir);

    return filepath;
  } catch (error) {
    logger.error({ error }, 'Backup failed');
    return null;
  }
}

/**
 * Remove backups older than the retention period.
 */
async function cleanOldBackups(backupDir: string): Promise<void> {
  const retentionMs = config.backup.retentionDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;

  try {
    const files = fs.readdirSync(backupDir);
    for (const file of files) {
      if (!file.startsWith('botwa_backup_')) continue;
      const filepath = path.join(backupDir, file);
      const stats = fs.statSync(filepath);
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(filepath);
        logger.info({ file }, 'Old backup removed');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to clean old backups');
  }
}
