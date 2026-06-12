import './setup';
import _pool from '../config/database';
const pool = _pool as any;
import { createNotification } from '../services/notificationService';

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
});

describe('notificationService.createNotification', () => {
  it('inserts notification and returns row', async () => {
    const row = { id: 1, user_id: 10, type: 'comment_on_post', title: 'New comment', message: 'Someone commented' };
    pool.query.mockResolvedValueOnce({ rows: [row] });

    const result = await createNotification(10, 'comment_on_post', 'New comment', 'Someone commented');
    expect(result).toEqual(row);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO notifications/);
    expect(params[0]).toBe(10);
    expect(params[1]).toBe('comment_on_post');
  });

  it('passes optional fields as null by default', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
    await createNotification(5, 'type', 'title', 'msg');
    const params = pool.query.mock.calls[0][1];
    expect(params[4]).toBeNull(); // relatedPostId
    expect(params[5]).toBeNull(); // relatedPostType
    expect(params[6]).toBeNull(); // actorUserId
    expect(params[7]).toBeNull(); // actionUrl
  });

  it('passes all optional fields when provided', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
    await createNotification(5, 'type', 'title', 'msg', 42, 'lost', 7, '/some/url');
    const params = pool.query.mock.calls[0][1];
    expect(params[4]).toBe(42);
    expect(params[5]).toBe('lost');
    expect(params[6]).toBe(7);
    expect(params[7]).toBe('/some/url');
  });

  it('returns null on DB error without throwing', async () => {
    pool.query.mockRejectedValueOnce(new Error('DB failure'));
    const result = await createNotification(5, 'type', 'title', 'msg');
    expect(result).toBeNull();
  });
});
