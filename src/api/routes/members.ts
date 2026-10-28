import { Router, Request, Response } from 'express';
import { getDb } from '../../database/connection.js';

export const memberRoutes = Router();

memberRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const members = await db('users')
      .select('users.*')
      .orderBy('users.name')
      .limit(200);

    res.render('members', { title: 'Members', members });
  } catch (error) {
    res.render('members', { title: 'Members', members: [] });
  }
});
