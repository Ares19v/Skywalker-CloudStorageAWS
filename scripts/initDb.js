require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../db/pool');

async function initDb() {
  console.log('[init] Connecting to database...');
  const schemaPath = path.join(__dirname, '../db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('[init] ✅ Schema created successfully.');
  } catch (err) {
    console.error('[init] ❌ Error creating schema:', err.message);
  } finally {
    await pool.end();
  }
}

initDb();
