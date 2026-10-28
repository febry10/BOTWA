import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection.js';

export const settingsRoutes = Router();

settingsRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const groupSettings = await db('group_settings')
      .join('groups', 'groups.id', '=', 'group_settings.group_id')
      .select('group_settings.*', 'groups.name as group_name', 'groups.wa_group_id');

    res.render('settings', { title: 'Settings', groupSettings });
  } catch (error) {
    res.render('settings', { title: 'Settings', groupSettings: [] });
  }
});
