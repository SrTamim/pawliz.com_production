import { S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

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

export const isConfigured = Boolean(
  R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
);

// Fail fast in production if R2 is not fully configured — uploads would silently break otherwise.
if (process.env.NODE_ENV === 'production' && !isConfigured) {
  throw new Error('R2 storage is not configured (missing R2_* env vars)');
}

export const client: S3Client | null = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID as string,
        secretAccessKey: R2_SECRET_ACCESS_KEY as string,
      },
    })
  : null;

export const PUBLIC_BUCKET = R2_BUCKET_NAME as string;
// Fail fast in production if the private bucket is unset — otherwise private vet
// docs would silently fall back to the public bucket and become world-readable.
if (process.env.NODE_ENV === 'production' && !R2_PRIVATE_BUCKET) {
  throw new Error('R2_PRIVATE_BUCKET must be set in production — private docs would leak into the public bucket otherwise');
}
// Private bucket falls back to the public bucket name only if unset (dev/test); in
// production R2_PRIVATE_BUCKET is required (see fail-fast above) and must be a
// separate bucket with no public access.
export const PRIVATE_BUCKET = (R2_PRIVATE_BUCKET || R2_BUCKET_NAME) as string;
export const PUBLIC_URL = R2_PUBLIC_URL ? R2_PUBLIC_URL.replace(/\/$/, '') : '';
