/**
 * Dashboard API Server — Express + EJS server-rendered dashboard.
 */
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { authMiddleware, loginHandler, logoutHandler } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { groupRoutes } from './routes/groups.js';
import { memberRoutes } from './routes/members.js';
import { moderationRoutes } from './routes/moderation.js';
import { settingsRoutes } from './routes/settings.js';
import pino from 'pino';

const logger = pino({ name: 'api-server' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start the Express API server.
 */
export async function startApiServer(): Promise<void> {
  const app = express();

  // ── Security ──
  app.use(helmet({
    contentSecurityPolicy: false, // Allow inline styles for EJS
  }));

  // ── Body parsing ──
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ── Session ──
  app.use(session({
    secret: config.api.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }));

  // ── View engine ──
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // ── Static files ──
  app.use('/static', express.static(path.join(__dirname, 'public')));

  // ── Auth routes ──
  app.get('/login', (req, res) => {
    if ((req.session as any)?.authenticated) {
      return res.redirect('/');
    }
    res.render('login', { error: null });
  });
  app.post('/login', loginHandler);
  app.get('/logout', logoutHandler);

  // ── Protected routes ──
  app.use(authMiddleware);
  app.use('/', dashboardRoutes);
  app.use('/groups', groupRoutes);
  app.use('/members', memberRoutes);
  app.use('/moderation', moderationRoutes);
  app.use('/settings', settingsRoutes);

  // ── Error handler ──
  app.use(errorHandler);

  // ── Start server ──
  app.listen(config.api.port, config.api.host, () => {
    logger.info({ port: config.api.port, host: config.api.host }, 'Dashboard server started');
  });
}
