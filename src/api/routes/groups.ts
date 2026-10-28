/**
 * Groups routes — group listing and detail.
 */
import { Router, Request, Response } from 'express';
import { getAllGroups, getGroupSettings } from '../../services/group.service.js';
import { getGroupStats } from '../../services/stats.service.js';
import { getDb } from '../../database/connection.js';

export const groupRoutes = Router();

groupRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const groups = await getAllGroups();
    const groupsWithStats = await Promise.all(
      groups.map(async (g) => {
        const stats = await getGroupStats(g.id);
        return { ...g, stats };
      })
    );
    res.render('groups', { title: 'Groups', groups: groupsWithStats });
  } catch (error) {
    res.render('groups', { title: 'Groups', groups: [] });
  }
});

groupRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const groupId = parseInt(req.params.id as string, 10);
    const db = getDb();

    const group = await db('groups').where({ id: groupId }).first();
    if (!group) {
      res.status(404).render('groups', { title: 'Group Not Found', groups: [] });
      return;
    }

    const [settings, stats, members, recentViolations] = await Promise.all([
      getGroupSettings(groupId),
      getGroupStats(groupId),
      db('group_members')
        .join('users', 'users.id', '=', 'group_members.user_id')
        .where({ 'group_members.group_id': groupId })
        .select('group_members.*', 'users.wa_id', 'users.name')
        .orderByRaw("CASE role WHEN 'OWNER' THEN 1 WHEN 'SUPER_ADMIN' THEN 2 WHEN 'ADMIN' THEN 3 WHEN 'MODERATOR' THEN 4 ELSE 5 END")
        .limit(100),
      db('violations')
        .join('users', 'users.id', '=', 'violations.user_id')
        .where({ 'violations.group_id': groupId })
        .select('violations.*', 'users.wa_id', 'users.name')
        .orderBy('violations.created_at', 'desc')
        .limit(50),
    ]);

    res.render('group-detail', {
      title: group.name || 'Group Detail',
      group,
      settings,
      stats,
      members,
      recentViolations,
    });
  } catch (error) {
    res.status(500).render('groups', { title: 'Error', groups: [] });
  }
});
