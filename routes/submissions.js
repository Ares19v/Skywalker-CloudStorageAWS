// routes/submissions.js — CRUD for data entries (text + S3 file uploads)

const express    = require('express');
const multer     = require('multer');
const multerS3   = require('multer-s3');
const { S3Client, DeleteObjectCommand, GetBucketLocationCommand } = require('@aws-sdk/client-s3');
const path       = require('path');
const pool       = require('../db/pool');
const { requireLogin } = require('../middleware/auth');

// ─── ADMIN LOCK ────────────────────────────────────────────────────────────────
// Set ADMIN_LOCK=true in .env to restrict ALL deletions to admins only
const ADMIN_LOCK = process.env.ADMIN_LOCK === 'true';
// ───────────────────────────────────────────────────────────────────────────────

const router = express.Router();

// ─── S3 Client ────────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  // If S3_ENDPOINT is set (for Cloudflare R2 migration), use it
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/html', 'text/css', 'text/javascript', 'application/json',
  'application/xml', 'text/csv',
  'application/zip', 'application/x-zip-compressed',
];

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.S3_BUCKET_NAME,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const ext    = path.extname(file.originalname);
      cb(null, `uploads/${unique}${ext}`);
    },
  }),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// ─── Helper: build public URL for a given S3 key ────────────────────────────
function buildFileUrl(key) {
  const base = (process.env.S3_PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/${key}`;
}
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/submissions
router.get('/', requireLogin, async (req, res) => {
  const { department, type, search, sort, order } = req.query;
  const values = [], conditions = [];

  if (department) { conditions.push(`department_name = $${values.length + 1}`); values.push(department); }
  if (type)       { conditions.push(`content_type = $${values.length + 1}`);    values.push(type); }
  if (search) {
    conditions.push(`(username ILIKE $${values.length + 1} OR department_name ILIKE $${values.length + 1} OR data_body ILIKE $${values.length + 1} OR file_name ILIKE $${values.length + 1})`);
    values.push(`%${search}%`);
  }

  const where   = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowed = ['id', 'username', 'department_name', 'content_type', 'created_at'];
  const sortCol = allowed.includes(sort) ? sort : 'created_at';
  const sortDir = order === 'asc' ? 'ASC' : 'DESC';

  try {
    const result = await pool.query(
      `SELECT id, user_id, username, department_name, content_type,
              data_body, file_path, file_name, file_size, mime_type, created_at
       FROM submissions ${where}
       ORDER BY ${sortCol} ${sortDir}`,
      values
    );
    const sessionUserId = req.session.userId;
    const isAdmin       = req.session.role === 'admin';
    const rows = result.rows.map(row => ({
      ...row,
      can_delete: isAdmin || (!ADMIN_LOCK && row.user_id === sessionUserId),
    }));
    res.json(rows);
  } catch (err) {
    console.error('[submissions/GET]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/submissions
router.post('/', requireLogin, upload.single('file'), async (req, res) => {
  const { department_name, content_type, data_body } = req.body;
  if (!department_name || !content_type) {
    return res.status(400).json({ error: 'Department and content type required' });
  }
  if (!data_body && !req.file) {
    return res.status(400).json({ error: 'Either text content or a file is required' });
  }

  // S3 gives us the full location on req.file.location
  const filePath = req.file ? req.file.location : null;
  const fileName = req.file ? req.file.originalname : null;
  const fileSize = req.file ? req.file.size : null;
  const mimeType = req.file ? req.file.mimetype : null;

  try {
    const result = await pool.query(
      `INSERT INTO submissions (user_id, username, department_name, content_type, data_body, file_path, file_name, file_size, mime_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.session.userId, req.session.username, department_name, content_type,
       data_body || null, filePath, fileName, fileSize, mimeType]
    );
    res.json({ success: true, submission: result.rows[0] });
  } catch (err) {
    // If DB insert fails and file was uploaded to S3, clean it up
    if (req.file && req.file.key) {
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: req.file.key })).catch(() => {});
    }
    console.error('[submissions/POST]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/submissions/:id
router.delete('/:id', requireLogin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT user_id, file_path FROM submissions WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });

    const sub     = result.rows[0];
    const isOwner = sub.user_id === req.session.userId;
    const isAdmin = req.session.role === 'admin';

    if (ADMIN_LOCK && !isAdmin) return res.status(403).json({ error: 'Deletions are restricted to admins' });
    if (!isAdmin && !isOwner)   return res.status(403).json({ error: 'You can only delete your own entries' });

    await pool.query('DELETE FROM submissions WHERE id = $1', [id]);

    // Delete from S3 if a file exists
    if (sub.file_path) {
      try {
        // Extract the S3 key from the full URL
        const url  = new URL(sub.file_path);
        const key  = url.pathname.replace(/^\//, '');
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }));
      } catch (s3Err) {
        console.warn('[submissions/DELETE] S3 cleanup failed:', s3Err.message);
        // Don't fail the request — DB record is already deleted
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('[submissions/DELETE]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Export S3 client for use in health route
module.exports = router;
module.exports.s3 = s3;
