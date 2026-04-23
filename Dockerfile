FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies first (cached layer — only re-runs if package.json changes)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the application
COPY . .

# Expose the application port
EXPOSE 3000

# Run as non-root user for security
USER node

# Start the application
CMD ["node", "server.js"]
