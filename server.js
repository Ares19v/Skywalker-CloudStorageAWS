// server.js — Skywalker Express Application Entry Point

require('dotenv').config();
const express      = require('express');
const session      = require('express-session');
const pgSession    = require('connect-pg-simple')(session);
const rateLimit    = require('express-rate-limit');
const helmet       = require('helmet');
const path         = require('path');
const fs           = require('fs');
const pool         = require('./db/pool');

const authRoutes        = require('./routes/auth');
const submissionRoutes  = require('./routes/submissions');
const adminRoutes       = require('./routes/admin');
const healthRoutes      = require('./routes/health');
const { requireLogin, requireAdmin } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

// Security Headers
app.use(helmet({ contentSecurityPolicy: false }));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session store
const sessionConfig = {
  secret:            process.env.SESSION_SECRET || 'skywalker_local_secret_key_12345',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   false,
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

if (!pool.isSQLite) {
  sessionConfig.store = new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  });
}

app.use(session(sessionConfig));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/auth/login',    authLimiter);
app.post('/auth/register', authLimiter);
app.use('/auth', apiLimiter);
app.use('/api',  apiLimiter);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/auth',             authRoutes);
app.use('/api/submissions',  submissionRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/health',       healthRoutes);

// HTML Page Routes
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

// 404 handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.redirect('/vault');
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 100}MB.` });
  }
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Start server
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
  console.log(`║           Skywalker is LIVE           ║`);
  console.log(`╠═══════════════════════════════════════╣`);
  console.log(`║  Local:   http://localhost:${PORT}       ║`);
  console.log(`║  Network: http://${localIP}:${PORT}    ║`);
  console.log(`║  Engine:  ${pool.isSQLite ? 'SQLite Local Vault' : 'PostgreSQL Cloud'}     ║`);
  console.log(`╚═══════════════════════════════════════╝\n`);
});

process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM received — shutting down gracefully...');
  server.close(async () => {
    await pool.end();
    console.log('[INFO] DB pool closed. Goodbye.');
    process.exit(0);
  });
});
