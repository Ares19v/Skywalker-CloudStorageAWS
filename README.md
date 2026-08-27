<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/AWS_S3-Storage-FF9900?style=for-the-badge&logo=amazons3&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
  <img src="https://github.com/Ares19v/Skywalker-CloudStorageAWS/actions/workflows/ci.yml/badge.svg" alt="CI" />
</p>

<h1 align="center">Skywalker</h1>
<p align="center"><strong>A high-performance, role-based cloud data vault for internal teams.</strong><br/>Upload files, store notes, and manage company data — securely, from any device, anywhere in the world.</p>

---

## 🌟 Overview

Skywalker is a full-stack internal dashboard that allows non-technical team members to securely submit and browse company assets — images, PDFs, videos, documents, links, and notes — through a clean dark-mode interface.

All files are streamed directly to **AWS S3**. All metadata, users, and sessions are persisted in **PostgreSQL**. The server runs on **AWS EC2** with **PM2** ensuring 24/7 uptime, even through crashes and reboots.

---

## ✨ Features

| Feature | Details |
| :--- | :--- |
| **Role-Based Access** | Admin and Member roles with protected routes |
| **Secure Auth** | Bcrypt-hashed passwords, session regeneration on login |
| **File Vault** | Upload images, PDFs, videos, documents directly to S3 |
| **Real-time Search** | Filter and search across all entries by type, department, or keyword |
| **Admin Dashboard** | Manage users, reset passwords, promote/demote roles |
| **Health Monitor** | Live server stats, DB metrics, S3 storage usage meter |
| **Rate Limiting** | Brute-force protection on auth endpoints, DDoS mitigation on API |
| **Security Headers** | Helmet.js enforcing X-Frame-Options, X-Content-Type, HSTS, etc. |
| **Docker Support** | Full local dev environment with LocalStack S3 emulation |
| **PM2 + systemd** | Auto-restarts on crash, persists across server reboots |

---

## 🏗️ Architecture

```
Browser (Any Device)
       │
       ▼
┌─────────────────────┐
│  AWS EC2 (Ubuntu)   │  ← Node.js / Express (PM2)
│   Port :3000        │
└─────────┬───────────┘
          │         │
          ▼         ▼
  ┌─────────────┐  ┌─────────────┐
  │  AWS RDS    │  │   AWS S3    │
  │ PostgreSQL  │  │ File Vault  │
  │(users, meta)│  │(binary files│
  └─────────────┘  └─────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A **PostgreSQL** database (AWS RDS or local)
- An **AWS S3** bucket (or use Docker + LocalStack for local dev)

### Option A: AWS Deployment (Production)

```bash
# 1. Clone the repository
git clone https://github.com/Ares19v/Skywalker-CloudStorageAWS.git
cd CloudStorageAWS

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your RDS, S3, and AWS IAM credentials

# 4. Initialize the database schema
npm run db:init

# 5. Create the admin account
npm run seed:admin

# 6. Start the server
npm start
```

### Option B: Local Development (Docker — No AWS Account Required)

```bash
# 1. Clone and configure
git clone https://github.com/Ares19v/Skywalker-CloudStorageAWS.git
cd CloudStorageAWS

# 2. Start the entire stack (DB + S3 emulator + App) with one command
npm run docker:up

# App will be available at http://localhost:3000
# Default admin credentials: username: admin | password: admin123
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and populate:

```env
# Database (AWS RDS / Local Postgres)
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_NAME=skywalker
DB_USER=postgres
DB_PASSWORD=your_password
DB_SSL=true           # Set to "false" for local/Docker

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=YOUR_KEY
AWS_SECRET_ACCESS_KEY=YOUR_SECRET
S3_BUCKET_NAME=your-bucket-name

# App
PORT=3000
SESSION_SECRET=a_very_long_random_secret_string
MAX_FILE_SIZE_MB=100
ADMIN_LOCK=false      # true = only admins can delete entries
```

---

## 📁 Project Structure

```
skywalker/
├── server.js                 # Express app entry point, middleware config
├── package.json
├── Dockerfile
├── docker-compose.yml        # Full local stack (Postgres + LocalStack + App)
│
├── db/
│   ├── pool.js               # PostgreSQL connection pool
│   └── schema.sql            # Database schema (users, sessions, submissions)
│
├── routes/
│   ├── auth.js               # Login, logout, register, password management
│   ├── submissions.js        # File upload (S3) + CRUD for vault entries
│   ├── admin.js              # User management (admin only)
│   └── health.js             # Server & DB health metrics
│
├── middleware/
│   └── auth.js               # requireLogin / requireAdmin guards
│
├── views/                    # Server-rendered HTML pages
│   ├── login.html
│   ├── vault.html            # Main content browser
│   ├── input.html            # Upload/submission form
│   ├── admin.html            # User management panel
│   └── health.html           # Health & metrics dashboard
│
├── public/                   # Static assets (CSS, client JS)
│   ├── css/
│   └── js/
│
└── scripts/
    ├── initDb.js             # Runs schema.sql against the database
    ├── seedAdmin.js          # Interactive admin account creator
    └── testS3.js             # S3 connectivity smoke test
```

---

## 🔐 Security

- **Passwords**: Hashed with `bcryptjs` (cost factor 12). Plaintext never stored.
- **Sessions**: Server-side PostgreSQL store (`connect-pg-simple`). Regenerated on login to prevent session fixation.
- **HTTP Headers**: `helmet.js` sets `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, and more.
- **Rate Limiting**: Auth endpoints (login/register) are limited to 20 requests/15 minutes. All API endpoints are limited to 120 requests/minute.
- **Authorization**: All routes are protected by session guards. Admin routes require `role === 'admin'` verified server-side.
- **File Validation**: Only whitelisted MIME types are accepted for upload.

---

## 🐳 Docker Reference

```bash
# Start full local stack
docker-compose up --build

# Stop and clean up (removes volumes/data)
docker-compose down -v

# View app logs
docker-compose logs -f app
```

### Windows Quick Launch

| Script | Purpose |
| :--- | :--- |
| `INSTALL.bat` | First-time setup — builds containers and opens the app |
| `Run_Project.bat` | Day-to-day launcher — starts the stack and opens the browser |
| `UNINSTALL.bat` | Full teardown — removes containers, images, and all data |

---

## 📜 License

MIT © 2025 [Devansh Tyagi](https://github.com/Ares19v)

---
<p align="center">
  Made by Devansh Tyagi @ 2026
</p>