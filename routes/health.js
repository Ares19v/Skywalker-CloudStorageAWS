// routes/health.js — Health dashboard data

const express    = require('express');
const pool       = require('../db/pool');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const os         = require('os');
const fs         = require('fs');
const path       = require('path');

const router = express.Router();

router.get('/', requireLogin, requireAdmin, async (req, res) => {
  try {
    const submissionsCount = await pool.query('SELECT COUNT(*) as count FROM submissions');
    const usersCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const recentActivity = await pool.query('SELECT username, content_type, department_name, created_at FROM submissions ORDER BY created_at DESC LIMIT 5');
    const contentBreakdown = await pool.query('SELECT content_type, COUNT(*) as count FROM submissions GROUP BY content_type ORDER BY count DESC');
    const departmentBreakdown = await pool.query('SELECT department_name, COUNT(*) as count FROM submissions GROUP BY department_name ORDER BY count DESC');

    const totalSubmissions = submissionsCount.rows[0]?.count || 0;
    const totalUsers = usersCount.rows[0]?.count || 0;

    let dbSize = '2.4 MB';
    const sqlitePath = path.join(__dirname, '..', 'db', 'skywalker.sqlite');
    if (fs.existsSync(sqlitePath)) {
      const stats = fs.statSync(sqlitePath);
      dbSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
    }

    res.json({
      status: 'healthy',
      system: {
        uptime: os.uptime(),
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch(),
      },
      db: {
        engine: pool.isSQLite ? 'SQLite Local Embedded' : 'PostgreSQL',
        size: dbSize,
        totalUsers,
        totalSubmissions,
        activeConnections: 1,
      },
      storage: {
        mode: process.env.USE_S3 === 'true' ? 'AWS S3 Vault' : 'Local Disk Vault',
        totalFiles: totalSubmissions,
      },
      breakdown: {
        byContent: contentBreakdown.rows,
        byDepartment: departmentBreakdown.rows,
      },
      recent: recentActivity.rows,
    });
  } catch (err) {
    console.error('[health/GET]', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
