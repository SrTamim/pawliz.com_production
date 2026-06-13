import multer from 'multer';
import path from 'path';
import sharp from 'sharp';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { MAX_FILE_SIZE, ALLOWED_IMAGE_TYPES, ALLOWED_DOC_TYPES } from '../utils/constants';
import logger from '../utils/logger';
import * as r2 from '../utils/r2';

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
const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowedImg = /jpeg|jpg|png|webp|gif/;
  const allowedDoc = /pdf|doc|docx/;
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  const isImageType = ALLOWED_IMAGE_TYPES.includes(file.mimetype);
  const isDocType = ALLOWED_DOC_TYPES.includes(file.mimetype);

  if ((allowedImg.test(ext) && isImageType) || (allowedDoc.test(ext) && isDocType)) {
    cb(null, true);
  } else {
    logger.warn(`Upload blocked: ${file.originalname} (${file.mimetype})`);
    cb(new Error('Only image or document files are allowed'));
  }
};

const multerInstance = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

/**
 * Magic-byte check for document uploads. The fileFilter only sees the declared
 * extension + MIME type, so a renamed file (e.g. script.exe → doc.pdf) slips
 * through. Images are already implicitly validated — sharp() throws on non-image
 * bytes — but PDFs/docs pass through untouched, so verify their signature here.
 *
 * Returns true if the buffer starts with a plausible PDF / OOXML(docx) / OLE2(doc)
 * container header. This is a sanity check on the container, not deep validation.
 */
function hasValidDocSignature(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  // PDF: "%PDF"
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') return true;
  // DOCX (and any OOXML): ZIP local file header "PK\x03\x04"
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return true;
  // Legacy DOC: OLE2 compound file "D0 CF 11 E0 A1 B1 1A E1"
  const ole2 = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (ole2.every((b, i) => buffer[i] === b)) return true;
  return false;
}

/**
 * Push one in-memory multer file to R2 and decorate it with the fields
 * downstream code expects (.filename). Mutates the file object in place.
 *
 * Raster images (not gif) are resized to max 1280px and re-encoded as webp
 * before upload — turning 2–11MB phone photos into ~120–250KB, which is the
 * main LCP lever. PDFs/docs and animated gifs pass through untouched.
 */
async function pushToR2(file: Express.Multer.File, visibility: 'public' | 'private'): Promise<string> {
  let buffer = file.buffer;
  let mimetype = file.mimetype;
  let ext = path.extname(file.originalname);

  const isRasterImage = mimetype.startsWith('image/') && mimetype !== 'image/gif';
  if (isRasterImage) {
    buffer = await sharp(buffer)
      .rotate() // honor EXIF orientation so phone photos aren't sideways
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    mimetype = 'image/webp';
    ext = '.webp';
  } else if (ALLOWED_DOC_TYPES.includes(mimetype) && !hasValidDocSignature(buffer)) {
    // Doc passthrough path: confirm the bytes match a real PDF/doc container,
    // not just a renamed file with a doc extension + spoofed MIME type.
    logger.warn(`Upload blocked (bad signature): ${file.originalname} (${mimetype})`);
    throw new Error('File content does not match its type');
  }

  // Unique, extension-correct filename (R2 keys are ext-agnostic; DB stores this verbatim).
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  await r2.putObject(visibility, filename, buffer, mimetype);
  file.filename = filename;
  // Free the buffer; nothing downstream needs it once uploaded.
  delete (file as Partial<Express.Multer.File>).buffer;
  return filename;
}

/**
 * Wrap a multer middleware so that, after parsing, every parsed file is
 * uploaded to R2 before control passes to the route handler. Visibility is
 * taken from req.uploadDir ("private" → private bucket, else public).
 */
function withR2Upload(multerMiddleware: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    multerMiddleware(req, res, (err?: unknown) => {
      if (err) return next(err);
      const visibility = req.uploadDir === 'private' ? 'private' : 'public';
      const files: Express.Multer.File[] = req.files
        ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat())
        : req.file
          ? [req.file]
          : [];
      if (files.length === 0) return next();

      Promise.all(files.map((f) => pushToR2(f, visibility)))
        .then(() => next())
        .catch((uploadErr) => {
          logger.error('R2 upload failed:', uploadErr);
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
  single: (field: string) => withR2Upload(multerInstance.single(field)),
  array: (field: string, maxCount?: number) => withR2Upload(multerInstance.array(field, maxCount)),
};

export = upload;
