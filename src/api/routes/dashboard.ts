/**
 * Dashboard routes — main dashboard page.
 */
import { Router, Request, Response } from 'express';
import { getGroupCount } from '../../services/group.service.js';
import { getTotalMembersMonitored, getTotalMessagesProcessed, getTotalMessagesDeleted } from '../../services/stats.service.js';
import { getUptime } from '../../bot/client.js';
import { formatUptime } from '../../utils/format.js';
import { getDb } from '../../database/connection.js';

export const dashboardRoutes = Router();

dashboardRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const [groups, members, processed, deleted] = await Promise.all([
      getGroupCount(),
      getTotalMembersMonitored(),
      getTotalMessagesProcessed(),
      getTotalMessagesDeleted(),
    ]);

    const db = getDb();
    const activeWarnings = await db('warnings').where({ active: true }).count('id as count').first();
    const activeMutes = await db('mutes').where({ active: true }).count('id as count').first();
    const activeBans = await db('banned_users').where({ active: true }).count('id as count').first();

    const recentLogs = await db('admin_logs')
      .join('users as admin', 'admin.id', '=', 'admin_logs.admin_user_id')
      .leftJoin('groups', 'groups.id', '=', 'admin_logs.group_id')
      .select('admin_logs.*', 'admin.name as admin_name', 'groups.name as group_name')
      .orderBy('admin_logs.created_at', 'desc')
      .limit(20);

    res.render('dashboard', {
      title: 'Dashboard',
      stats: {
        groups,
        members,
        processed,
        deleted,
        warnings: parseInt(String(activeWarnings?.count || '0'), 10),
        muted: parseInt(String(activeMutes?.count || '0'), 10),
        banned: parseInt(String(activeBans?.count || '0'), 10),
        uptime: formatUptime(getUptime()),
      },
      recentLogs,
    });
  } catch (error) {
    res.render('dashboard', {
      title: 'Dashboard',
      stats: { groups: 0, members: 0, processed: 0, deleted: 0, warnings: 0, muted: 0, banned: 0, uptime: '0s' },
      recentLogs: [],
    });
  }
});
