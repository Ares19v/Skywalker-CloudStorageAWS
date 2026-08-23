# Study Prep Guide: CompanyDB

Welcome! This guide is a step-by-step beginner's tutorial to help you understand and build **CompanyDB**—a production-grade, role-based cloud data vault. You will learn how to build secure backend servers, manage relational databases, interface with AWS S3, and deploy applications that run 24/7.

---

## 🗺️ System Architecture

CompanyDB uses a monolithic server architecture. The web application runs on Node.js/Express and coordinates with PostgreSQL for metadata/auth, and AWS S3 for binary files.

```
                    Browser (Web Client)
                             │
                             ▼
                 ┌───────────────────────┐
                 │ Express Server (Node) │
                 └─────┬───────────┬─────┘
                       │           │
       (User/Session Meta)       (File Upload Streams)
                       │           │
             ┌─────────▼─┐       ┌─▼─────────┐
             │PostgreSQL │       │  AWS S3   │
             └───────────┘       └───────────┘
```

---

## 📚 Core Learning Prerequisites

Make sure you understand:
1. **Node.js & Express**: Handling HTTP requests, routing, and writing middleware functions.
2. **Relational Databases (SQL)**: Creating tables, foreign keys, constraints, and querying using Node-Postgres (`pg`).
3. **Session-based Authentication**: Storing user states inside a secure server-side session instead of stateless tokens.
4. **Cloud Storage (S3)**: Understanding Buckets, Access Control Lists (ACLs), and writing file streams directly to the cloud without exhausting server memory.

---

## 🛠️ Step-by-Step Implementation Guide

Let's build a micro-version of an Express server with file uploads and S3 mock stubs!

### Step 1: Set Up the Environment
Create a folder and install the required modules:
```bash
mkdir mini-companydb
cd mini-companydb
npm init -y
npm install express express-session multer dotenv pg
npm install @types/express @types/node typescript ts-node --save-dev
npx tsc --init
```

---

### Step 2: Implement Role-Based Access Control Middleware
Create `authMiddleware.ts` to see how we protect backend routes based on user roles:

```typescript
import { Request, Response, NextFunction } from 'express';

// Extend Express Session definition
declare module 'express-session' {
  interface SessionData {
    user?: {
      username: string;
      role: 'admin' | 'member';
    };
  }
}

export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: "Access Denied: Please log in first." });
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: "Access Denied: Admin privileges required." });
  }
  next();
}
```

---

### Step 3: Direct File Upload to S3 Mock App
Create `server.ts` to serve a simple Express app with mock S3 file streaming:

```typescript
import express from 'express';
import session from 'express-session';
import multer from 'multer';
import { requireLogin, requireAdmin } from './authMiddleware';

const app = express();
app.use(express.json());

// Set up session store (in-memory for local testing)
app.use(session({
  secret: 'my-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true }
}));

// Configure Multer for in-memory files (no disk writes!)
const upload = multer({ storage: multer.memoryStorage() });

// Mock Login Route
app.post('/api/login', (req, res) => {
  const { username, role } = req.body; // e.g. role: 'admin' or 'member'
  req.session.user = { username, role };
  res.json({ success: true, user: req.session.user });
});

// Protected Submission Route (Requires login + handles file stream)
app.post('/api/upload', requireLogin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // In a real S3 app, we stream this buffer (req.file.buffer) straight to S3 bucket.
  console.log(`Streaming ${req.file.originalname} (${req.file.size} bytes) to AWS S3...`);
  
  res.json({
    success: true,
    fileUrl: `https://mock-bucket.s3.amazonaws.com/${Date.now()}-${req.file.originalname}`
  });
});

// Admin Only Route
app.get('/api/admin/dashboard', requireLogin, requireAdmin, (req, res) => {
  res.json({ stats: { totalUsers: 45, totalFiles: 289 } });
});

app.listen(3000, () => {
  console.log('CompanyDB mock app listening on port 3000');
});
```

Run uvicorn or ts-node app:
```bash
npx ts-node server.ts
```

---

## 🔍 Key Deep Dive Topics

### 1. Direct-to-S3 File Streaming
Normally, file uploads are written to a temp folder on the server's disk first, and then uploaded to cloud storage. This consumes server SSD space and crashes the server under large file loads.
* **Stream Solution**: We use `multer-s3`. When a user uploads a file, Express opens a network stream directly from the browser's request payload straight to AWS S3 bucket. The data is buffered dynamically in RAM without ever hitting the EC2 local disk.

### 2. Session Fixation Attack
If a hacker steals a session ID cookie before a user logs in, they could hijack the user's account once the user authenticates.
* **Defense**: We run `req.session.regenerate()` immediately upon successful credential validation. This destroys the previous session identifier and issues a fresh secure token.

---

## 🎯 Verification Tasks

1. **Local Launch**: Run `INSTALL.bat` or `Run_Project.bat` to spin up the local Docker stack (incorporating Postgres, LocalStack, and Node).
2. **Dashboard Access**: Open `http://localhost:3000`, log in using `admin`/`admin123` credentials, and navigate the Health dashboard to view real-time PostgreSQL database performance.
