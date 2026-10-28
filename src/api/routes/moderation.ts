import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection.js';

export const moderationRoutes = Router();

moderationRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const [violations, muted, warnings] = await Promise.all([
      db('violations')
        .join('users', 'users.id', '=', 'violations.user_id')
        .join('groups', 'groups.id', '=', 'violations.group_id')
        .select('violations.*', 'users.name as user_name', 'users.wa_id', 'groups.name as group_name')
        .orderBy('violations.created_at', 'desc')
        .limit(100),
      db('mutes')
        .join('users', 'users.id', '=', 'mutes.user_id')
        .join('groups', 'groups.id', '=', 'mutes.group_id')
        .where({ 'mutes.active': true })
        .select('mutes.*', 'users.name as user_name', 'users.wa_id', 'groups.name as group_name')
        .orderBy('mutes.created_at', 'desc'),
      db('warnings')
        .join('users', 'users.id', '=', 'warnings.user_id')
        .join('groups', 'groups.id', '=', 'warnings.group_id')
        .where({ 'warnings.active': true })
        .select('warnings.*', 'users.name as user_name', 'users.wa_id', 'groups.name as group_name')
        .orderBy('warnings.created_at', 'desc')
        .limit(100),
    ]);

    res.render('moderation-logs', { title: 'Moderation', violations, muted, warnings });
  } catch (error) {
    res.render('moderation-logs', { title: 'Moderation', violations: [], muted: [], warnings: [] });
  }
});
