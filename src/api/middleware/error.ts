/**
 * Global error handler middleware.
 */
import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ name: 'api-error' });

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error({ error: err.message, stack: err.stack, url: req.url }, 'Dashboard error');

  res.status(500).render('layout', {
    title: 'Error',
    page: 'error',
    content: `<div class="error-page"><h2>Terjadi Kesalahan</h2><p>${err.message}</p></div>`,
  });
}
