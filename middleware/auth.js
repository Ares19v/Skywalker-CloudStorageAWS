// middleware/auth.js — Session guards and role checks

function requireLogin(req, res, next) {
  if (req.session && req.session.userId) return next();
  // API vs page request
  if (req.path.startsWith('/api/') || req.xhr) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') return next();
  if (req.path.startsWith('/api/') || req.xhr) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  res.redirect('/vault');
}

module.exports = { requireLogin, requireAdmin };
