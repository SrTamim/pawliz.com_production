import logger from './logger';
import r2 from './r2';

/**
 * Delete a file from R2 — async, non-blocking. Handles every stored path shape
 * ("/uploads/public/<f>", "/uploads/private/<f>", "/api/v1/files/<f>"); r2.js
 * maps the path to the correct bucket + key.
 * @returns True if delete succeeded.
 */
export async function deleteUploadedFile(imagePath: string | null | undefined): Promise<boolean> {
  if (!imagePath) return false;
  const ok = await r2.deleteObject(imagePath);
  if (ok) logger.info(`Deleted file: ${imagePath}`);
  return ok;
}

/**
 * Delete multiple files from R2 — async, non-blocking.
 * @returns Number of files successfully deleted.
 */
export async function deleteUploadedFiles(imagePaths: string[] | null | undefined): Promise<number> {
  if (!Array.isArray(imagePaths)) return 0;
  const results = await Promise.all(
    imagePaths.map((p) => deleteUploadedFile(p).catch(() => false))
  );
  return results.filter(Boolean).length;
}
