-- CompanyDB Schema
-- Run this once via: npm run db:init
-- ============================================================

-- Sessions table (managed by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS submissions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username        TEXT NOT NULL,
  department_name TEXT NOT NULL,
  content_type    TEXT NOT NULL CHECK (content_type IN ('Ad', 'Link', 'Note', 'Image', 'Video', 'PDF', 'Code', 'Document', 'Presentation', 'Other')),
  data_body       TEXT,
  file_path       TEXT,
  file_name       TEXT,
  file_size       BIGINT,
  mime_type       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_content_type ON submissions(content_type);
CREATE INDEX IF NOT EXISTS idx_submissions_department ON submissions(department_name);
