import pool from '../config/database';
import { deleteUploadedFiles } from '../utils/fileUtils';
import { createNotification } from './notificationService';
import logger from '../utils/logger';

/**
 * Lost & Found service
 * Handles lost pet reports, found pet reports, comments
 */

interface FeedFilters {
  pet_type?: string;
  location?: string;
}

interface FeedPagination {
  page?: number;
  limit?: number;
  offset?: number;
}

type Row = Record<string, any>;

/**
 * Get lost pets feed with pagination
 * @returns { posts, total }
 */
export async function getLostFeed(
  { pet_type, location }: FeedFilters = {},
  { page, limit, offset }: FeedPagination = {},
): Promise<{ posts: Row[]; total: number }> {
  const baseFrom = `FROM lost_pet_reports lpr
    JOIN pets p ON p.id = lpr.pet_id
    JOIN users u ON u.id = p.user_id`;
  let where = ` WHERE p.is_active = true AND lpr.is_active = true AND lpr.is_found = false`;
  const params: any[] = [];

  if (pet_type) {
    params.push(pet_type);
    where += ` AND p.type = $${params.length}`;
  }
  if (location) {
    params.push(`%${location}%`);
    where += ` AND lpr.lost_location_name ILIKE $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${where}`, params);
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT lpr.*, p.id as pet_id, p.name, p.type, p.breed, p.color, p.images, p.gender, p.age, p.weight, p.potty_trained,
           u.id as owner_id, u.name as owner_name, u.profile_picture,
           COALESCE(cc.comment_count, 0) as comment_count,
           CASE WHEN lpr.is_found THEN 'reunited' ELSE 'lost' END as status
    ${baseFrom}
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM post_comments WHERE post_type = 'lost' AND is_active = true
      GROUP BY post_id
    ) cc ON cc.post_id = lpr.id
    ${where}
    ORDER BY lpr.reported_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { posts: result.rows, total: parseInt(countResult.rows[0].count) };
}

/**
 * Get lost pet post by ID
 */
export async function getLostById(id: number | string): Promise<Row | null> {
  const result = await pool.query(
    `SELECT lpr.*, p.id as pet_id, p.name, p.type, p.breed, p.color, p.images, p.gender, p.age, p.weight, p.potty_trained,
            u.id as owner_id, u.name as owner_name, u.profile_picture
     FROM lost_pet_reports lpr
     JOIN pets p ON p.id = lpr.pet_id
     JOIN users u ON u.id = p.user_id
     WHERE lpr.id = $1 AND lpr.is_active = true AND p.is_active = true`,
    [id],
  );
  return result.rows[0] || null;
}

/**
 * Get found pets feed with pagination
 * @returns { posts, total }
 */
export async function getFoundFeed(
  { pet_type, location }: FeedFilters = {},
  { page, limit, offset }: FeedPagination = {},
): Promise<{ posts: Row[]; total: number }> {
  const baseFrom = `FROM found_pet_reports fpr
    JOIN users u ON u.id = fpr.user_id`;
  let where = ` WHERE fpr.is_active = true AND fpr.status = 'found'`;
  const params: any[] = [];

  if (pet_type) {
    params.push(pet_type);
    where += ` AND fpr.pet_type = $${params.length}`;
  }
  if (location) {
    params.push(`%${location}%`);
    where += ` AND fpr.found_location_name ILIKE $${params.length}`;
  }

  const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${where}`, params);
  params.push(limit, offset);
  const result = await pool.query(
    `SELECT fpr.*, u.id as owner_id, u.name as owner_name, u.profile_picture,
           COALESCE(cc.comment_count, 0) as comment_count
    ${baseFrom}
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS comment_count
      FROM post_comments WHERE post_type = 'found' AND is_active = true
      GROUP BY post_id
    ) cc ON cc.post_id = fpr.id
    ${where}
    ORDER BY fpr.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { posts: result.rows, total: parseInt(countResult.rows[0].count) };
}

export async function getFoundById(id: number | string): Promise<Row | null> {
  const result = await pool.query(
    `SELECT fpr.*, u.id as owner_id, u.name as owner_name, u.profile_picture
     FROM found_pet_reports fpr
     JOIN users u ON u.id = fpr.user_id
     WHERE fpr.id = $1 AND fpr.is_active = true`,
    [id],
  );
  return result.rows[0] || null;
}

export async function createFoundReport(userId: number, data: Row, imagePaths: string[]): Promise<Row> {
  const {
    pet_type, color, gender, breed,
    found_location_name, found_latitude, found_longitude,
    found_date, description,
  } = data;

  const result = await pool.query(
    `INSERT INTO found_pet_reports
      (user_id, pet_type, color, gender, breed, found_location_name, found_latitude, found_longitude, found_date, images, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
    [
      userId, pet_type,
      color || null, gender || null, breed || null,
      found_location_name || null,
      found_latitude ? parseFloat(found_latitude) : null,
      found_longitude ? parseFloat(found_longitude) : null,
      found_date,
      imagePaths.length > 0 ? JSON.stringify(imagePaths) : null,
      description || null,
    ],
  );

  pool.query(
    `INSERT INTO activity_logs (event_type, post_id, post_type, pet_type, pet_color, pet_gender, pet_breed, user_id, location_name, event_date, additional_details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    ['found_report', result.rows[0].id, 'found', pet_type, color || null, gender || null, breed || null, userId, found_location_name || null, found_date, description || null],
  ).catch((err: Error) => logger.error('activity_logs insert failed:', err.message));

  return result.rows[0];
}

export async function updateFoundReport(postId: number | string, userId: number, data: Row, newImagePaths: string[]): Promise<Row | null> {
  const check = await pool.query(
    'SELECT images FROM found_pet_reports WHERE id = $1 AND user_id = $2 AND is_active = true',
    [postId, userId],
  );
  if (!check.rows[0]) return null;

  let images: string[] = check.rows[0].images || [];
  if (newImagePaths.length > 0) {
    images = [...images, ...newImagePaths].slice(-3);
  }

  const {
    pet_type, color, gender, breed,
    found_location_name, found_latitude, found_longitude,
    description, status,
  } = data;

  const result = await pool.query(
    `UPDATE found_pet_reports SET
      pet_type = COALESCE($1, pet_type),
      color = COALESCE($2, color),
      gender = COALESCE($3, gender),
      breed = COALESCE($4, breed),
      found_location_name = COALESCE($5, found_location_name),
      found_latitude = COALESCE($6, found_latitude),
      found_longitude = COALESCE($7, found_longitude),
      images = $8,
      description = COALESCE($9, description),
      status = COALESCE($10, status),
      updated_at = NOW()
    WHERE id = $11 AND user_id = $12
    RETURNING *`,
    [
      pet_type || null, color || null, gender || null, breed || null,
      found_location_name || null,
      found_latitude ? parseFloat(found_latitude) : null,
      found_longitude ? parseFloat(found_longitude) : null,
      images.length > 0 ? JSON.stringify(images) : null,
      description || null, status || null,
      postId, userId,
    ],
  );
  return result.rows[0] || null;
}

export async function deleteFoundReport(postId: number | string, userId: number): Promise<boolean> {
  const check = await pool.query(
    'SELECT images FROM found_pet_reports WHERE id = $1 AND user_id = $2',
    [postId, userId],
  );
  if (!check.rows[0]) return false;

  const images: string[] = check.rows[0].images || [];
  if (images.length > 0) deleteUploadedFiles(images);

  await pool.query(
    "UPDATE found_pet_reports SET is_active = false, status = 'resolved', updated_at = NOW() WHERE id = $1",
    [postId],
  );

  pool.query(
    `INSERT INTO activity_logs (event_type, post_id, post_type, user_id) VALUES ('found_report_deleted', $1, 'found', $2)`,
    [postId, userId],
  ).catch((err: Error) => logger.error('activity_logs insert failed:', err.message));

  return true;
}

export async function addComment(
  postId: number | string,
  postType: string,
  userId: number,
  commentText: string,
  commenterName?: string | null,
): Promise<Row> {
  const [commentResult, ownerResult] = await Promise.all([
    pool.query(
      `WITH inserted AS (
         INSERT INTO post_comments (post_id, post_type, user_id, comment_text)
         VALUES ($1, $2, $3, $4) RETURNING *
       )
       SELECT i.*, u.name, u.profile_picture
       FROM inserted i JOIN users u ON u.id = i.user_id`,
      [postId, postType, userId, commentText],
    ),
    pool.query(
      postType === 'lost'
        ? `SELECT p.user_id FROM lost_pet_reports lpr JOIN pets p ON p.id = lpr.pet_id WHERE lpr.id = $1`
        : `SELECT user_id FROM found_pet_reports WHERE id = $1`,
      [postId],
    ),
  ]);

  if (ownerResult.rows[0]) {
    const { user_id: postOwnerId } = ownerResult.rows[0];
    if (postOwnerId !== userId) {
      const name = commenterName || 'Someone';
      await createNotification(
        postOwnerId,
        'comment_on_post',
        `New comment on your ${postType} post`,
        `${name} commented on your ${postType} pet post: "${commentText.substring(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
        postId as number,
        postType,
        userId,
        `/lost-found?post=${postId}&type=${postType}`,
      );
    }
  }

  return commentResult.rows[0];
}

export async function getComments(
  postType: string,
  postId: number | string,
  limit = 20,
  offset = 0,
): Promise<{ rows: Row[]; total: number }> {
  const [result, countResult] = await Promise.all([
    pool.query(
      `SELECT pc.*, u.name, u.profile_picture FROM post_comments pc
       JOIN users u ON u.id = pc.user_id
       WHERE pc.post_id = $1 AND pc.post_type = $2 AND pc.is_active = true AND pc.is_hidden = false
       ORDER BY pc.created_at DESC
       LIMIT $3 OFFSET $4`,
      [postId, postType, limit, offset],
    ),
    pool.query(
      `SELECT COUNT(*) FROM post_comments WHERE post_id = $1 AND post_type = $2 AND is_active = true AND is_hidden = false`,
      [postId, postType],
    ),
  ]);
  const total = parseInt(countResult.rows[0].count);
  return { rows: result.rows, total };
}

export async function deleteComment(commentId: number | string, userId: number): Promise<'not_found' | 'forbidden' | 'ok'> {
  const check = await pool.query(
    'SELECT user_id FROM post_comments WHERE id = $1',
    [commentId],
  );
  if (!check.rows[0]) return 'not_found';
  if (check.rows[0].user_id !== userId) return 'forbidden';

  await pool.query('UPDATE post_comments SET is_active = false WHERE id = $1', [commentId]);
  return 'ok';
}
