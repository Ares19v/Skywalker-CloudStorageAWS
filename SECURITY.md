# Security Policy

## Supported Versions

| Version | Supported |
| :------ | :-------- |
| 1.x     | ✅ Yes    |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Skywalker, please report it responsibly by emailing:

📧 **[your-email@example.com]**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You can expect an acknowledgement within **48 hours** and a resolution timeline within **7 days** for confirmed issues.

## Security Design

Skywalker is designed with the following security measures:

- **Passwords** hashed with `bcryptjs` (cost factor 12) — plaintext never stored
- **Sessions** stored server-side in PostgreSQL (`connect-pg-simple`) with `httpOnly` cookies
- **Session fixation** prevention via `req.session.regenerate()` on every login
- **HTTP security headers** enforced via `helmet` v7
- **Rate limiting** on all auth and API endpoints
- **Role-based access control** enforced server-side on every protected route
- **File upload validation** — MIME type whitelist, size limits
- **Environment secrets** managed via `.env` (never committed to Git)

## Scope

This policy applies to the Skywalker source code in this repository.
AWS credentials, EC2 access keys, and RDS credentials are **out of scope** —
they are never committed to this repository.
