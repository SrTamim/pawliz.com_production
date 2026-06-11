const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { client, isConfigured, PUBLIC_BUCKET, PRIVATE_BUCKET } = require("../config/r2");
const logger = require("./logger");

/**
 * R2 object storage service.
 *
 * The rest of the app keeps using relative path strings as object identifiers:
 *   - "/uploads/public/<file>"   → public bucket, key "public/<file>"
 *   - "/uploads/private/<file>"  → private bucket, key "private/<file>"
 *   - "/api/v1/files/<file>"     → private bucket, key "private/<file>"  (vet docs)
 *
 * resolveLocation() maps any of those shapes to { bucket, key }, so callers
 * never deal with bucket names directly.
 */

function safeFilename(filename) {
  // Strip any path separators / traversal; keep just the leaf name.
  return String(filename).split(/[\\/]/).pop();
}

/**
 * Map a stored path string to its R2 bucket + key.
 * Returns null for unrecognized shapes.
 */
function resolveLocation(storedPath) {
  if (!storedPath || typeof storedPath !== "string") return null;
  const filename = safeFilename(storedPath);
  if (!filename) return null;

  if (storedPath.includes("/uploads/private/") || storedPath.includes("/api/v1/files/")) {
    return { bucket: PRIVATE_BUCKET, key: `private/${filename}` };
  }
  if (storedPath.includes("/uploads/public/") || storedPath.includes("/uploads/")) {
    return { bucket: PUBLIC_BUCKET, key: `public/${filename}` };
  }
  // Bare filename with no prefix → treat as public.
  return { bucket: PUBLIC_BUCKET, key: `public/${filename}` };
}

/**
 * Upload a buffer to R2.
 * @param {"public"|"private"} visibility
 * @param {string} filename - leaf filename (no path)
 * @param {Buffer} buffer
 * @param {string} contentType
 */
async function putObject(visibility, filename, buffer, contentType) {
  if (!isConfigured) throw new Error("R2 not configured");
  const name = safeFilename(filename);
  const bucket = visibility === "private" ? PRIVATE_BUCKET : PUBLIC_BUCKET;
  const key = `${visibility}/${name}`;
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return { bucket, key };
}

/**
 * Fetch a private object as a stream (Body) + metadata. Caller pipes to response.
 * @param {string} storedPath
 */
async function getObjectStream(storedPath) {
  if (!isConfigured) throw new Error("R2 not configured");
  const loc = resolveLocation(storedPath);
  if (!loc) throw new Error("Invalid object path");
  const out = await client.send(
    new GetObjectCommand({ Bucket: loc.bucket, Key: loc.key })
  );
  return {
    body: out.Body, // Node.js Readable stream
    contentType: out.ContentType,
    contentLength: out.ContentLength,
  };
}

/**
 * Delete an object given any stored path shape. Never throws.
 * @returns {Promise<boolean>}
 */
async function deleteObject(storedPath) {
  if (!isConfigured) return false;
  const loc = resolveLocation(storedPath);
  if (!loc) return false;
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: loc.bucket, Key: loc.key })
    );
    return true;
  } catch (err) {
    logger.error(`R2 delete failed for ${storedPath}:`, err);
    return false;
  }
}

module.exports = {
  putObject,
  getObjectStream,
  deleteObject,
  resolveLocation,
  safeFilename,
};
