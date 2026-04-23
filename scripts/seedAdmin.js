require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Enter password for admin account: ', async (password) => {
  rl.close();
  if (!password || password.length < 6) {
    console.error('❌ Password must be at least 6 characters.');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 12);
  try {
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role)
       VALUES ('admin', $1, 'admin')
       ON CONFLICT (username) DO UPDATE SET password_hash = $1, role = 'admin'
       RETURNING id, username, role`,
      [hash]
    );
    console.log(`✅ Admin account ready:`, result.rows[0]);
  } catch (err) {
    console.error('❌ Error seeding admin:', err.message);
  } finally {
    await pool.end();
  }
});
