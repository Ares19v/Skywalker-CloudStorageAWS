// routes/health.js — RDS and server health dashboard data

const express    = require('express');
const pool       = require('../db/pool');
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const os         = require('os');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function getS3StorageStats() {
  try {
    let totalSize = 0, totalObjects = 0, continuationToken;
    do {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET_NAME,
        ContinuationToken: continuationToken,
      }));
      for (const obj of (res.Contents || [])) totalSize += obj.Size;
      totalObjects += (res.Contents || []).length;
      continuationToken = res.IsTruncated ? res.NextContinuationToken : null;
    } while (continuationToken);
    return { totalSize, totalObjects };
  } catch (err) {
    return { totalSize: 0, totalObjects: 0, error: err.message };
  }
}

const router = express.Router();

router.get('/', requireLogin, requireAdmin, async (req, res) => {
  try {
    const [
      connResult,
      s3Stats,
      dbSizeResult,
      tableResult,
      submissionsCount,
      usersCount,
      recentActivity,
      contentBreakdown,
      departmentBreakdown,
      pgVersion,
    ] = await Promise.all([
      pool.query(`SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()`),
      getS3StorageStats(),
      pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`),
      pool.query(`
        SELECT relname AS table_name,
               pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
               n_live_tup AS row_count
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
      `),
      pool.query('SELECT count(*) FROM submissions'),
      pool.query('SELECT count(*) FROM users'),
      pool.query(`
        SELECT DATE(created_at) AS day, count(*) AS count
        FROM submissions
        WHERE created_at > NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day ASC
      `),
      pool.query(`SELECT content_type, count(*) AS count FROM submissions GROUP BY content_type ORDER BY count DESC`),
      pool.query(`SELECT department_name, count(*) AS count FROM submissions GROUP BY department_name ORDER BY count DESC`),
      pool.query('SELECT version()'),
    ]);

    const serverInfo = {
      platform:    os.platform(),
      arch:        os.arch(),
      nodeVersion: process.version,
      uptime:      Math.floor(process.uptime()),
      memTotal:    Math.round(os.totalmem() / 1024 / 1024),
      memFree:     Math.round(os.freemem()  / 1024 / 1024),
      poolTotal:   pool.totalCount,
      poolIdle:    pool.idleCount,
      poolWaiting: pool.waitingCount,
    };

    // S3 free = 5GB. R2 free = 10GB. Override with S3_FREE_GB in .env.
    const S3_FREE_BYTES = parseInt(process.env.S3_FREE_GB || '5') * 1024 * 1024 * 1024;

    res.json({
      server: serverInfo,
      storage: {
        usedBytes:   s3Stats.totalSize,
        usedMB:      (s3Stats.totalSize / 1024 / 1024).toFixed(1),
        usedGB:      (s3Stats.totalSize / 1024 / 1024 / 1024).toFixed(3),
        freeGB:      (S3_FREE_BYTES / 1024 / 1024 / 1024).toFixed(0),
        usedPct:     Math.min(100, ((s3Stats.totalSize / S3_FREE_BYTES) * 100).toFixed(1)),
        objectCount: s3Stats.totalObjects,
        error:       s3Stats.error || null,
      },
      db: {
        version:             pgVersion.rows[0].version,
        size:                dbSizeResult.rows[0].db_size,
        activeConnections:   parseInt(connResult.rows[0].count),
        tables:              tableResult.rows,
        submissionsTotal:    parseInt(submissionsCount.rows[0].count),
        usersTotal:          parseInt(usersCount.rows[0].count),
        activityLast14:      recentActivity.rows,
        contentBreakdown:    contentBreakdown.rows,
        departmentBreakdown: departmentBreakdown.rows,
      },
    });
  } catch (err) {
    console.error('[health]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
