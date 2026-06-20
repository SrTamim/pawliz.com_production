import type { Request, Response } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';

// GET /api/v1/admin/community-posts/reported
router.get('/reported', authenticate, requirePermission('community-posts'), async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT cp.id, cp.body, cp.images, cp.report_count, cp.is_hidden, cp.created_at,
              u.name AS author_name, u.phone AS author_phone,
              json_agg(json_build_object('reason', cpr.reason, 'reporter', ru.name) ORDER BY cpr.created_at) AS reports
       FROM community_posts cp
       JOIN users u ON u.id = cp.user_id
       JOIN community_post_reports cpr ON cpr.post_id = cp.id
       JOIN users ru ON ru.id = cpr.user_id
       WHERE cp.report_count >= 1 AND cp.is_active = true
       GROUP BY cp.id, u.name, u.phone
       ORDER BY cp.report_count DESC, cp.created_at DESC`,
    );
    res.json({ posts: result.rows });
  } catch (err) {
    logger.error('Get reported community posts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/v1/admin/community-posts/:id — soft-delete
router.delete('/:id', authenticate, requirePermission('community-posts.delete'), async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });
  try {
    const result = await pool.query(
      `UPDATE community_posts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id`,
      [postId],
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Post not found' });
    logActivity(req.user!.id, 'community_post_deleted_admin', { postId, postType: 'community' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    logger.error('Admin delete community post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/admin/community-posts/:id/dismiss — clear reports + un-hide
router.post('/:id/dismiss', authenticate, requirePermission('community-posts.delete'), async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });
  try {
    const r = await pool.query(
      `UPDATE community_posts SET is_hidden = false, report_count = 0 WHERE id = $1 RETURNING id`,
      [postId],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Post not found' });
    await pool.query('DELETE FROM community_post_reports WHERE post_id = $1', [postId]);
    res.json({ message: 'Post cleared' });
  } catch (err) {
    logger.error('Admin dismiss community post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export = router;
