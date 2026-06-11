const { S3Client } = require("@aws-sdk/client-s3");
require("dotenv").config();

/**
 * Cloudflare R2 configuration.
 *
 * Two buckets:
 *   - PUBLIC_BUCKET  → served via R2_PUBLIC_URL (r2.dev / custom domain). Public read.
 *   - PRIVATE_BUCKET → NO public access. Streamed only through the authed
 *                      /api/v1/files/:filename endpoint after an ownership check.
 *
 * Object keys are prefixed by visibility so the public bucket never holds
 * private objects: "public/<filename>" and "private/<filename>".
 */

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PRIVATE_BUCKET,
  R2_PUBLIC_URL,
} = process.env;

const isConfigured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
);

// Fail fast in production if R2 is not fully configured — uploads would silently break otherwise.
if (process.env.NODE_ENV === "production" && !isConfigured) {
  throw new Error("R2 storage is not configured (missing R2_* env vars)");
}

const client = isConfigured
  ? new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
  : null;

module.exports = {
  client,
  isConfigured,
  PUBLIC_BUCKET: R2_BUCKET_NAME,
  // Private bucket falls back to the public bucket name only if unset; in
  // practice R2_PRIVATE_BUCKET must be a separate bucket with no public access.
  PRIVATE_BUCKET: R2_PRIVATE_BUCKET || R2_BUCKET_NAME,
  PUBLIC_URL: R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/$/, "") : "",
};
