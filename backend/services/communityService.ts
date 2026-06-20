import pool from '../config/database';
import { deleteUploadedFiles } from '../utils/fileUtils';
import { upsertStackedCommentNotification } from './notificationService';
import logger from '../utils/logger';

/**
 * Community feed service.
 *
 * Scale-minded design:
 *  - reads the denormalized counter columns on community_posts (no aggregate
 *    JOINs in the feed).
 *  - keyset pagination on (created_at DESC, id DESC) — no COUNT(*), no OFFSET.
 *  - one batched viewer-reaction query per page (no N+1).
 */

type Row = Record<string, any>;

const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;
const MAX_IMAGES = 2;

export interface FeedParams {
  tags?: string[];
  cursor?: string | null;
  limit?: number;
  viewerId?: number | null;
}

interface CursorState {
  created_at: string;
  id: number;
}

function encodeCursor(createdAt: string | Date, id: number): string {
  const iso = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
  return Buffer.from(JSON.stringify({ created_at: iso, id })).toString('base64');
}

function decodeCursor(cursor: string): CursorState | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    if (parsed && typeof parsed.id === 'number' && typeof parsed.created_at === 'string') {
      return parsed;
    }
  } catch {
    /* malformed cursor → treat as no cursor */
  }
  return null;
}

/** SELECT list shared by feed + profile + single-post queries. */
const POST_SELECT = `
  cp.id, cp.user_id, cp.body, cp.images, cp.media_purged, cp.pet_id,
  cp.comment_count, cp.love_count, cp.sad_count, cp.angry_count,
  cp.is_hidden, cp.created_at, cp.updated_at,
  u.name AS author_name, u.profile_picture AS author_picture,
  pet.pet_id AS pet_public_id, pet.name AS pet_name, pet.images AS pet_images, pet.is_active AS pet_active,
  COALESCE(tags.tags, '[]'::json) AS tags
`;

const POST_FROM = `
  FROM community_posts cp
  JOIN users u ON u.id = cp.user_id
  LEFT JOIN pets pet ON pet.id = cp.pet_id
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object('id', t.id, 'slug', t.slug, 'label', t.label)) AS tags
    FROM community_post_tags pt JOIN community_tags t ON t.id = pt.tag_id
    WHERE pt.post_id = cp.id
  ) tags ON true
`;

/** Null out the pet chip when the linked pet was deleted or deactivated. */
function shapePost(row: Row): Row {
  const pet = row.pet_id && row.pet_active
    ? { id: row.pet_id, pet_id: row.pet_public_id, name: row.pet_name, images: row.pet_images || [] }
    : null;
  const { pet_public_id, pet_name, pet_images, pet_active, ...rest } = row;
  return {
    ...rest,
    images: row.media_purged ? [] : row.images || [],
    pet,
  };
}

/**
 * Keyset feed. Default window = last 20 days; widened to 45 days when any tag
 * filter is applied. The window is derived from `tags` and re-applied on every
 * page so filter changes mid-scroll can't skip/duplicate.
 */
export async function getFeed({ tags, cursor, limit, viewerId }: FeedParams = {}): Promise<{
  posts: Row[];
  next_cursor: string | null;
  has_more: boolean;
}> {
  const hasTags = Array.isArray(tags) && tags.length > 0;
  const windowDays = hasTags ? 45 : 20;
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const params: any[] = [];
  let where = `WHERE cp.is_active = true AND cp.is_hidden = false
    AND cp.created_at >= NOW() - ($${params.push(`${windowDays} days`)})::interval`;

  if (hasTags) {
    params.push(tags);
    where += ` AND EXISTS (
      SELECT 1 FROM community_post_tags pt JOIN community_tags t ON t.id = pt.tag_id
      WHERE pt.post_id = cp.id AND t.slug = ANY($${params.length})
    )`;
  }

  const decoded = cursor ? decodeCursor(cursor) : null;
  if (decoded) {
    params.push(decoded.created_at, decoded.id);
    // (created_at, id) < (cursor) → next page, descending.
    where += ` AND (cp.created_at, cp.id) < ($${params.length - 1}::timestamp, $${params.length})`;
  }

  params.push(safeLimit + 1);
  const result = await pool.query(
    `SELECT ${POST_SELECT} ${POST_FROM} ${where}
     ORDER BY cp.created_at DESC, cp.id DESC
     LIMIT $${params.length}`,
    params,
  );

  const rows = result.rows;
  const has_more = rows.length > safeLimit;
  const page = has_more ? rows.slice(0, safeLimit) : rows;
  const posts = page.map(shapePost);

  await attachViewerReactions(posts, viewerId);

  const last = page[page.length - 1];
  const next_cursor = has_more && last ? encodeCursor(last.created_at, last.id) : null;
  return { posts, next_cursor, has_more };
}

/** One query attaches each viewer's own reaction to its post (no per-card fetch). */
async function attachViewerReactions(posts: Row[], viewerId?: number | null): Promise<void> {
  if (!viewerId || posts.length === 0) return;
  const ids = posts.map((p) => p.id);
  const reactions = await pool.query(
    `SELECT post_id, reaction_type FROM post_reactions
     WHERE post_type = 'community' AND user_id = $1 AND post_id = ANY($2)`,
    [viewerId, ids],
  );
  const map = new Map<number, string>();
  for (const r of reactions.rows) map.set(r.post_id, r.reaction_type);
  for (const p of posts) p.user_reaction = map.get(p.id) ?? null;
}

export async function getById(id: number | string, viewerId?: number | null): Promise<Row | null> {
  const result = await pool.query(
    `SELECT ${POST_SELECT} ${POST_FROM}
     WHERE cp.id = $1 AND cp.is_active = true`,
    [id],
  );
  if (!result.rows[0]) return null;
  const post = shapePost(result.rows[0]);
  await attachViewerReactions([post], viewerId);
  return post;
}

/** Author's own posts (profile feed). Keyset on the user-scoped index. */
export async function getByUser(
  userId: number | string,
  cursor?: string | null,
  limit?: number,
  viewerId?: number | null,
): Promise<{ posts: Row[]; next_cursor: string | null; has_more: boolean }> {
  const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const params: any[] = [userId];
  let where = `WHERE cp.user_id = $1 AND cp.is_active = true`;

  const decoded = cursor ? decodeCursor(cursor) : null;
  if (decoded) {
    params.push(decoded.created_at, decoded.id);
    where += ` AND (cp.created_at, cp.id) < ($${params.length - 1}::timestamp, $${params.length})`;
  }
  params.push(safeLimit + 1);

  const result = await pool.query(
    `SELECT ${POST_SELECT} ${POST_FROM} ${where}
     ORDER BY cp.created_at DESC, cp.id DESC
     LIMIT $${params.length}`,
    params,
  );
  const has_more = result.rows.length > safeLimit;
  const page = has_more ? result.rows.slice(0, safeLimit) : result.rows;
  const posts = page.map(shapePost);
  await attachViewerReactions(posts, viewerId);
  const last = page[page.length - 1];
  return { posts, next_cursor: has_more && last ? encodeCursor(last.created_at, last.id) : null, has_more };
}

export async function getTags(): Promise<Row[]> {
  const result = await pool.query(
    `SELECT id, slug, label FROM community_tags WHERE is_active = true ORDER BY display_order, id`,
  );
  return result.rows;
}

/** Resolve tag slugs → ids, only active tags. Returns null if any slug invalid. */
async function resolveTagIds(slugs: string[]): Promise<number[] | null> {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return null;
  const result = await pool.query(
    `SELECT id, slug FROM community_tags WHERE slug = ANY($1) AND is_active = true`,
    [unique],
  );
  if (result.rows.length !== unique.length) return null;
  return result.rows.map((r) => r.id);
}

export async function createPost(
  userId: number,
  data: { body: string; pet_id?: number | null; tags: string[] },
  imagePaths: string[],
): Promise<Row | null> {
  const tagIds = await resolveTagIds(data.tags);
  if (!tagIds) {
    if (imagePaths.length > 0) deleteUploadedFiles(imagePaths);
    return null; // invalid/empty tags → route returns 400
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO community_posts (user_id, body, images, pet_id)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, data.body, JSON.stringify(imagePaths.slice(0, MAX_IMAGES)), data.pet_id || null],
    );
    const postId = inserted.rows[0].id;
    for (const tagId of tagIds) {
      await client.query(
        `INSERT INTO community_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [postId, tagId],
      );
    }
    await client.query('COMMIT');
    return getById(postId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    if (imagePaths.length > 0) deleteUploadedFiles(imagePaths); // orphan cleanup
    throw err;
  } finally {
    client.release();
  }
}

export async function updatePost(
  postId: number | string,
  userId: number,
  data: { body?: string; pet_id?: number | null; tags?: string[] },
  newImagePaths: string[],
  replaceImages: boolean,
): Promise<Row | null | 'forbidden' | 'invalid_tags'> {
  const check = await pool.query(
    `SELECT user_id, images FROM community_posts WHERE id = $1 AND is_active = true`,
    [postId],
  );
  if (!check.rows[0]) return null;
  if (check.rows[0].user_id !== userId) return 'forbidden';

  let images: string[] = check.rows[0].images || [];
  let removedPaths: string[] = [];
  if (replaceImages) {
    removedPaths = images; // caller is fully replacing the image set
    images = newImagePaths.slice(0, MAX_IMAGES);
  } else if (newImagePaths.length > 0) {
    images = [...images, ...newImagePaths].slice(0, MAX_IMAGES);
  }

  let tagIds: number[] | null = null;
  if (data.tags) {
    tagIds = await resolveTagIds(data.tags);
    if (!tagIds) return 'invalid_tags';
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE community_posts SET
         body = COALESCE($1, body),
         pet_id = $2,
         images = $3,
         updated_at = NOW()
       WHERE id = $4 AND user_id = $5`,
      [data.body ?? null, data.pet_id ?? null, JSON.stringify(images), postId, userId],
    );
    if (tagIds) {
      await client.query(`DELETE FROM community_post_tags WHERE post_id = $1`, [postId]);
      for (const tagId of tagIds) {
        await client.query(
          `INSERT INTO community_post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [postId, tagId],
        );
      }
    }
    await client.query('COMMIT');
    if (removedPaths.length > 0) deleteUploadedFiles(removedPaths); // orphan cleanup
    return getById(postId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    if (newImagePaths.length > 0) deleteUploadedFiles(newImagePaths);
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePost(postId: number | string, userId: number): Promise<'not_found' | 'forbidden' | 'ok'> {
  const check = await pool.query(
    `SELECT user_id, images FROM community_posts WHERE id = $1 AND is_active = true`,
    [postId],
  );
  if (!check.rows[0]) return 'not_found';
  if (check.rows[0].user_id !== userId) return 'forbidden';

  const images: string[] = check.rows[0].images || [];
  if (images.length > 0) deleteUploadedFiles(images);
  await pool.query(`UPDATE community_posts SET is_active = false, updated_at = NOW() WHERE id = $1`, [postId]);
  return 'ok';
}

/**
 * Add a comment to a community post: insert into the shared post_comments
 * table, bump the denormalized comment_count, then upsert a stacked author
 * notification (skipped for self-comments). All in one transaction.
 */
export async function addComment(
  postId: number | string,
  userId: number,
  commentText: string,
  commenterName?: string | null,
): Promise<Row | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query(
      `SELECT user_id FROM community_posts WHERE id = $1 AND is_active = true FOR UPDATE`,
      [postId],
    );
    if (!owner.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const commentResult = await client.query(
      `WITH inserted AS (
         INSERT INTO post_comments (post_id, post_type, user_id, comment_text)
         VALUES ($1, 'community', $2, $3) RETURNING *
       )
       SELECT i.*, u.name, u.profile_picture
       FROM inserted i JOIN users u ON u.id = i.user_id`,
      [postId, userId, commentText],
    );
    await client.query(
      `UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = $1`,
      [postId],
    );
    await client.query('COMMIT');

    const postOwnerId = owner.rows[0].user_id;
    if (postOwnerId !== userId) {
      await upsertStackedCommentNotification(
        postOwnerId,
        postId as number,
        userId,
        commenterName || 'Someone',
        `/community?post=${postId}`,
      );
    }
    return commentResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Decrement comment_count when a community comment is removed/hidden. */
export async function decrementCommentCount(postId: number | string): Promise<void> {
  await pool.query(
    `UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1`,
    [postId],
  );
}

/**
 * Per-post report. Mirrors the comment report flow: insert a report row,
 * bump report_count, auto-hide at the threshold. 23505 → already reported.
 */
const REPORT_HIDE_THRESHOLD = 3;

export async function reportPost(
  postId: number | string,
  userId: number,
  reason: string,
): Promise<'not_found' | 'self' | 'duplicate' | { hidden: boolean }> {
  const post = await pool.query(`SELECT user_id FROM community_posts WHERE id = $1 AND is_active = true`, [postId]);
  if (!post.rows[0]) return 'not_found';
  if (post.rows[0].user_id === userId) return 'self';

  try {
    await pool.query(
      `INSERT INTO community_post_reports (post_id, user_id, reason) VALUES ($1, $2, $3)`,
      [postId, userId, reason],
    );
  } catch (err: any) {
    if (err.code === '23505') return 'duplicate';
    throw err;
  }

  const updated = await pool.query(
    `UPDATE community_posts
     SET report_count = report_count + 1,
         is_hidden = CASE WHEN report_count + 1 >= $2 THEN true ELSE is_hidden END
     WHERE id = $1
     RETURNING is_hidden`,
    [postId, REPORT_HIDE_THRESHOLD],
  );
  return { hidden: !!updated.rows[0]?.is_hidden };
}

/**
 * Recompute denormalized counters from the source tables (drift heal). Run from
 * cron and callable by admin.
 */
export async function reconcileCounts(): Promise<number> {
  const result = await pool.query(`
    UPDATE community_posts cp SET
      comment_count = COALESCE(c.cnt, 0),
      love_count = COALESCE(r.love, 0),
      sad_count = COALESCE(r.sad, 0),
      angry_count = COALESCE(r.angry, 0)
    FROM (SELECT id FROM community_posts) ids
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS cnt FROM post_comments
      WHERE post_type = 'community' AND is_active = true AND is_hidden = false
      GROUP BY post_id
    ) c ON c.post_id = ids.id
    LEFT JOIN (
      SELECT post_id,
        COUNT(*) FILTER (WHERE reaction_type = 'love')  AS love,
        COUNT(*) FILTER (WHERE reaction_type = 'sad')   AS sad,
        COUNT(*) FILTER (WHERE reaction_type = 'angry') AS angry
      FROM post_reactions WHERE post_type = 'community'
      GROUP BY post_id
    ) r ON r.post_id = ids.id
    WHERE cp.id = ids.id
      AND (cp.comment_count <> COALESCE(c.cnt, 0)
        OR cp.love_count <> COALESCE(r.love, 0)
        OR cp.sad_count <> COALESCE(r.sad, 0)
        OR cp.angry_count <> COALESCE(r.angry, 0))
  `);
  if (result.rowCount) logger.info(`reconcileCounts healed ${result.rowCount} community post(s)`);
  return result.rowCount || 0;
}

/**
 * 45-day media purge. For each eligible post: delete its R2 objects FIRST, then
 * flip media_purged once delete succeeds (a failed delete retries next run).
 * Re-reads images inside the update so a concurrent edit isn't clobbered.
 * Post survives as a text-only post.
 */
export async function purgeOldMedia(): Promise<number> {
  const eligible = await pool.query(
    `SELECT id, images FROM community_posts
     WHERE created_at < NOW() - INTERVAL '45 days'
       AND media_purged = false
       AND jsonb_array_length(images) > 0`,
  );

  let purged = 0;
  for (const row of eligible.rows) {
    const images: string[] = row.images || [];
    if (images.length === 0) continue;
    try {
      await deleteUploadedFiles(images);
      await pool.query(
        `UPDATE community_posts SET images = '[]'::jsonb, media_purged = true, updated_at = NOW()
         WHERE id = $1 AND media_purged = false`,
        [row.id],
      );
      purged += 1;
    } catch (err) {
      logger.error(`purgeOldMedia failed for post ${row.id}:`, err);
    }
  }
  if (purged) logger.info(`purgeOldMedia cleared media on ${purged} community post(s)`);
  return purged;
}

export const _internal = { encodeCursor, decodeCursor, MAX_IMAGES };
