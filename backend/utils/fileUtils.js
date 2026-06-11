const logger = require("./logger");
const r2 = require("./r2");

/**
 * Delete a file from R2 — async, non-blocking. Handles every stored path shape
 * ("/uploads/public/<f>", "/uploads/private/<f>", "/api/v1/files/<f>"); r2.js
 * maps the path to the correct bucket + key.
 * @param {string} imagePath
 * @returns {Promise<boolean>} - True if delete succeeded.
 */
async function deleteUploadedFile(imagePath) {
  if (!imagePath) return false;
  const ok = await r2.deleteObject(imagePath);
  if (ok) logger.info(`Deleted file: ${imagePath}`);
  return ok;
}

/**
 * Delete multiple files from R2 — async, non-blocking.
 * @param {string[]} imagePaths
 * @returns {Promise<number>} - Number of files successfully deleted.
 */
async function deleteUploadedFiles(imagePaths) {
  if (!Array.isArray(imagePaths)) return 0;
  const results = await Promise.all(
    imagePaths.map((p) => deleteUploadedFile(p).catch(() => false))
  );
  return results.filter(Boolean).length;
}

module.exports = {
  deleteUploadedFile,
  deleteUploadedFiles,
};
