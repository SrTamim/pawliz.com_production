import type { Request, Response } from 'express';
import express from 'express';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import validate from '../middleware/validate';
import * as webPushService from '../services/webPushService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * POST /api/v1/push/subscribe
 * Body: a browser PushSubscription JSON { endpoint, keys: { p256dh, auth } }.
 * Endpoint host is allowlisted server-side (SSRF guard); subscription is
 * always tied to the authenticated user.
 */
router.post(
  '/subscribe',
  authenticate,
  [
    body('endpoint').isString().isURL({ protocols: ['https'], require_protocol: true }),
    body('keys.p256dh').isString().notEmpty(),
    body('keys.auth').isString().notEmpty(),
  ],
  validate,
  async (req: Request, res: Response) => {
    try {
      const ok = await webPushService.saveSubscription(req.user!.id, req.body);
      if (!ok) return res.status(400).json({ error: 'Invalid push subscription' });
      res.json({ message: 'Subscribed to push notifications' });
    } catch (err) {
      logger.error('Push subscribe error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

/**
 * POST /api/v1/push/unsubscribe
 * Body: { endpoint }
 */
router.post(
  '/unsubscribe',
  authenticate,
  [body('endpoint').isString().notEmpty()],
  validate,
  async (req: Request, res: Response) => {
    try {
      await webPushService.deleteSubscription(req.user!.id, req.body.endpoint);
      res.json({ message: 'Unsubscribed from push notifications' });
    } catch (err) {
      logger.error('Push unsubscribe error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  },
);

export = router;
