# EVAL — CompanyDB

> **Evaluation Date:** 2026-05-29  
> **Evaluator:** Automated Portfolio Review  
> **Maturity Level:** Production-Ready

---

## 1. Project Purpose & Problem Statement

Internal teams frequently need a secure, role-controlled repository for shared company assets — images, PDFs, videos, documents, links, and notes — without relying on consumer-grade file sharing services (Google Drive, Dropbox) that lack RBAC, audit trails, or internal-only access controls. CompanyDB is a production-grade internal data vault built for teams of ~30 users, deployed on real AWS infrastructure (EC2 + RDS + S3) and kept alive 24/7 by PM2.

The design philosophy is correctly matched to scale: a monolithic Node.js/Express application is the right tool for this use case. It avoids the operational complexity of microservices while delivering battle-tested features: role-based access control, bcrypt-hashed authentication with session fixation protection, Helmet.js security headers, two-tiered rate limiting, and direct file streaming from browser to S3.

---

## 2. Technical Architecture

CompanyDB is a classic SSR monolith: the backend serves HTML pages directly and handles all business logic.

**Server (`server.js`):** Express 4 application with Helmet.js, `express-rate-limit`, `connect-pg-simple` session store, and `multer-s3` for direct-to-S3 file streaming. Sessions are persisted to the same PostgreSQL database, surviving PM2 restarts and EC2 reboots.

**Database (PostgreSQL 15 via AWS RDS):** Three tables — `users` (bcrypt-hashed passwords, role enum enforced at DB level), `submissions` (denormalized metadata + S3 URL), and `session` (managed by connect-pg-simple). Four indexes on `submissions` for fast filtering by user, date, content type, and department. Files never touch the server's disk — they stream directly browser ? multer-s3 ? S3.

**Auth System:** bcrypt cost factor 12 (~250ms intentional delay for brute-force resistance). `req.session.regenerate()` on every successful login prevents session fixation. `httpOnly` cookie flag blocks XSS-based session theft. Seven-day session expiry.

**Rate Limiting (Two-Tiered):** 20 req/15min on auth login/register endpoints; 120 req/min on all API endpoints. Importantly, `/auth/me` (called on every page load for nav hydration) uses the generous limit — a real production bug was found and fixed where the tight limiter was initially applied, locking users out after 20 page loads.

**Production Deployment:** AWS EC2 t3.micro (Ubuntu 24.04) managed by PM2 with systemd integration for boot persistence. `deploy.ps1` PowerShell script SCPs changed files to EC2 and runs `pm2 restart` in ~15 seconds.

**Local Development:** Docker Compose stack with PostgreSQL 15, LocalStack (S3 emulator), the Node app, and a one-shot seeder for the admin account — no AWS account required.

**Health Monitoring:** Admin-only `/api/health` endpoint fires 10 parallel PostgreSQL diagnostic queries and an S3 `ListObjectsV2` via `Promise.all()`, displaying active connections, database size, per-table stats, content distribution, and S3 storage usage.

---

## 3. Strengths

- **Actually deployed on AWS:** EC2 + RDS + S3 with PM2 + systemd — not just Docker-compose local. This is a real cloud deployment with real infrastructure decisions.
- **Security depth is genuine:** Session fixation protection, httpOnly cookies, Helmet.js headers, MIME whitelist for uploads, S3 cleanup on DB insert failure, two-tiered rate limiting with a documented production bug fix.
- **File streaming architecture is correct:** Files never touch server disk — direct browser ? S3 streaming via `multer-s3` is the right architecture for a file vault.
- **Comprehensive ARCHITECTURE.md:** 349 lines of technical reference covering every layer from request lifecycle to session persistence to rate limiting rationale.
- **Role-based access is complete:** Admin self-protection (cannot delete own account or demote own role) prevents accidental lockout.
- **Parallel health queries** using `Promise.all()` — bounded by slowest single query, not sum.
- **LocalStack integration** for zero-AWS-account local development.

---

## 4. Limitations & Known Gaps

- **No HTTPS at the application layer:** Currently HTTP only. The ARCHITECTURE.md acknowledges this and recommends Nginx + Certbot, but it is a significant gap for a tool storing company files.
- **Rate limiting is in-memory:** Suitable for single EC2 instance; would not work correctly across horizontally scaled instances without Redis.
- **S3 bucket is public-read:** Required for direct file preview via S3 URL, but creates a security gap — any URL-guesser can access files. Pre-signed URLs with a private bucket is the correct solution.
- **No audit log:** There is no record of who deleted what. For an internal data vault, audit trails are important for compliance.
- **No full-text search:** ILIKE (case-insensitive LIKE) is used for search — will degrade on large datasets. PostgreSQL `tsvector` full-text search is noted as a future improvement.
- **No 2FA for admin accounts:** A single-factor admin account is a meaningful risk for an internal vault.
- **Frontend is vanilla HTML/CSS/JS:** Zero build step, loads instantly — but makes the frontend hard to maintain at scale.

---

## 5. Code Quality Assessment

The server is well-structured: `routes/` with separate auth, submissions, admin, and health files; `middleware/` for auth guards; `db/` for the pool and schema; `scripts/` for initialization utilities. `server.js` is 7.7KB — compact and readable.

**Documentation:** ARCHITECTURE.md is one of the strongest technical documents in this portfolio — precise, layered, and honest about tradeoffs. DEPLOYMENT.md, SECURITY.md, and TEARDOWN_AND_REBUILD.md are all present.

**Testing:** GitHub Actions CI includes lint + Docker build + integration smoke test. No unit test suite is visible.

**Security documentation:** SECURITY.md exists and is thorough.

---

## 6. Maturity Breakdown

| Dimension | Score | Notes |
|-----------|-------|-------|
| Functionality | 9/10 | Complete RBAC vault with real AWS deployment and health monitoring |
| Code Quality | 8/10 | Clean monolith; well-structured routes and middleware |
| Documentation | 10/10 | ARCHITECTURE.md is exceptional; all layers documented with rationale |
| Scalability | 6/10 | Correct for ~30 users; in-memory rate limiting limits horizontal scale |
| Security | 7/10 | Strong auth/session security; HTTP-only and public S3 bucket are notable gaps |
| **Overall** | **8.0/10** | **Genuinely deployed production-grade system with excellent documentation** |

---

## 7. Suggested Next Steps

1. **Add Nginx reverse proxy with Let's Encrypt TLS** — HTTPS is non-negotiable for a system handling company files with credentials. This is already documented in ARCHITECTURE.md and should be the next concrete step.
2. **Switch to pre-signed S3 URLs with a private bucket** — eliminates the public-read exposure. Requires generating time-limited signed URLs server-side for each file preview/download.
3. **Add an `audit_log` table** recording user ID, action (upload/delete), resource ID, and timestamp — essential for any compliance posture in an internal vault.

---

## 8. Verdict

CompanyDB is the most production-mature project in this portfolio from an infrastructure standpoint: it is actually deployed on AWS EC2 with RDS, S3, and PM2 with systemd, not just running in a local Docker Compose. The security implementation is layered and thoughtful — the two-tiered rate limiting fix (catching the `/auth/me` lockout bug in production) demonstrates real operational debugging experience. The ARCHITECTURE.md is among the best technical documents here. The gaps (HTTP-only, public S3 bucket, no audit log) are real and acknowledged; they represent the next engineering iteration, not fundamental flaws.
