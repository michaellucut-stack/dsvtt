import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { AppError } from '../middleware/error-handler.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum upload file size in bytes (10 MB). */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for map background images. */
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

/** Allowed file extensions for map background images. */
const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

/** Absolute path to the uploads directory for map images. */
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'maps');

// ---------------------------------------------------------------------------
// Ensure upload directory exists
// ---------------------------------------------------------------------------

/**
 * Create the uploads/maps directory if it does not already exist.
 * Called at module load time so the directory is ready when the first upload
 * arrives.
 */
export function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

// Eagerly ensure the directory exists on import
ensureUploadDir();

// ---------------------------------------------------------------------------
// Multer storage configuration
// ---------------------------------------------------------------------------

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

/**
 * Multer file filter that rejects uploads with disallowed MIME types or
 * extensions.
 */
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
): void {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    cb(new AppError(
      'Invalid file type. Allowed: png, jpg, jpeg, webp, svg',
      400,
      'UPLOAD_INVALID_TYPE',
    ));
    return;
  }

  cb(null, true);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Pre-configured multer middleware for single-file map background uploads.
 *
 * Accepts a single file with the field name `file`. Validates file type and
 * enforces a 10 MB size limit. Stores files to `uploads/maps/` with UUID
 * filenames.
 *
 * @example
 * ```ts
 * router.post('/maps/:id/upload', mapUpload.single('file'), handler);
 * ```
 */
export const mapUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

/**
 * Convert a multer file to a URL path suitable for serving via
 * `express.static`.
 *
 * @param file - The multer file object from a completed upload.
 * @returns A URL path like `/uploads/maps/<uuid>.<ext>`.
 */
export function getFileUrl(file: Express.Multer.File): string {
  return `/uploads/maps/${file.filename}`;
}
