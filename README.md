# CompanyDB

A high-performance, minimalist internal database dashboard for teams. Built for non-technical users to securely submit, store, and browse company data — ads, links, notes, documents, images, videos, and more — through a clean dark-mode interface.

Deployed on AWS (EC2 + RDS + S3). No technical knowledge required to use it.

---

## Features

- **Authentication** — Secure login with bcrypt-hashed passwords and server-side sessions
- **Role System** — Admin and Member roles with full permission enforcement
- **Submit Anything** — Text, links, ads, notes, code, images, videos, PDFs, PPTs, Word docs (up to 100MB)
- **The Vault** — Searchable, sortable table of all submissions with inline preview (images, video, PDF)
- **Admin Panel** — Create/delete accounts, promote members to admin, reset passwords
- **Ownership Enforcement** — Users can only delete their own entries; admins can delete anything
- **DB Health Dashboard** — Live RDS diagnostics, S3 storage meter, connection pool stats, activity charts
- **Rate Limiting** — Brute-force protection on auth endpoints
- **File Storage** — Files go to AWS S3, never to the server disk

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Database | PostgreSQL (AWS RDS) |
| File Storage | AWS S3 |
| Process Manager | PM2 |
| Frontend | Vanilla HTML + CSS (dark mode, no frameworks) |
| Auth | bcryptjs + express-session + connect-pg-simple |
| File Uploads | multer + multer-s3 + @aws-sdk/client-s3 |

---

## Architecture

```
Users (browser)
      ↓
EC2 Instance  ← Node.js/Express app (PM2)
      ↓              ↓
  AWS RDS          AWS S3
(PostgreSQL)    (file uploads)
```

---

## Prerequisites

- [Node.js v20+](https://nodejs.org)
- PostgreSQL database (AWS RDS recommended)
- AWS S3 bucket
- AWS IAM user with `AmazonS3FullAccess`

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/your-username/companydb.git
cd companydb
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and set:

```env
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=postgres
DB_PASSWORD=your_db_password

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_iam_access_key
AWS_SECRET_ACCESS_KEY=your_iam_secret_key
S3_BUCKET_NAME=your-s3-bucket-name
S3_PUBLIC_URL=https://your-bucket.s3.ap-south-1.amazonaws.com

PORT=3000
SESSION_SECRET=replace_this_with_a_long_random_string
MAX_FILE_SIZE_MB=100
ADMIN_LOCK=false
S3_FREE_GB=5
```

### 4. Initialize the database

```bash
npm run db:init
```

### 5. Create your admin account

```bash
npm run seed:admin
```

### 6. Start the server

```bash
node server.js
```

Visit [http://localhost:3000](http://localhost:3000)

---

## Production Deployment (AWS EC2)

### Requirements
- Ubuntu 22.04+ EC2 instance (t3.micro or larger)
- Security group allowing ports: 22 (SSH), 3000 (or 80/443)

### Steps

**1. SSH into your EC2 instance**
```bash
ssh -i "your-key.pem" ubuntu@<your-ec2-ip>
```

**2. Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**3. Install PM2**
```bash
sudo npm install -g pm2
```

**4. Copy project files** (from your local machine)
```bash
scp -i "your-key.pem" -r ./companydb ubuntu@<your-ec2-ip>:~/companydb
```

**5. Install, initialize, and start**
```bash
cd ~/companydb
npm install
npm run db:init
npm run seed:admin
pm2 start server.js --name companydb
pm2 save
pm2 startup
```

App is now live at `http://<your-ec2-ip>:3000`

For HTTPS setup, see [DEPLOYMENT.md](./DEPLOYMENT.md).

---

## Pages

| Route | Access | Description |
|---|---|---|
| `/login` | Public | Sign in |
| `/input` | All users | Submit new entry (text or file) |
| `/vault` | All users | Browse all submissions |
| `/admin` | Admin only | Manage user accounts |
| `/health` | Admin only | DB + S3 health dashboard |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DB_HOST` | ✅ | PostgreSQL host |
| `DB_PORT` | ✅ | PostgreSQL port (default: 5432) |
| `DB_NAME` | ✅ | Database name |
| `DB_USER` | ✅ | Database username |
| `DB_PASSWORD` | ✅ | Database password |
| `AWS_REGION` | ✅ | AWS region (e.g. ap-south-1) |
| `AWS_ACCESS_KEY_ID` | ✅ | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | ✅ | IAM secret key |
| `S3_BUCKET_NAME` | ✅ | S3 bucket name |
| `S3_PUBLIC_URL` | ✅ | Public base URL of S3 bucket |
| `SESSION_SECRET` | ✅ | Random string for session signing |
| `PORT` | ❌ | Server port (default: 3000) |
| `MAX_FILE_SIZE_MB` | ❌ | Max upload size in MB (default: 100) |
| `ADMIN_LOCK` | ❌ | Set `true` to restrict all deletes to admins |
| `S3_FREE_GB` | ❌ | Free tier limit for storage meter (default: 5) |

---

## Supported File Types

| Category | Formats |
|---|---|
| Images | JPG, PNG, GIF, WebP, SVG |
| Videos | MP4, MOV, AVI, WebM |
| Documents | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX |
| Code / Text | TXT, JS, PY, JSON, CSV, HTML, CSS, XML |
| Archives | ZIP |

---

## Scripts

```bash
npm start          # Start server
npm run dev        # Start with auto-reload (node --watch)
npm run db:init    # Create database tables
npm run seed:admin # Create/reset admin account
```

---

## Security Notes

- Passwords hashed with bcrypt (cost factor 12)
- Sessions stored in PostgreSQL (not in-memory)
- File uploads go directly to S3 — never touch the server disk
- Rate limiting: 20 requests/15min on auth, 120 requests/min on API
- `.env` and `*.pem` are gitignored — never commit them
- Set `ADMIN_LOCK=true` to restrict all deletions to admins only

---

## License

MIT
