import webpush from 'web-push';
import pool from '../config/database';
import logger from '../utils/logger';

/**
 * Web Push service.
 *
 * VAPID keys are OPTIONAL — if either is missing, push is disabled and every
 * function is a safe no-op (so a deploy without keys never crashes and the
 * notification hot path adds zero DB queries; see createNotification wiring).
 */

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pawliz.com';

export const pushEnabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (pushEnabled) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
}

// Cap subscriptions per user so a compromised/abusive token can't flood the table.
const MAX_SUBSCRIPTIONS_PER_USER = 10;

// Allowlist of known push-service hosts. web-push POSTs to the client-supplied
// endpoint, so restricting the host prevents SSRF to internal/metadata addresses.
function isAllowedEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return (
    host === 'fcm.googleapis.com' ||
    host === 'updates.push.services.mozilla.com' ||
    host.endsWith('.push.services.mozilla.com') ||
    host.endsWith('.notify.windows.com') ||
    host.endsWith('.push.apple.com')
  );
}

export interface PushSubscriptionInput {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

/**
 * Persist a browser PushSubscription for a user. Returns false if the payload
 * is malformed or the endpoint host is not an allowed push service.
 */
export async function saveSubscription(
  userId: number,
  sub: PushSubscriptionInput,
): Promise<boolean> {
  const endpoint = typeof sub?.endpoint === 'string' ? sub.endpoint : '';
  const p256dh = typeof sub?.keys?.p256dh === 'string' ? sub.keys.p256dh : '';
  const auth = typeof sub?.keys?.auth === 'string' ? sub.keys.auth : '';

  if (!endpoint || !p256dh || !auth) return false;
  if (!isAllowedEndpoint(endpoint)) return false;

  try {
    // Upsert on the UNIQUE endpoint so re-subscribing never creates duplicates
    // and a subscription that moves to a new user is re-owned.
    await pool.query(
      `INSERT INTO web_push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth`,
      [userId, endpoint, p256dh, auth],
    );

    // Trim to the newest N subscriptions for this user.
    await pool.query(
      `DELETE FROM web_push_subscriptions
       WHERE user_id = $1
         AND id NOT IN (
           SELECT id FROM web_push_subscriptions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2
         )`,
      [userId, MAX_SUBSCRIPTIONS_PER_USER],
    );
    return true;
  } catch (err) {
    logger.error('saveSubscription error:', err);
    return false;
  }
}

export async function deleteSubscription(userId: number, endpoint: string): Promise<void> {
  try {
    await pool.query(
      'DELETE FROM web_push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint],
    );
  } catch (err) {
    logger.error('deleteSubscription error:', err);
  }
}

export interface PushPayload {
  title: string;
  message: string;
  action_url?: string | null;
  tag?: string | null;
}

/**
 * Send a push to every subscription a user has. No-op when push is disabled.
 * Dead subscriptions (410 Gone / 404) are pruned. Best-effort: never throws.
 */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  if (!pushEnabled) return;
  try {
    const { rows } = await pool.query(
      'SELECT endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1',
      [userId],
    );
    if (!rows.length) return;

    const body = JSON.stringify({
      title: payload.title,
      message: payload.message,
      action_url: payload.action_url || '/',
      tag: payload.tag || undefined,
    });

    await Promise.allSettled(
      rows.map(async (row) => {
        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
            body,
          );
        } catch (err: any) {
          const status = err?.statusCode;
          if (status === 404 || status === 410) {
            // Subscription expired/unsubscribed — remove it.
            await pool
              .query('DELETE FROM web_push_subscriptions WHERE endpoint = $1', [row.endpoint])
              .catch(() => {});
          } else {
            logger.warn('Web push send failed:', err?.message || err);
          }
        }
      }),
    );
  } catch (err) {
    logger.error('sendPushToUser error:', err);
  }
}
