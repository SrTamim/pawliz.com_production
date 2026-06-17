import type { Request, Response } from 'express';
import express from 'express';
const router = express.Router();
import { body, validationResult } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth';
import upload from '../middleware/upload';
import * as communityService from '../services/communityService';
import * as reactionService from '../services/reactionService';
import * as lostFoundService from '../services/lostFoundService';
import pool from '../config/database';
import logger from '../utils/logger';

/**
 * Community feed routes.
 * Comments + reactions reuse the shared post_comments / post_reactions infra
 * via post_type='community'. Comment reporting / admin moderation / delete-own
 * are handled by the existing /api/v1/comments routes (no parallel code).
 */

const REPORT_REASONS = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'];

function imagePaths(req: Request): string[] {
  return req.files ? (req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`) : [];
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// ==================== TAGS ====================

router.get('/tags', async (_req: Request, res: Response) => {
  try {
    res.json({ tags: await communityService.getTags() });
  } catch (err) {
    logger.error('Get community tags error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== FEED ====================

// GET /api/v1/community/posts — keyset feed. Cacheable when anonymous.
router.get('/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const tags = parseTags(req.query.tags);
    const cursor = (req.query.cursor as string) || null;
    const limit = parseInt(req.query.limit as string) || undefined;
    const viewerId = req.user?.id ?? null;

    const result = await communityService.getFeed({ tags, cursor, limit, viewerId });

    if (!req.user) {
      // Anonymous body is user-independent → let the CDN collapse hits.
      res.set('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
    } else {
      res.set('Cache-Control', 'private, no-store');
    }
    res.json(result);
  } catch (err) {
    logger.error('Community feed error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/posts/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid post ID' });
    const post = await communityService.getById(id, req.user?.id ?? null);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (err) {
    logger.error('Get community post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/users/:userId/posts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: 'Invalid user ID' });
    const cursor = (req.query.cursor as string) || null;
    const limit = parseInt(req.query.limit as string) || undefined;
    const result = await communityService.getByUser(userId, cursor, limit, req.user?.id ?? null);
    res.json(result);
  } catch (err) {
    logger.error('Get user community posts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== CREATE / EDIT / DELETE ====================

router.post(
  '/posts',
  authenticate,
  upload.array('images', 2),
  [
    body('body').trim().notEmpty().withMessage('Post text is required').isLength({ max: 5000 }).withMessage('Post max 5000 chars'),
    body('pet_id').optional({ nullable: true, checkFalsy: true }).isInt().withMessage('Invalid pet'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    const paths = imagePaths(req);
    if (!errors.isEmpty()) {
      if (paths.length > 0) { try { require('../utils/fileUtils').deleteUploadedFiles(paths); } catch {} }
      return res.status(400).json({ errors: errors.array() });
    }

    const tags = parseTags(req.body.tags);
    if (tags.length === 0) {
      if (paths.length > 0) { try { require('../utils/fileUtils').deleteUploadedFiles(paths); } catch {} }
      return res.status(400).json({ error: 'At least one tag is required' });
    }

    try {
      const post = await communityService.createPost(
        req.user!.id,
        { body: req.body.body, pet_id: req.body.pet_id ? parseInt(req.body.pet_id) : null, tags },
        paths,
      );
      if (!post) return res.status(400).json({ error: 'Invalid tag(s)' });
      res.status(201).json({ message: 'Post created', post });
    } catch (err) {
      logger.error('Create community post error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

router.put(
  '/posts/:id',
  authenticate,
  upload.array('images', 2),
  [
    body('body').optional().trim().notEmpty().withMessage('Post text cannot be empty').isLength({ max: 5000 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    const paths = imagePaths(req);
    const replaceImages = req.body.replace_images === 'true' || req.body.replace_images === true;
    const rawTags = req.body.tags !== undefined ? parseTags(req.body.tags) : undefined;
    if (rawTags && rawTags.length === 0) return res.status(400).json({ error: 'At least one tag is required' });

    try {
      const result = await communityService.updatePost(
        postId,
        req.user!.id,
        { body: req.body.body, pet_id: req.body.pet_id ? parseInt(req.body.pet_id) : null, tags: rawTags },
        paths,
        replaceImages,
      );
      if (result === null) return res.status(404).json({ error: 'Post not found' });
      if (result === 'forbidden') return res.status(403).json({ error: 'Unauthorized' });
      if (result === 'invalid_tags') return res.status(400).json({ error: 'Invalid tag(s)' });
      res.json({ message: 'Post updated', post: result });
    } catch (err) {
      logger.error('Update community post error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

router.delete('/posts/:id', authenticate, async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });
  try {
    const result = await communityService.deletePost(postId, req.user!.id);
    if (result === 'not_found') return res.status(404).json({ error: 'Post not found' });
    if (result === 'forbidden') return res.status(403).json({ error: 'Unauthorized' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    logger.error('Delete community post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REPORT ====================

router.post(
  '/posts/:id/report',
  authenticate,
  [body('reason').isIn(REPORT_REASONS).withMessage('Invalid reason')],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: 'Invalid post ID' });

    try {
      const result = await communityService.reportPost(postId, req.user!.id, req.body.reason);
      if (result === 'not_found') return res.status(404).json({ error: 'Post not found' });
      if (result === 'self') return res.status(400).json({ error: 'Cannot report your own post' });
      if (result === 'duplicate') return res.status(409).json({ error: 'Already reported' });
      res.json({ message: 'Post reported', hidden: result.hidden });
    } catch (err) {
      logger.error('Report community post error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

// ==================== COMMENTS (shared post_comments via post_type='community') ====================

router.post(
  '/comments',
  authenticate,
  [
    body('post_id').isInt().withMessage('Invalid post ID'),
    body('comment_text').trim().notEmpty().withMessage('Comment cannot be empty').isLength({ max: 1000 }).withMessage('Comment max 1000 chars'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const comment = await communityService.addComment(
        parseInt(req.body.post_id), req.user!.id, req.body.comment_text, req.user!.name,
      );
      if (!comment) return res.status(404).json({ error: 'Post not found' });
      res.status(201).json({ message: 'Comment added', comment });
    } catch (err) {
      logger.error('Add community comment error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

// Reuse the shared comment fetch (filters is_active + is_hidden already).
router.get('/comments/:postId', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const { rows, total } = await lostFoundService.getComments('community', req.params.postId, limit, offset);
    res.json({ comments: rows, total, hasMore: offset + rows.length < total });
  } catch (err) {
    logger.error('Get community comments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete own comment — shared service, then decrement the denormalized count.
router.delete('/comments/:id', authenticate, async (req: Request, res: Response) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) return res.status(400).json({ error: 'Invalid comment ID' });
  try {
    // Resolve the owning post first so we can fix the denormalized counter.
    const lookup = await pool.query(
      `SELECT post_id FROM post_comments WHERE id = $1 AND post_type = 'community' AND is_active = true`,
      [commentId],
    );
    const result = await lostFoundService.deleteComment(commentId, req.user!.id);
    if (result === 'not_found') return res.status(404).json({ error: 'Comment not found' });
    if (result === 'forbidden') return res.status(403).json({ error: 'Unauthorized' });
    if (lookup.rows[0]) await communityService.decrementCommentCount(lookup.rows[0].post_id);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    logger.error('Delete community comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== REACTIONS (shared post_reactions, transactional counters) ====================

router.post(
  '/reactions',
  authenticate,
  [
    body('post_id').isInt().withMessage('Invalid post ID'),
    body('reaction_type').isIn(['love', 'sad', 'angry']).withMessage('Invalid reaction type'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const state = await reactionService.toggleReaction('community', parseInt(req.body.post_id), req.user!.id, req.body.reaction_type);
      res.json(state);
    } catch (err) {
      logger.error('Toggle community reaction error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

router.get('/reactions/:postId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.postId);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid post ID' });
    const state = await reactionService.getReactionState('community', id, req.user?.id ?? null);
    res.json(state);
  } catch (err) {
    logger.error('Get community reactions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export = router;
