// server.js — CompanyDB Express Application Entry Point

require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const rateLimit    = require('express-rate-limit');
const helmet       = require('helmet');
const path         = require('path');
const pool         = require('./db/pool');

const authRoutes        = require('./routes/auth');
const submissionRoutes  = require('./routes/submissions');
const adminRoutes       = require('./routes/admin');
const healthRoutes      = require('./routes/health');
const { requireLogin, requireAdmin } = require('./middleware/auth');

// ─── Startup: Validate required environment variables ─────────────────────────
const REQUIRED_ENV = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'SESSION_SECRET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  console.error(`\n[FATAL] Missing required environment variables: ${missingEnv.join(', ')}`);
  console.error('[FATAL] Copy .env.example to .env and fill in the values.\n');
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Security Headers (Helmet) ────────────────────────────────────────────────
// Disables CSP for now since we serve inline scripts; can be tightened later
app.use(helmet({ contentSecurityPolicy: false }));

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Session store (PostgreSQL) ───────────────────────────────────────────────
app.use(session({
  store: new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  }),
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,    // set true if running HTTPS
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Auth endpoints: tighter limit to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API endpoints: generous limit for 30 active users
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: { error: 'Rate limit exceeded, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limit on login/register only (brute force protection)
// /auth/me and /auth/logout use the generous API limiter — they fire on every page load
app.post('/auth/login',    authLimiter);
app.post('/auth/register', authLimiter);
app.use('/auth', apiLimiter);
app.use('/api',  apiLimiter);

// ─── Static files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// Uploaded files — served only to logged-in users
app.use('/uploads', requireLogin, express.static(path.join(__dirname, 'uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth',             authRoutes);
app.use('/api/submissions',  submissionRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/health',       healthRoutes);

// ─── HTML Page Routes ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/vault');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/vault');
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/input',  requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'input.html')));
app.get('/vault',  requireLogin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'vault.html')));
app.get('/admin',  requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'admin.html')));
app.get('/health', requireLogin, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'health.html')));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.redirect('/vault');
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 100}MB.` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) { localIP = net.address; break; }
    }
  }
  console.log(`\n╔═══════════════════════════════════════╗`);
  console.log(`║           CompanyDB is LIVE           ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  Local:   http://localhost:${PORT}       ║`);
  console.log(`║  Network: http://${localIP}:${PORT}    ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});

// ─── Graceful shutdown (PM2 / Docker SIGTERM) ─────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received — shutting down gracefully...');
  server.close(async () => {
    await pool.end();
    console.log('[INFO] DB pool closed. Goodbye.');
    process.exit(0);
  });
});
