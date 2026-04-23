# CompanyDB — Quick Command Reference

## ── Local Development (on your laptop) ──────────────────────────

# Start the server
node server.js

# Start with auto-reload (no need to restart on file changes)
npm run dev

# Initialize database tables (run once after setting up .env)
npm run db:init

# Create the admin account (run once after db:init)
npm run seed:admin

# Install all dependencies (after cloning fresh)
npm install


## ── EC2 Server (SSH in first) ────────────────────────────────────

# SSH into EC2
ssh -i "InnoKey.pem" ubuntu@<your-ec2-ip>

# Check app status
pm2 status

# View live logs (Ctrl+C to exit)
pm2 logs companydb

# Restart app (after deploying new code)
pm2 restart companydb

# Stop app
pm2 stop companydb

# Start app (if stopped)
pm2 start companydb

# View all PM2 processes
pm2 list


## ── Deploying Code Updates to EC2 ───────────────────────────────
# Run from PowerShell on your laptop

# 1. Create clean copy (no node_modules / pem files)
robocopy "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB" "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB_deploy" /E /XD node_modules uploads /XF "*.pem" "*.log"

# 2. Upload to EC2
scp -i "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB\InnoKey.pem" -r "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB_deploy" ubuntu@<your-ec2-ip>:~/companydb

# 3. Clean up temp folder
Remove-Item -Recurse -Force "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB_deploy"

# 4. SSH in and restart
ssh -i "InnoKey.pem" ubuntu@<your-ec2-ip>
pm2 restart companydb


## ── Database ─────────────────────────────────────────────────────

# Re-run schema (safe — uses CREATE IF NOT EXISTS)
npm run db:init

# Reset admin password
npm run seed:admin


## ── AWS S3 ───────────────────────────────────────────────────────

# Files are automatically uploaded to S3 on submission
# View them in: AWS Console → S3 → your-bucket → uploads/

# Free tier limit: 5GB (tracked on DB Health page)


## ── Monitoring ───────────────────────────────────────────────────

# View DB health, S3 usage, connection pool → login as admin and visit:
# http://<your-ec2-ip>:3000/health

# PM2 web monitor (optional)
pm2 monitor
