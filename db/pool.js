require('dotenv').config();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

let poolInstance = null;

// Initialize SQLite fallback database
const sqliteDbPath = path.join(__dirname, 'skywalker.sqlite');
const sqliteDb = new sqlite3.Database(sqliteDbPath);

sqliteDb.serialize(() => {
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      department_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      data_body TEXT,
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const hash = bcrypt.hashSync('admin123', 10);
  sqliteDb.run(`
    INSERT OR IGNORE INTO users (username, password_hash, role)
    VALUES ('admin', ?, 'admin')
  `, [hash]);
});

// Emulated pool object for SQLite
const sqlitePool = {
  isSQLite: true,
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      // 1. Transform PostgreSQL placeholders ($1, $2, ...) -> (?, ?, ...)
      let formattedSql = sql.replace(/\$\d+/g, '?');
      // 2. Transform ILIKE -> LIKE for SQLite
      formattedSql = formattedSql.replace(/\bILIKE\b/gi, 'LIKE');
      // 3. Handle NOW() -> CURRENT_TIMESTAMP
      formattedSql = formattedSql.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');

      const isSelect = /^\s*SELECT\b/i.test(formattedSql);
      const isInsert = /^\s*INSERT\b/i.test(formattedSql);
      const isUpdateOrDelete = /^\s*(UPDATE|DELETE)\b/i.test(formattedSql);

      // Strip RETURNING clause for SQLite execution
      const returningMatch = formattedSql.match(/\bRETURNING\b\s+([\w*,\s]+)$/i);
      if (returningMatch) {
        formattedSql = formattedSql.replace(/\bRETURNING\b\s+([\w*,\s]+)$/i, '').trim();
      }

      if (isSelect) {
        sqliteDb.all(formattedSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], rowCount: (rows || []).length });
        });
      } else if (isInsert) {
        sqliteDb.run(formattedSql, params, function (err) {
          if (err) return reject(err);
          const lastId = this.lastID;
          if (returningMatch) {
            sqliteDb.get('SELECT * FROM submissions WHERE id = ?', [lastId], (err2, row) => {
              if (err2 || !row) {
                sqliteDb.get('SELECT * FROM users WHERE id = ?', [lastId], (err3, userRow) => {
                  resolve({ rows: userRow ? [userRow] : [{ id: lastId }], rowCount: 1 });
                });
              } else {
                resolve({ rows: [row], rowCount: 1 });
              }
            });
          } else {
            resolve({ rows: [{ id: lastId }], rowCount: 1 });
          }
        });
      } else {
        sqliteDb.run(formattedSql, params, function (err) {
          if (err) return reject(err);
          resolve({ rows: [], rowCount: this.changes });
        });
      }
    });
  },
  end() {
    return new Promise((resolve) => sqliteDb.close(resolve));
  }
};

module.exports = sqlitePool;
