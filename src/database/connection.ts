/**
 * Database connection module.
 * Provides a singleton Knex instance with health checking.
 */
import knex, { Knex } from 'knex';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

const logger = pino({ name: 'database' });

let db: Knex | null = null;

/**
 * Get the Knex database instance (singleton).
 */
export function getDb(): Knex {
  if (!db) {
    db = knex({
      client: 'pg',
      connection: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        user: config.database.user,
        password: config.database.password,
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      },
      log: {
        warn(msg) { logger.warn(msg); },
        error(msg) { logger.error(msg); },
        deprecate(msg) { logger.warn(msg); },
        debug(msg) { logger.debug(msg); },
      },
    });
  }
  return db;
}

/**
 * Check database connectivity.
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const result = await getDb().raw('SELECT 1 as ok');
    return result.rows?.[0]?.ok === 1;
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    return false;
  }
}

/**
 * Run pending migrations.
 */
export async function runMigrations(): Promise<void> {
  const distMigrations = path.resolve(process.cwd(), 'dist/database/migrations');
  const srcMigrations = path.resolve(process.cwd(), 'src/database/migrations');
  // Use compiled migrations only when running the compiled build (tsx/dev uses the .ts sources)
  const isDist = import.meta.url.endsWith('.js') && fs.existsSync(distMigrations);
  const migrationsDir = isDist ? distMigrations : srcMigrations;

  try {
    const [batch, log] = await getDb().migrate.latest({
      directory: migrationsDir,
      loadExtensions: isDist ? ['.js'] : ['.ts'],
    });
    if (log.length > 0) {
      logger.info({ batch, migrations: log }, 'Migrations completed');
    } else {
      logger.info('No pending migrations');
    }

    // Auto-seed default blacklist words if table is empty
    const db = getDb();
    const countRes = await db('blacklist_words').count('id as count').first();
    const wordCount = parseInt(String(countRes?.count || '0'), 10);
    if (wordCount === 0) {
      logger.info('Seeding default profanity blacklist words...');
      const seedPath = isDist
        ? './seeds/default_blacklist_words.js'
        : './seeds/default_blacklist_words.js';
      try {
        const { seed } = await import(seedPath);
        await seed(db);
        logger.info('Default profanity words seeded successfully');
      } catch (seedErr) {
        logger.warn({ seedErr }, 'Failed to auto-seed default blacklist words');
      }
    }
  } catch (error) {
    logger.error({ err: error, migrationsDir }, 'Migration failed');
    throw error;
  }
}

/**
 * Gracefully close the database connection.
 */
export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
    logger.info('Database connection closed');
  }
}
