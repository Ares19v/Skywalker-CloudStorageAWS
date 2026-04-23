# CompanyDB — HTTPS & Remote Access Guide

> **Goal**: Let employees access CompanyDB from home over the internet, securely (HTTPS), for free.

---

## The Free Stack

| Component | What it does | Cost |
|---|---|---|
| **DuckDNS** | Free subdomain (e.g. `innothoughts.duckdns.org`) | FREE |
| **Nginx** | Reverse proxy: routes port 80/443 → your Node app on 3000 | FREE |
| **Let's Encrypt** | Free SSL certificate (auto-renews every 90 days) | FREE |
| **Certbot** | Handles Let's Encrypt automatically | FREE |

---

## Step 1 — Get a Free Domain (DuckDNS)

1. Go to [https://www.duckdns.org](https://www.duckdns.org)
2. Sign in with Google
3. Create a subdomain, e.g. `innothoughts` → you get `innothoughts.duckdns.org`
4. Find your **public IP** at [https://whatismyip.com](https://whatismyip.com)
5. Enter your public IP in DuckDNS for your domain and click **Update IP**

> ⚠️ If your home/office internet IP changes (most ISPs do this), you need to update DuckDNS. 
> Run this on a schedule (Windows Task Scheduler, every 5 min) to auto-update:
```
curl "https://www.duckdns.org/update?domains=innothoughts&token=YOUR_TOKEN&ip="
```

---

## Step 2 — Open Your Router/Firewall

On your home/office router:
1. Log into the admin panel (usually `192.168.1.1`)
2. Find **Port Forwarding**
3. Add two rules pointing to your HP Omen's local IP:
   - External port **80** → Internal IP:port **80** (HTTP, needed for cert verification)
   - External port **443** → Internal IP:port **443** (HTTPS)
4. Keep port **3000 closed** externally (only Nginx will reach it internally)

---

## Step 3 — Install Nginx on Windows

Download **Nginx for Windows** from [http://nginx.org/en/download.html](http://nginx.org/en/download.html) (nginx/Windows-stable zip).

Extract to `C:\nginx`.

Replace the contents of `C:\nginx\conf\nginx.conf` with:

```nginx
events {}

http {
    # Redirect HTTP → HTTPS
    server {
        listen 80;
        server_name innothoughts.duckdns.org;
        location /.well-known/acme-challenge/ { root C:/nginx/html; }
        location / { return 301 https://$host$request_uri; }
    }

    # HTTPS → CompanyDB on 3000
    server {
        listen 443 ssl;
        server_name innothoughts.duckdns.org;

        ssl_certificate     C:/certbot/live/innothoughts.duckdns.org/fullchain.pem;
        ssl_certificate_key C:/certbot/live/innothoughts.duckdns.org/privkey.pem;

        # Security headers
        add_header Strict-Transport-Security "max-age=31536000" always;
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;

        # File upload size (match your .env MAX_FILE_SIZE_MB)
        client_max_body_size 110m;

        location / {
            proxy_pass         http://127.0.0.1:3000;
            proxy_http_version 1.1;
            proxy_set_header   Host $host;
            proxy_set_header   X-Real-IP $remote_addr;
            proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header   X-Forwarded-Proto $scheme;
        }
    }
}
```

Start Nginx:
```powershell
cd C:\nginx
.\nginx.exe
```

---

## Step 4 — Get SSL Certificate (Certbot)

1. Download **Certbot for Windows** from [https://certbot.eff.org](https://certbot.eff.org/instructions?os=windows)
2. Install it
3. Run in PowerShell (as Administrator):
```powershell
certbot certonly --webroot -w C:\nginx\html -d innothoughts.duckdns.org
```
4. Follow the prompts — it will place certs in `C:\certbot\live\innothoughts.duckdns.org\`
5. Reload Nginx: `C:\nginx\nginx.exe -s reload`

**Auto-renewal** (run this command once — Windows Task Scheduler picks it up):
```powershell
certbot renew --quiet
```
Or manually renew with: `certbot renew`

---

## Step 5 — Update server.js for HTTPS

In `server.js`, change the session cookie setting:
```js
// Find this line and change false → true:
secure: true,   // ← enable when behind HTTPS proxy
```

Also add this line at the top of `server.js` (trust Nginx's X-Forwarded-Proto):
```js
app.set('trust proxy', 1);
```

---

## Step 6 — Start Everything

```powershell
# Terminal 1: Start CompanyDB
cd "C:\Users\Devansh Tyagi\Desktop\Projects\CompanyDB"
node server.js

# Start Nginx (if not running)
C:\nginx\nginx.exe
```

Your team can now access: **https://innothoughts.duckdns.org**

---

## Security Checklist

- [ ] `ADMIN_LOCK=false` in `.env` (flip to `true` to restrict deletes to admin only)
- [ ] Strong `SESSION_SECRET` in `.env` (change the default!)
- [ ] Windows Firewall: block port 3000 externally, allow 80 and 443
- [ ] Nginx is running
- [ ] SSL cert is valid (check at [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/))

---

## Quick Reference — All Commands

```powershell
# Start the app
node server.js

# Initialize DB (run once after setting DB password)
npm run db:init

# Create your admin account (run once)
npm run seed:admin

# Reload Nginx after config changes
C:\nginx\nginx.exe -s reload

# Renew SSL cert
certbot renew
```
