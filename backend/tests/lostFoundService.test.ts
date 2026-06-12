import './setup';
import _pool from '../config/database';
const pool = _pool as any;

jest.mock('../utils/fileUtils', () => ({ deleteUploadedFiles: jest.fn() }));
jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));

import * as _lostFoundService from '../services/lostFoundService';
const lostFoundService = _lostFoundService as any;
import { deleteUploadedFiles } from '../utils/fileUtils';
import { createNotification as _createNotification } from '../services/notificationService';
const createNotification = _createNotification as any;

const pagination = { page: 1, limit: 20, offset: 0 };

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

// ==================== getLostFeed ====================

describe('lostFoundService.getLostFeed', () => {
  it('returns posts and total with no filters', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '7' }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Buddy' }, { id: 2, name: 'Rex' }] });

    const result = await lostFoundService.getLostFeed({}, pagination);
    expect(result.total).toBe(7);
    expect(result.posts).toHaveLength(2);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  it('appends pet_type filter to query', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [] });

    await lostFoundService.getLostFeed({ pet_type: 'cat' }, pagination);
    const countSql = pool.query.mock.calls[0][0];
    expect(countSql).toMatch(/p\.type = \$1/);
    expect(pool.query.mock.calls[0][1][0]).toBe('cat');
  });

  it('appends location ILIKE filter', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await lostFoundService.getLostFeed({ location: 'Dhaka' }, pagination);
    const countSql = pool.query.mock.calls[0][0];
    expect(countSql).toMatch(/ILIKE/);
    expect(pool.query.mock.calls[0][1][0]).toBe('%Dhaka%');
  });

  it('combines both filters', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [] });

    await lostFoundService.getLostFeed({ pet_type: 'dog', location: 'Sylhet' }, pagination);
    const params = pool.query.mock.calls[0][1];
    expect(params).toContain('dog');
    expect(params).toContain('%Sylhet%');
  });
});

// ==================== getLostById ====================

describe('lostFoundService.getLostById', () => {
  it('returns post when found', async () => {
    const post = { id: 5, name: 'Buddy' };
    pool.query.mockResolvedValueOnce({ rows: [post] });
    const result = await lostFoundService.getLostById(5);
    expect(result).toEqual(post);
    expect(pool.query.mock.calls[0][1][0]).toBe(5);
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await lostFoundService.getLostById(999);
    expect(result).toBeNull();
  });
});

// ==================== getFoundFeed ====================

describe('lostFoundService.getFoundFeed', () => {
  it('returns posts and total', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({ rows: [{ id: 10 }] });

    const result = await lostFoundService.getFoundFeed({}, pagination);
    expect(result.total).toBe(3);
    expect(result.posts).toHaveLength(1);
  });

  it('appends pet_type filter', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] });

    await lostFoundService.getFoundFeed({ pet_type: 'dog' }, pagination);
    const countSql = pool.query.mock.calls[0][0];
    expect(countSql).toMatch(/fpr\.pet_type = \$1/);
  });
});

// ==================== getFoundById ====================

describe('lostFoundService.getFoundById', () => {
  it('returns found post', async () => {
    const post = { id: 3, pet_type: 'cat' };
    pool.query.mockResolvedValueOnce({ rows: [post] });
    expect(await lostFoundService.getFoundById(3)).toEqual(post);
  });

  it('returns null when not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await lostFoundService.getFoundById(999)).toBeNull();
  });
});

// ==================== createFoundReport ====================

describe('lostFoundService.createFoundReport', () => {
  const reportData = {
    pet_type: 'dog', found_date: '2026-05-10',
    color: 'brown', gender: 'male', breed: 'Labrador',
    found_location_name: 'Mirpur', found_latitude: '23.8', found_longitude: '90.4',
    description: 'Friendly dog',
  };

  it('inserts report without images and returns row', async () => {
    const row = { id: 20, pet_type: 'dog' };
    pool.query
      .mockResolvedValueOnce({ rows: [row] })                              // INSERT
      .mockResolvedValueOnce({ rows: [{ name: 'Alice', phone: '017', email: 'a@b.com' }] }); // reporter

    const result = await lostFoundService.createFoundReport(5, reportData, []);
    expect(result).toEqual(row);
    const insertParams = pool.query.mock.calls[0][1];
    expect(insertParams[0]).toBe(5);          // user_id
    expect(insertParams[9]).toBeNull();        // images null when empty
  });

  it('stores JSON image paths when provided', async () => {
    const row = { id: 21, pet_type: 'dog' };
    pool.query
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [{ name: 'Bob', phone: '018', email: 'b@c.com' }] });

    const imagePaths = ['/uploads/a.jpg', '/uploads/b.jpg'];
    await lostFoundService.createFoundReport(5, reportData, imagePaths);
    const insertParams = pool.query.mock.calls[0][1];
    // service uses JSON.stringify for JSONB — param is a JSON string
    expect(insertParams[9]).toEqual(JSON.stringify(imagePaths));
  });

  it('coerces coordinates to float', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 22 }] })
      .mockResolvedValueOnce({ rows: [{ name: 'X', phone: '0', email: 'x@y' }] });

    await lostFoundService.createFoundReport(5, reportData, []);
    const insertParams = pool.query.mock.calls[0][1];
    expect(insertParams[6]).toBe(23.8);  // found_latitude
    expect(insertParams[7]).toBe(90.4);  // found_longitude
  });
});

// ==================== updateFoundReport ====================

describe('lostFoundService.updateFoundReport', () => {
  it('returns null when post not found or not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await lostFoundService.updateFoundReport(1, 5, {}, []);
    expect(result).toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('updates and returns post', async () => {
    const updated = { id: 1, pet_type: 'cat' };
    pool.query
      .mockResolvedValueOnce({ rows: [{ images: null }] })  // ownership check
      .mockResolvedValueOnce({ rows: [updated] });           // UPDATE

    const result = await lostFoundService.updateFoundReport(1, 5, { pet_type: 'cat' }, []);
    expect(result).toEqual(updated);
  });

  it('keeps last 3 images when merging old + new', async () => {
    const existingImages = ['/uploads/1.jpg', '/uploads/2.jpg', '/uploads/3.jpg'];
    pool.query
      // pg returns parsed array from JSONB, not a JSON string
      .mockResolvedValueOnce({ rows: [{ images: existingImages }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await lostFoundService.updateFoundReport(1, 5, {}, ['/uploads/4.jpg']);
    const updateParams = pool.query.mock.calls[1][1];
    // service uses JSON.stringify — param is JSON string
    const parsedImages = JSON.parse(updateParams[7]);
    expect(parsedImages).toHaveLength(3);
    expect(parsedImages).toContain('/uploads/4.jpg');
    expect(parsedImages).not.toContain('/uploads/1.jpg'); // oldest dropped
  });

  it('handles no existing images and no new images', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ images: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });

    await lostFoundService.updateFoundReport(1, 5, {}, []);
    const updateParams = pool.query.mock.calls[1][1];
    expect(updateParams[7]).toBeNull(); // images param
  });
});

// ==================== deleteFoundReport ====================

describe('lostFoundService.deleteFoundReport', () => {
  it('returns false when post not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await lostFoundService.deleteFoundReport(1, 5)).toBe(false);
  });

  it('soft deletes and returns true', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ images: null }] }) // SELECT
      .mockResolvedValueOnce({ rows: [] });                // UPDATE is_active=false

    expect(await lostFoundService.deleteFoundReport(1, 5)).toBe(true);
    expect(pool.query.mock.calls[1][0]).toMatch(/is_active = false/);
    expect(pool.query.mock.calls[1][0]).toMatch(/status = 'resolved'/);
  });

  it('deletes image files when images exist', async () => {
    const images = ['/uploads/x.jpg'];
    pool.query
      // pg returns parsed array from JSONB
      .mockResolvedValueOnce({ rows: [{ images }] })
      .mockResolvedValueOnce({ rows: [] });

    await lostFoundService.deleteFoundReport(1, 5);
    expect(deleteUploadedFiles).toHaveBeenCalledWith(images);
  });

  it('does not call deleteUploadedFiles when no images', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ images: null }] })
      .mockResolvedValueOnce({ rows: [] });

    await lostFoundService.deleteFoundReport(1, 5);
    expect(deleteUploadedFiles).not.toHaveBeenCalled();
  });
});

// ==================== addComment ====================

describe('lostFoundService.addComment', () => {
  const commentRow = { id: 7, post_id: 1, post_type: 'lost', user_id: 10, comment_text: 'hi', created_at: new Date() };
  const commentWithUser = { ...commentRow, name: 'Alice', profile_picture: null };

  it('inserts comment and returns it with user info (CTE JOIN)', async () => {
    // addComment uses Promise.all([INSERT+JOIN CTE, owner query]) — 2 concurrent queries
    pool.query
      .mockResolvedValueOnce({ rows: [commentWithUser] })   // INSERT CTE with JOIN
      .mockResolvedValueOnce({ rows: [{ user_id: 10 }] }); // owner query (same user = no notify)

    const result = await lostFoundService.addComment(1, 'lost', 10, 'hi');
    expect(result).toEqual(commentWithUser);
    expect(pool.query.mock.calls[0][0]).toMatch(/INSERT INTO post_comments/);
  });

  it('does NOT notify when commenter is the post owner', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [commentWithUser] })
      .mockResolvedValueOnce({ rows: [{ user_id: 10 }] }); // same as commenter

    await lostFoundService.addComment(1, 'lost', 10, 'hi');
    expect(createNotification).not.toHaveBeenCalled();
  });

  it('notifies post owner when commenter is different user', async () => {
    // addComment(postId, postType, userId, commentText, commenterName)
    pool.query
      .mockResolvedValueOnce({ rows: [commentWithUser] })       // INSERT+JOIN CTE
      .mockResolvedValueOnce({ rows: [{ user_id: 99 }] });       // different owner

    await lostFoundService.addComment(1, 'lost', 10, 'hi', 'Alice');
    expect(createNotification).toHaveBeenCalledWith(
      99, 'comment_on_post',
      'New comment on your lost post',
      expect.stringContaining('Alice'),
      1, 'lost', 10,
      expect.stringContaining('/lost-found'),
    );
  });

  it('uses found owner query for found post type', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...commentWithUser, post_type: 'found' }] }) // CTE
      .mockResolvedValueOnce({ rows: [{ user_id: 99 }] });                            // owner

    await lostFoundService.addComment(1, 'found', 10, 'hi', 'Bob');
    // Promise.all — call order not guaranteed; check both calls
    const sqls = pool.query.mock.calls.map(c => c[0]);
    expect(sqls.some(s => /found_pet_reports/.test(s))).toBe(true);
  });

  it('truncates long comments in notification message', async () => {
    const longText = 'a'.repeat(100);
    pool.query
      .mockResolvedValueOnce({ rows: [{ ...commentWithUser, comment_text: longText }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 99 }] });

    await lostFoundService.addComment(1, 'lost', 10, longText, 'Alice');
    const notifMsg = createNotification.mock.calls[0][3];
    expect(notifMsg).toContain('...');
    expect(notifMsg.length).toBeLessThan(longText.length + 50);
  });
});

// ==================== getComments ====================

describe('lostFoundService.getComments', () => {
  it('returns comments for post', async () => {
    const comments = [{ id: 1 }, { id: 2 }];
    // getComments uses Promise.all([SELECT, COUNT]) — 2 queries
    pool.query
      .mockResolvedValueOnce({ rows: comments })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });
    const result = await lostFoundService.getComments('lost', 5);
    expect(result.comments || result).toBeDefined();
  });

  it('returns empty array when no comments', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });
    const result = await lostFoundService.getComments('found', 1);
    const comments = Array.isArray(result) ? result : (result.comments || []);
    expect(comments).toEqual([]);
  });
});

// ==================== deleteComment ====================

describe('lostFoundService.deleteComment', () => {
  it('returns "not_found" when comment does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    expect(await lostFoundService.deleteComment(1, 10)).toBe('not_found');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns "forbidden" when user does not own comment', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ user_id: 99 }] });
    expect(await lostFoundService.deleteComment(1, 10)).toBe('forbidden');
    expect(pool.query).toHaveBeenCalledTimes(1); // no soft delete
  });

  it('soft deletes and returns "ok" for owner', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: 10 }] }) // ownership check
      .mockResolvedValueOnce({ rows: [] });                // UPDATE

    const result = await lostFoundService.deleteComment(1, 10);
    expect(result).toBe('ok');
    expect(pool.query.mock.calls[1][0]).toMatch(/is_active = false/);
    expect(pool.query.mock.calls[1][1][0]).toBe(1);
  });
});
