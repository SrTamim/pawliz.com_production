import pool from '../config/database';

/**
 * Post reactions service
 * Love / Sad / Angry reactions for lost / found / rescue / adoption posts.
 * One reaction per user per post (Instagram-style toggle).
 */

export const POST_TYPES = ['lost', 'found', 'rescue', 'adoption'] as const;
export const REACTION_TYPES = ['love', 'sad', 'angry'] as const;

export type PostType = (typeof POST_TYPES)[number];
export type ReactionType = (typeof REACTION_TYPES)[number];

export interface ReactionCounts {
  love: number;
  sad: number;
  angry: number;
}

export interface ReactionState {
  counts: ReactionCounts;
  user_reaction: ReactionType | null;
}

export function isPostType(value: unknown): value is PostType {
  return typeof value === 'string' && (POST_TYPES as readonly string[]).includes(value);
}

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value);
}

/**
 * Insert or switch a user's reaction on a post (UPSERT on the unique key).
 */
export async function setReaction(
  postType: PostType,
  postId: number,
  userId: number,
  reactionType: ReactionType,
): Promise<void> {
  await pool.query(
    `INSERT INTO post_reactions (post_id, post_type, user_id, reaction_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (post_id, post_type, user_id)
     DO UPDATE SET reaction_type = EXCLUDED.reaction_type, created_at = CURRENT_TIMESTAMP`,
    [postId, postType, userId, reactionType],
  );
}

/**
 * Remove a user's reaction from a post (no-op if none exists).
 */
export async function removeReaction(
  postType: PostType,
  postId: number,
  userId: number,
): Promise<void> {
  await pool.query(
    `DELETE FROM post_reactions WHERE post_id = $1 AND post_type = $2 AND user_id = $3`,
    [postId, postType, userId],
  );
}

/**
 * Get this user's current reaction on a post (null when absent / not logged in).
 */
export async function getUserReaction(
  postType: PostType,
  postId: number,
  userId: number | null | undefined,
): Promise<ReactionType | null> {
  if (!userId) return null;
  const result = await pool.query(
    `SELECT reaction_type FROM post_reactions
     WHERE post_id = $1 AND post_type = $2 AND user_id = $3`,
    [postId, postType, userId],
  );
  return result.rows[0]?.reaction_type ?? null;
}

/**
 * Get reaction counts + this user's own reaction for a single post.
 */
export async function getReactionState(
  postType: PostType,
  postId: number,
  userId: number | null | undefined,
): Promise<ReactionState> {
  const countResult = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE reaction_type = 'love')  AS love,
        COUNT(*) FILTER (WHERE reaction_type = 'sad')   AS sad,
        COUNT(*) FILTER (WHERE reaction_type = 'angry') AS angry
     FROM post_reactions
     WHERE post_id = $1 AND post_type = $2`,
    [postId, postType],
  );

  const row = countResult.rows[0] || {};
  const counts: ReactionCounts = {
    love: parseInt(row.love, 10) || 0,
    sad: parseInt(row.sad, 10) || 0,
    angry: parseInt(row.angry, 10) || 0,
  };

  const user_reaction = await getUserReaction(postType, postId, userId);
  return { counts, user_reaction };
}

/**
 * Toggle logic: if the user's current reaction equals the incoming type, remove
 * it; otherwise set/switch to the incoming type. Returns the fresh state.
 */
export async function toggleReaction(
  postType: PostType,
  postId: number,
  userId: number,
  reactionType: ReactionType,
): Promise<ReactionState> {
  const current = await getUserReaction(postType, postId, userId);
  if (current === reactionType) {
    await removeReaction(postType, postId, userId);
  } else {
    await setReaction(postType, postId, userId, reactionType);
  }
  return getReactionState(postType, postId, userId);
}
