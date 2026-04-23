// routes/auth.js — Login, Logout, Register (admin only), Password Reset

const express  = require('express');
const bcrypt   = require('bcryptjs');
const pool     = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const result = await pool.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1',
      [username.trim().toLowerCase()]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Regenerate session to prevent fixation
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.userId   = user.id;
      req.session.username = user.username;
      req.session.role     = user.role;
      res.json({ success: true, role: user.role, username: user.username });
    });
  } catch (err) {
    console.error('[auth/login]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /auth/me — returns current session user info
router.get('/me', requireLogin, (req, res) => {
  res.json({
    userId:   req.session.userId,
    username: req.session.username,
    role:     req.session.role,
  });
});

// POST /auth/register — Admin only, creates a new user account
router.post('/register', requireLogin, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const allowedRoles = ['admin', 'member'];
  const userRole = allowedRoles.includes(role) ? role : 'member';

  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username.trim().toLowerCase(), hash, userRole]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('[auth/register]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/reset-password — Admin resets any user's password
router.post('/reset-password', requireLogin, requireAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ error: 'userId and newPassword required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    const result = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, username',
      [hash, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('[auth/reset-password]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/change-password — Any logged-in user changes their OWN password
router.post('/change-password', requireLogin, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both passwords required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  try {
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    console.error('[auth/change-password]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
