require('dotenv').config();
const { Pool } = require('pg');

// SSL: enabled by default (required for AWS RDS).
// Set DB_SSL=false in .env or docker-compose.yml for local dev without SSL.
const useSSL = process.env.DB_SSL !== 'false';

const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      useSSL ? { rejectUnauthorized: false } : false,
  max:                    20,
  idleTimeoutMillis:      30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

module.exports = pool;
