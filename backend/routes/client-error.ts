import express from 'express';
const router = express.Router();
import logger from '../utils/logger';

/**
 * POST /api/v1/client-error
 * Receives frontend React ErrorBoundary reports.
 * Logs via winston — no DB write, non-blocking.
 */
router.post("/", (req, res) => {
  const { error, stack, info, url } = req.body || {};
  logger.error("Client-side React error", {
    error: error ? String(error).substring(0, 500) : "unknown",
    stack: stack ? String(stack).substring(0, 2000) : "",
    info: info ? String(info).substring(0, 1000) : "",
    url: url ? String(url).substring(0, 500) : "",
  });
  res.status(204).send();
});

export = router;