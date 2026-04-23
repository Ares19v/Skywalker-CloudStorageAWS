# CompanyDB — Full AWS Teardown & Rebuild Guide

> Use this when you want to delete everything to stop all AWS charges,
> and then rebuild from scratch when you're ready to use it again.
> Everything is self-contained — no prior knowledge needed.

---

## PART 1 — TEARDOWN (Deleting Everything)

### Step 1 — Back Up Your Database

Before deleting RDS, export all your data so you can restore it later.

**SSH into your EC2 first:**
```bash
ssh -i "InnoKey.pem" ubuntu@<your-ec2-ip>
```

**Install pg_dump (if not already installed):**
```bash
sudo apt install postgresql-client -y
```

**Export the database to a SQL file:**
```bash
pg_dump "postgresql://postgres:<your-db-password>@<your-rds-endpoint>:5432/companydb" \
  --no-owner --no-acl -f ~/companydb_backup.sql
```

**Download the backup to your laptop** (run this from your laptop's PowerShell, not EC2):
```powershell
scp -i "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" `
  ubuntu@<your-ec2-ip>:~/companydb_backup.sql `
  "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\companydb_backup.sql"
```

✅ Keep `companydb_backup.sql` safe — this is all your users, submissions, and metadata.

> **Note:** S3 files (PDFs, images, videos) are already safely stored in S3.
> If you want those too, download them from AWS Console → S3 → your bucket → Download.
> Or leave them in S3 — S3 storage costs only ~₹2/GB/month, very cheap to keep.

---

### Step 2 — Delete RDS

1. AWS Console → **RDS** → Databases
2. Select your database (`innothoughts-db`)
3. **Actions → Delete**
4. Uncheck "Create final snapshot" (you already have your backup)
5. Type `delete me` in the confirmation box → Delete

✅ RDS is gone. No more DB charges.

---

### Step 3 — Terminate EC2

1. AWS Console → **EC2** → Instances
2. Select your instance
3. **Instance State → Terminate instance**
4. Confirm termination

✅ EC2 is gone. No more compute charges.

> ⚠️ Your InnoKey.pem is now useless — the instance it connects to doesn't exist.
> Keep the .pem file anyway in case you want to inspect it.

---

### Step 4 — Handle S3

**Option A — Keep S3 (recommended, very cheap):**
- Do nothing. Files stay in S3.
- Cost: ~₹2/GB/month. For 1GB of uploads, that's ₹2/month.
- When you rebuild, your files are already there.

**Option B — Delete S3 completely (truly free):**
1. AWS Console → **S3** → `innothoughts-companydb-v2`
2. **Empty** the bucket first (select all objects → Delete)
3. Then **Delete** the bucket itself

> ⚠️ If you delete S3, all uploaded files (PDFs, images, videos) are permanently gone.
> The database backup only saves text metadata and S3 URLs (which will be dead links).

---

### Step 5 — Delete IAM User (Optional but Recommended)

1. AWS Console → **IAM** → Users
2. Select `companydb-app`
3. **Delete**

✅ No dangling access keys.

---

### Step 6 — Verify Zero Charges

1. AWS Console → **Billing** → **Bills**
2. Check current month shows $0 or only tiny S3 charges (if you kept it)
3. Set up a budget alert: **Billing → Budgets → Create budget → Alert at $1**

---

## PART 2 — REBUILD (Setting Up Again From Scratch)

> Estimated time: 45–60 minutes
> Everything below assumes you have your GitHub repo and `companydb_backup.sql`

---

### Step A — Create a New RDS PostgreSQL Database

1. AWS Console → **RDS** → **Create database**
2. Settings:
   - **Engine**: PostgreSQL
   - **Version**: PostgreSQL 15 (or latest)
   - **Template**: Free Tier (forces db.t3.micro)
   - **DB instance identifier**: `innothoughts-db`
   - **Master username**: `postgres`
   - **Master password**: Set a strong password, note it down
   - **Instance type**: `db.t3.micro`
   - **Storage**: 20 GB gp2, disable autoscaling
   - **Connectivity → Publicly accessible**: YES
   - **VPC security group**: Create new → name it `rds-public`
3. Click **Create database** → wait 5–10 minutes

**After it's created:**
1. Go to the security group created for RDS
2. **Inbound rules → Edit → Add rule:**
   - Type: PostgreSQL
   - Port: 5432
   - Source: `0.0.0.0/0` (allows all IPs — needed for EC2 to connect)
3. Note down the **Endpoint** (looks like `innothoughts-db.xxxx.ap-south-1.rds.amazonaws.com`)

---

### Step B — Create a New S3 Bucket

1. AWS Console → **S3** → **Create bucket**
2. Settings:
   - **Bucket name**: `innothoughts-companydb-v2` (or any unique name)
   - **Region**: `ap-south-1`
   - **Block all public access**: UNCHECK this → acknowledge the warning
3. Click **Create bucket**

**Set bucket policy for public file access:**
1. Click your new bucket → **Permissions** → **Bucket policy** → **Edit**
2. Paste this (replace `innothoughts-companydb-v2` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::innothoughts-companydb-v2/*"
    }
  ]
}
```
3. Save

✅ S3 bucket ready. Files uploaded here will be publicly readable (needed to view them in the browser).

---

### Step C — Create IAM User for S3 Access

The app needs credentials to upload files to S3.

1. AWS Console → **IAM** → **Users** → **Create user**
2. **Username**: `companydb-app`
3. **Next** → **Attach policies directly** → search `AmazonS3FullAccess` → tick it → **Next** → **Create user**
4. Click on the created user → **Security credentials** → **Create access key**
5. **Use case**: Application running outside AWS → **Create**
6. **COPY BOTH KEYS NOW** — you cannot see the secret again:
   - Access Key ID: `AKIA...`
   - Secret Access Key: `xxxx...`

---

### Step D — Launch a New EC2 Instance

1. AWS Console → **EC2** → **Launch instance**
2. Settings:
   - **Name**: `companydb-server`
   - **OS**: Ubuntu 22.04 LTS
   - **Instance type**: `t3.micro`
   - **Key pair**: Create new key pair
     - Name: `InnoKey`
     - Type: RSA
     - Format: `.pem`
     - **Download and save the .pem file** → put it in your project folder
   - **Security group**: Create new security group
     - Name: `companydb-sg`
     - Add rules:
       | Type | Port | Source |
       |---|---|---|
       | SSH | 22 | My IP (or 0.0.0.0/0 if IP changes) |
       | Custom TCP | 3000 | 0.0.0.0/0 |
       | HTTP | 80 | 0.0.0.0/0 |
3. **Launch instance** → wait 1–2 minutes
4. Note down the **Public IPv4 address** (e.g. `13.235.xx.xx`)

**Fix PEM permissions on your laptop (Windows PowerShell):**
```powershell
icacls "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" /inheritance:r
icacls "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" /grant:r "$($env:USERNAME):(R)"
```

---

### Step E — Update .env With New Credentials

Open `C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\.env` and update:

```env
DB_HOST=<paste new RDS endpoint here>
DB_PORT=5432
DB_NAME=companydb
DB_USER=postgres
DB_PASSWORD=<paste new RDS password>

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=<paste new IAM access key>
AWS_SECRET_ACCESS_KEY=<paste new IAM secret key>
S3_BUCKET_NAME=<paste new bucket name>
S3_PUBLIC_URL=https://<bucket-name>.s3.ap-south-1.amazonaws.com

PORT=3000
SESSION_SECRET=companydb_innothoughts_change_this_secret_XkQ9mP2vL7
MAX_FILE_SIZE_MB=100
ADMIN_LOCK=false
S3_FREE_GB=5
```

---

### Step F — Deploy the App to EC2

**Create a clean copy of the project (no node_modules or keys):**
```powershell
robocopy "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB" "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB_deploy" /E /XD node_modules uploads /XF "*.pem" "*.log"
```

**Upload to EC2:**
```powershell
scp -i "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" `
  -r "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB_deploy" `
  ubuntu@<your-new-ec2-ip>:~/companydb
```

**Clean up temp folder:**
```powershell
Remove-Item -Recurse -Force "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB_deploy"
```

---

### Step G — Set Up the EC2 Server

**SSH in:**
```powershell
ssh -i "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" ubuntu@<your-new-ec2-ip>
```

**Run all of these on the EC2:**
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # should say v20.x.x

# Install PM2
sudo npm install -g pm2

# Go to app
cd ~/companydb

# Install dependencies
npm install

# Initialize DB tables
npm run db:init
```

---

### Step H — Restore Your Database Backup (If You Had Data)

If you saved `companydb_backup.sql` during teardown, upload and restore it:

**Upload from laptop to EC2:**
```powershell
scp -i "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" `
  "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\companydb_backup.sql" `
  ubuntu@<your-new-ec2-ip>:~/companydb_backup.sql
```

**On EC2 — restore the data:**
```bash
psql "postgresql://postgres:<password>@<new-rds-endpoint>:5432/companydb" \
  -f ~/companydb_backup.sql
```

> ⚠️ If you restored data, skip `npm run seed:admin` below — your admin account is already in the restored data.
> If starting fresh (no backup), run `npm run seed:admin` to create a new admin account.

---

### Step I — Start the App

**On EC2:**
```bash
cd ~/companydb

# If starting fresh (no backup):
npm run seed:admin   # set your admin password when prompted

# Start with PM2
pm2 start server.js --name companydb
pm2 save

# Enable auto-start on reboot
pm2 startup
# Copy and run the command it prints
```

---

### Step J — Verify Everything Works

1. Open `http://<your-new-ec2-ip>:3000` in browser
2. Log in as `admin`
3. Submit a text entry → should appear in Vault ✅
4. Upload a file → should appear in Vault and be viewable ✅
5. Go to DB Health (admin) → should show RDS stats and S3 usage ✅
6. Check S3 bucket in AWS Console → should contain the uploaded file ✅

---

## QUICK REFERENCE — What Goes Where

```
Your Laptop
└── Project code (GitHub repo)
└── InnoKey.pem (SSH key)
└── .env (credentials — never commit)
└── companydb_backup.sql (DB backup — keep safe)

AWS EC2 (Ubuntu server in Mumbai)
└── Node.js app running via PM2
└── Reads .env for credentials
└── Connects to RDS for data
└── Uploads files to S3

AWS RDS (PostgreSQL database)
└── users table (accounts, passwords)
└── session table (login sessions)
└── submissions table (all entries + S3 URLs)

AWS S3 (file storage)
└── uploads/ folder (all PDFs, images, videos, docs)
```

---

## Cost Reference

| Service | Running Cost | Stopped Cost |
|---|---|---|
| EC2 t3.micro | ~$8/month | ~$0.10/month (disk only) |
| RDS db.t3.micro | ~$12/month | ~$2.30/month (storage, auto-restarts after 7 days) |
| S3 (per GB) | ~$0.025/GB/month | Same (data just sits there) |

**Total running: ~$20/month (~₹1,700)**
**Total stopped: ~$2.40/month (~₹200) — but RDS keeps restarting every 7 days**
**Total deleted: $0** (only S3 if you kept files: ~₹20/month for 1GB)

---

## Checklist Before Teardown

- [ ] Downloaded `companydb_backup.sql` to laptop
- [ ] Noted what S3 files exist (optional download)
- [ ] RDS deleted
- [ ] EC2 terminated
- [ ] S3 emptied and deleted (or kept — your choice)
- [ ] IAM user deleted
- [ ] AWS billing shows $0

## Checklist Before Going Live Again

- [ ] New RDS created and endpoint noted
- [ ] New S3 bucket created with public read policy
- [ ] New IAM user created with S3FullAccess, keys noted
- [ ] New EC2 launched, IP noted, .pem downloaded
- [ ] `.env` updated with all new credentials
- [ ] App deployed to EC2 via SCP
- [ ] `npm run db:init` run on EC2
- [ ] DB backup restored (or fresh `npm run seed:admin`)
- [ ] `pm2 start` and `pm2 startup` run
- [ ] Tested login, text submission, file upload
