const multer = require("multer");
const path = require("path");
const sharp = require("sharp");
const { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_DOC_TYPES } = require("../utils/constants");
const logger = require("../utils/logger");
const r2 = require("../utils/r2");

/**
 * File upload middleware.
 *
 * Files are buffered in memory by multer, validated, then streamed to
 * Cloudflare R2 (public or private bucket based on req.uploadDir). Downstream
 * routes still read req.file.filename / req.files[].filename and build the same
 * "/uploads/<public|private>/<filename>" path strings as before — storage
 * backend is transparent to them.
 *
 * Allowed: .jpg/.jpeg/.png/.webp/.gif, .pdf/.doc/.docx
 */

const storage = multer.memoryStorage();

/**
 * File type validator: reject non-image/non-doc files.
 * Double-checks extension + MIME type.
 */
const fileFilter = (req, file, cb) => {
  const allowedImg = /jpeg|jpg|png|webp|gif/;
  const allowedDoc = /pdf|doc|docx/;
  const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
  const isImageType = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
  const isDocType = ALLOWED_DOC_TYPES.includes(file.mimetype);

  if ((allowedImg.test(ext) && isImageType) || (allowedDoc.test(ext) && isDocType)) {
    cb(null, true);
  } else {
    logger.warn(`Upload blocked: ${file.originalname} (${file.mimetype})`);
    cb(new Error("Only image or document files are allowed"));
  }
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Push one in-memory multer file to R2 and decorate it with the fields
 * downstream code expects (.filename). Mutates the file object in place.
 *
 * Raster images (not gif) are resized to max 1280px and re-encoded as webp
 * before upload — turning 2–11MB phone photos into ~120–250KB, which is the
 * main LCP lever. PDFs/docs and animated gifs pass through untouched.
 */
async function pushToR2(file, visibility) {
  let buffer = file.buffer;
  let mimetype = file.mimetype;
  let ext = path.extname(file.originalname);

  const isRasterImage = mimetype.startsWith("image/") && mimetype !== "image/gif";
  if (isRasterImage) {
    buffer = await sharp(buffer)
      .rotate() // honor EXIF orientation so phone photos aren't sideways
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    mimetype = "image/webp";
    ext = ".webp";
  }

  // Unique, extension-correct filename (R2 keys are ext-agnostic; DB stores this verbatim).
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  await r2.putObject(visibility, filename, buffer, mimetype);
  file.filename = filename;
  // Free the buffer; nothing downstream needs it once uploaded.
  delete file.buffer;
  return filename;
}

/**
 * Wrap a multer middleware so that, after parsing, every parsed file is
 * uploaded to R2 before control passes to the route handler. Visibility is
 * taken from req.uploadDir ("private" → private bucket, else public).
 */
function withR2Upload(multerMiddleware) {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) return next(err);
      const visibility = req.uploadDir === "private" ? "private" : "public";
      const files = req.files
        ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
        : req.file
          ? [req.file]
          : [];
      if (files.length === 0) return next();

      Promise.all(files.map((f) => pushToR2(f, visibility)))
        .then(() => next())
        .catch((uploadErr) => {
          logger.error("R2 upload failed:", uploadErr);
          next(uploadErr);
        });
    });
  };
}

/**
 * Drop-in replacement for the multer instance: exposes .single() and .array()
 * returning R2-aware middleware with identical call signatures.
 */
const upload = {
  single: (field) => withR2Upload(multerInstance.single(field)),
  array: (field, maxCount) => withR2Upload(multerInstance.array(field, maxCount)),
};

module.exports = upload;
