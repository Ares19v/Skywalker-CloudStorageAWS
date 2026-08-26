# Skywalker — Space Management & Dependency Cleanup

> Use this file when you need to free up disk space.
> These commands remove all installed dependencies while keeping your source code intact.
> Re-installation takes ~60 seconds on a normal connection.

---

## UNINSTALL (Free Up Space)

### Windows (PowerShell)
```powershell
cd "<path-to-project>"

# Remove all installed packages (~120MB freed)
Remove-Item -Recurse -Force node_modules
```

### macOS / Linux (Terminal)
```bash
cd ~/Desktop/Projects/Skywalker
rm -rf node_modules
```

---

## REINSTALL (Get Back to Work)

```bash
# All dependencies (production + dev)
npm install

# Production only (no nodemon, ~10MB smaller)
npm install --omit=dev
```

---

## FULL SETUP FROM SCRATCH

```bash
# 1. Install packages
npm install

# 2. Copy .env.example to .env and fill in credentials
# 3. Create DB tables
npm run db:init

# 4. Create admin account (interactive)
npm run seed:admin

# 5. Start the server
npm start
```

---

## DOCKER CLEANUP

```bash
# Stop containers and remove volumes
npm run docker:down

# Remove built images
docker rmi skywalker-app skywalker-seeder

# Nuclear: wipe all unused Docker objects
docker system prune -a --volumes
```

---

## DISK SPACE REFERENCE

| What | Size |
| :--- | :--- |
| `node_modules/` | ~120 MB |
| Source code only | ~2 MB |
| Docker images | ~1.2 GB |

**TL;DR: Delete `node_modules/` when done. Run `npm install` when you return.**
