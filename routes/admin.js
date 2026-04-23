// routes/admin.js — User management (admin only)

const express = require('express');
const pool    = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/users — list all users
router.get('/users', requireLogin, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[admin/users GET]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/role — promote or demote
router.patch('/users/:id/role', requireLogin, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'member'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or member' });
  }
  // Prevent self-demotion
  if (parseInt(id) === req.session.userId && role === 'member') {
    return res.status(400).json({ error: 'You cannot remove your own admin role' });
  }
  try {
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('[admin/users PATCH role]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/users/:id — delete user account
router.delete('/users/:id', requireLogin, requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.session.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, username',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    // Note: submissions are cascade-deleted via FK
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error('[admin/users DELETE]', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
