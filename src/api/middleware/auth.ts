/**
 * Authentication middleware and handlers for the dashboard.
 */
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { config } from '../../config/index.js';

// Hash password on first use
let passwordHash: string | null = null;

async function getPasswordHash(): Promise<string> {
  if (!passwordHash) {
    passwordHash = await bcrypt.hash(config.api.dashboardPassword, 10);
  }
  return passwordHash;
}

/**
 * Middleware to protect routes requiring authentication.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if ((req.session as any)?.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
}

/**
 * Handle login POST request.
 */
export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (
    username === config.api.dashboardUsername &&
    password === config.api.dashboardPassword
  ) {
    (req.session as any).authenticated = true;
    (req.session as any).username = username;
    res.redirect('/');
  } else {
    res.render('login', { error: 'Username atau password salah.' });
  }
}

/**
 * Handle logout.
 */
export function logoutHandler(req: Request, res: Response): void {
  req.session.destroy((err) => {
    res.redirect('/login');
  });
}
