# ─── Stage 1: Dependency installer ─────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

# Only copy manifests first — this layer is cached unless package*.json changes
COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev

# ─── Stage 2: Runtime image ──────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Install dumb-init for proper signal handling (PID 1 problem)
RUN apk add --no-cache dumb-init

WORKDIR /usr/src/app

# Copy pre-built deps from stage 1
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy application source
COPY . .

# Expose the application port
EXPOSE 3000

# Run as non-root user for security
USER node

# Use dumb-init as PID 1 so SIGTERM is forwarded correctly to Node
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
