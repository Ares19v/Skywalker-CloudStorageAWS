# Skywalker — Technical Architecture & Deep Dive

> This document is a complete technical reference for the Skywalker system.
> It covers every layer of the stack: from how a login request is processed
> to how a file ends up in S3 and how sessions survive a server restart.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack Rationale](#2-technology-stack-rationale)
3. [Request Lifecycle](#3-request-lifecycle)
4. [Authentication & Session System](#4-authentication--session-system)
5. [File Upload Pipeline](#5-file-upload-pipeline)
6. [Database Schema](#6-database-schema)
7. [Security Layers](#7-security-layers)
8. [Rate Limiting Strategy](#8-rate-limiting-strategy)
9. [Health Monitoring System](#9-health-monitoring-system)
10. [Production Deployment (EC2 + PM2)](#10-production-deployment-ec2--pm2)
11. [Local Development (Docker)](#11-local-development-docker)
12. [Role-Based Access Control](#12-role-based-access-control)
13. [Environment & Configuration](#13-environment--configuration)
14. [Known Limitations & Future Improvements](#14-known-limitations--future-improvements)

---

## 1. System Overview

Skywalker is a **monolithic** Node.js/Express web application designed for internal team use. It follows a classic **Server-Side Rendering (SSR)** pattern where the backend serves HTML pages directly and handles all business logic.

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                               │
│                                                                 │
│  ┌──────────────────┐    ┌────────────────┐  ┌───────────────┐ │
│  │    EC2 (t3.micro) │───▶│ RDS PostgreSQL │  │   S3 Bucket   │ │
│  │  Node.js + PM2    │    │  (innodb123)   │  │ (file storage)│ │
│  │  Port 3000        │───▶└────────────────┘  └───────────────┘ │
│  └──────────────────┘                                           │
│           ▲                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │ HTTP (TCP:3000)
     ┌──────┴──────┐
     │  Team Users  │  (browser — any device, any OS)
     └─────────────┘
```

**Why monolithic?** For a team of ~30 users, a monolith is the right choice. It's simpler to deploy, debug, and reason about than a microservices architecture. The performance characteristics of a single Node.js process with a PG connection pool are more than sufficient for this scale.

---

## 2. Technology Stack Rationale

| Layer | Technology | Why |
| :--- | :--- | :--- |
| **Runtime** | Node.js 20 LTS | Non-blocking I/O ideal for file streaming; vast ecosystem |
| **Framework** | Express 4 | Minimal, battle-tested, widely understood |
| **Database** | PostgreSQL 15 | ACID transactions; JSON support; excellent for relational data |
| **ORM/Client** | `pg` (node-postgres) | Direct SQL; no ORM magic; full query control |
| **Session Store** | `connect-pg-simple` | Persists sessions to the same Postgres DB. Sessions survive PM2 restarts |
| **File Storage** | AWS S3 + `multer-s3` | Files stream directly from user → server → S3. Server disk never fills up |
| **Auth Hashing** | `bcryptjs` (cost 12) | Industry standard. Cost factor 12 is ~250ms per hash — slow enough to resist brute force |
| **Security Headers** | `helmet` v7 | Sets 11 HTTP security headers with one line |
| **Rate Limiting** | `express-rate-limit` | In-memory per-process. Suitable for single-instance deployments |
| **Process Manager** | PM2 | Keeps app alive. Integrates with systemd for boot persistence |
| **Frontend** | Vanilla HTML/CSS/JS | Zero build step. Zero dependencies on the client. Loads instantly |

---

## 3. Request Lifecycle

### Example: User uploads a PDF

```
1.  Browser          →  POST /api/submissions (multipart/form-data)
2.  Express          →  Rate limiter check (apiLimiter: 120 req/min)
3.  Express          →  Session check (requireLogin middleware)
4.  Multer           →  Intercepts the file stream before the route handler runs
5.  multer-s3        →  Pipes the file directly to S3:
                           - Sets content-type from file.mimetype
                           - Generates a unique key: uploads/1234567890-938471.pdf
                           - Returns req.file.location (the full S3 URL)
6.  Route handler    →  Validates req.body (department, content_type)
7.  Pool.query()     →  Inserts metadata into submissions table:
                           (user_id, username, department, file_path, file_name, file_size, mime_type)
8.  Response         →  { success: true, submission: { id, ... } }
9.  Browser          →  Shows success toast, reloads vault
```

**Key insight**: The file never touches the server's disk. It goes straight from the user's browser through the network socket into S3. The database only stores the metadata (URL, filename, size, MIME type).

---

## 4. Authentication & Session System

### Login Flow

```
POST /auth/login
  → bcrypt.compare(password, hash)         ← ~250ms intentional delay
  → req.session.regenerate()               ← prevents session fixation attack
  → req.session.userId  = user.id
  → req.session.username = user.username
  → req.session.role    = user.role
  → Session saved to PostgreSQL session table
  → { success: true, role, username }
```

### Session Persistence

Sessions are stored in the `session` table in PostgreSQL (managed by `connect-pg-simple`). This means:

- **Server restarts**: Users stay logged in. Sessions survive PM2 restarts, EC2 reboots.
- **Cookie**: `httpOnly: true` prevents JavaScript from reading it (XSS mitigation). `maxAge: 7 days`.
- **Logout**: `req.session.destroy()` deletes the row from the `session` table immediately.

### Session Fixation Protection

On every successful login, `req.session.regenerate()` is called. This:
1. Destroys the old session (with its old session ID)
2. Creates a brand-new session with a new, random session ID
3. Assigns user data to the new session

This prevents an attacker from pre-setting a session ID and waiting for a victim to log in with it.

---

## 5. File Upload Pipeline

```
Browser (FormData)
   │  multipart/form-data
   ▼
Multer Middleware
   ├─ fileFilter(): validates MIME type against whitelist
   ├─ limits.fileSize: rejects files > MAX_FILE_SIZE_MB (default 100MB)
   └─ storage: multerS3(...)
         │
         ├─ contentType: explicit (file.mimetype) — not AUTO_CONTENT_TYPE
         │  (AUTO_CONTENT_TYPE was removed due to streaming reliability issues)
         │
         ├─ key: `uploads/${Date.now()}-${random}.ext`
         │
         └─ Pipes directly to S3 SDK PutObject stream
              │
              ▼
        AWS S3 Bucket
        └─ Returns req.file.location = "https://bucket.s3.region.amazonaws.com/uploads/..."
```

### Supported File Types
Images (JPEG, PNG, GIF, WebP, SVG), Videos (MP4, MOV, AVI, WebM), PDFs, Office docs (Word, Excel, PowerPoint), Plain text, CSV, JSON, XML, ZIP archives.

### S3 Cleanup on Failure

If the PostgreSQL `INSERT` fails after a file is already uploaded to S3, the route handler automatically calls `DeleteObjectCommand` to clean up the orphaned S3 object. No data leakage.

---

## 6. Database Schema

### `users` Table

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | SERIAL PK | Auto-incrementing |
| `username` | TEXT UNIQUE | Stored lowercase |
| `password_hash` | TEXT | bcrypt hash, cost 12 |
| `role` | TEXT | `'admin'` or `'member'` (DB-enforced CHECK) |
| `created_at` | TIMESTAMPTZ | UTC timestamp |

### `submissions` Table

| Column | Type | Notes |
| :--- | :--- | :--- |
| `id` | SERIAL PK | |
| `user_id` | INTEGER FK | → `users.id` ON DELETE CASCADE |
| `username` | TEXT | Denormalized for display (no JOIN needed) |
| `department_name` | TEXT | Engineering, Marketing, etc. |
| `content_type` | TEXT | DB-enforced enum: Ad, Note, Image, PDF, etc. |
| `data_body` | TEXT | For text-based entries (notes, links, code) |
| `file_path` | TEXT | Full S3 URL |
| `file_name` | TEXT | Original filename |
| `file_size` | BIGINT | In bytes |
| `mime_type` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

### `session` Table

Managed automatically by `connect-pg-simple`. Standard `sid / sess / expire` structure.

### Indexes

Four indexes are created on `submissions` for fast filtering:
- `idx_submissions_user_id` — filtering by user
- `idx_submissions_created_at DESC` — default sort order
- `idx_submissions_content_type` — type filter
- `idx_submissions_department` — department filter

---

## 7. Security Layers

| Layer | Mechanism | Protects Against |
| :--- | :--- | :--- |
| **Password Hashing** | bcryptjs cost 12 | Credential database leaks |
| **Session Fixation** | `req.session.regenerate()` on login | Session hijacking pre-login |
| **HTTP Headers** | `helmet` v7 | Clickjacking, MIME sniffing, XSS, etc. |
| **Session `httpOnly`** | Cookie flag | XSS-based session theft |
| **Auth Middleware** | `requireLogin` on all routes | Unauthenticated access |
| **Admin Middleware** | `requireAdmin` on admin routes | Privilege escalation |
| **Rate Limiting** | 20 req/15min on auth | Brute force on login |
| **Rate Limiting** | 120 req/min on API | DDoS / scraping |
| **File Validation** | MIME whitelist in `fileFilter` | Malicious file uploads |
| **S3 IAM Policy** | `AmazonS3FullAccess` scoped key | Only S3 ops with this key |
| **Body Size Limits** | `express.json({ limit: '1mb' })` | JSON payload bombs |

---

## 8. Rate Limiting Strategy

The rate limiting is carefully two-tiered to avoid the "reload lockout" bug.

```javascript
// TIGHT: brute-force protection
// Applied ONLY to POST /auth/login and POST /auth/register
authLimiter: 20 requests / 15 minutes

// GENEROUS: DDoS mitigation
// Applied to ALL other /auth/* and /api/* routes
// This includes /auth/me, which fires on EVERY page load via shared.js
apiLimiter: 120 requests / 1 minute
```

**Why this matters**: `/auth/me` is called by `shared.js` on every page load to hydrate the navigation bar with the user's name and role. If `/auth/me` was behind the tight limiter, reloading the page 20 times in 15 minutes would lock the user out — this bug was found and fixed in production.

---

## 9. Health Monitoring System

`GET /api/health` (admin only) fires 10 parallel PostgreSQL queries and 1 S3 listing:

| Query | Data |
| :--- | :--- |
| `pg_stat_activity` | Active DB connection count |
| `pg_database_size()` | Total database size in human-readable form |
| `pg_stat_user_tables` | Per-table size and row counts |
| `COUNT(*) FROM submissions` | Total vault entries |
| `COUNT(*) FROM users` | Total user accounts |
| Recent activity (14 days) | Daily submission counts for activity chart |
| Content breakdown | Distribution of content types |
| Department breakdown | Distribution by department |
| `SELECT version()` | PostgreSQL version string |
| `ListObjectsV2` (S3) | Total bytes and object count in bucket |

All queries are wrapped in `Promise.all()` for concurrent execution. Total health endpoint response time is bounded by the slowest single query, not the sum of all queries.

---

## 10. Production Deployment (EC2 + PM2)

### Server: AWS EC2 t3.micro (Ubuntu 24.04)
- **IP**: Configured via AWS (update `deploy.ps1` with your instance's public IP)
- **Access**: `ssh -i <your-key>.pem ubuntu@<your-ec2-ip>`
- **App path**: `~/skywalker/`

### PM2 Configuration
```bash
pm2 start server.js --name skywalker   # Start
pm2 restart skywalker                   # Restart
pm2 logs skywalker --lines 50           # View logs
pm2 monit                               # Live process monitor
pm2 startup systemd && pm2 save         # Persist across reboots
```

### Deployment Workflow (using deploy.ps1)
1. Edit files locally
2. Run `./deploy.ps1` in PowerShell
3. Script SCPs changed directories to EC2 and runs `pm2 restart`
4. Changes are live in ~15 seconds

---

## 11. Local Development (Docker)

The `docker-compose.yml` spins up a complete local stack:

| Container | Role |
| :--- | :--- |
| `skywalker-db` | PostgreSQL 15. Schema auto-applied via Docker init hook |
| `skywalker-s3` | LocalStack (S3 emulator). API-compatible with real AWS SDK |
| `skywalker-app` | The Node.js app, connected to the above two |
| `skywalker-seeder` | One-shot service that creates the admin account |

```bash
npm run docker:up   # Start everything
npm run docker:down # Stop and wipe all data
```

**No AWS account required.** The app uses `S3_ENDPOINT=http://localstack:4566` to redirect all S3 calls to the local emulator.

---

## 12. Role-Based Access Control

| Route | Member | Admin |
| :--- | :--- | :--- |
| `GET /login` | ✅ | ✅ |
| `GET /vault` | ✅ | ✅ |
| `GET /input` | ✅ | ✅ |
| `POST /api/submissions` | ✅ | ✅ |
| `DELETE /api/submissions/:id` | ✅ (own entries) | ✅ (any entry) |
| `GET /admin` | ❌ | ✅ |
| `GET /health` | ❌ | ✅ |
| `POST /auth/register` | ❌ | ✅ |
| `POST /auth/reset-password` | ❌ | ✅ |
| `PATCH /api/admin/users/:id/role` | ❌ | ✅ |
| `DELETE /api/admin/users/:id` | ❌ | ✅ |

**Admin self-protection**: Admins cannot delete their own account or demote their own role. This prevents accidental lockout.

---

## 13. Environment & Configuration

All configuration is via environment variables (`.env` file). See `.env.example` for the full list with descriptions.

**Critical variables:**
- `SESSION_SECRET`: Must be a long, cryptographically random string (32+ chars). Changing this invalidates all active sessions.
- `DB_SSL`: `true` for AWS RDS (default), `false` for local/Docker.
- `ADMIN_LOCK`: `true` restricts all deletions to admins only. Useful for regulated environments.
- `S3_FREE_GB`: Controls the storage meter in the health dashboard (default `5` for S3 free tier; set to `10` if using Cloudflare R2).

---

## 14. Known Limitations & Future Improvements

| Area | Current State | Suggested Improvement |
| :--- | :--- | :--- |
| **HTTPS** | HTTP only | Add Nginx reverse proxy + Certbot (Let's Encrypt) |
| **Rate Limiting** | In-memory (per process) | Use Redis for shared state if scaling to multiple EC2 instances |
| **File Preview** | S3 URL direct link | Add pre-signed URL generation for private buckets |
| **Search** | ILIKE (case-insensitive LIKE) | Add PostgreSQL full-text search (`tsvector`) for large datasets |
| **Audit Log** | None | Add an `audit_log` table recording who deleted what and when |
| **2FA** | None | Add TOTP-based two-factor for admin accounts |
| **CI/CD** | GitHub Actions (lint + Docker build + integration smoke test) | Add auto-deploy step to EC2 on green CI |
| **Bucket Policy** | Public read (required for file preview) | Use pre-signed URLs + private bucket for stricter security |
