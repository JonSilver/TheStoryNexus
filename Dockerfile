FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application (frontend + backend)
RUN npm run build

# Sanity check
RUN test -f /app/dist/server/server/index.js || (echo "Build output missing" && exit 1)

# Production stage
FROM node:22-alpine

WORKDIR /app

# Install build dependencies for native modules (needed for better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/db/migrations ./dist/server/server/db/migrations

# Create data directory for SQLite with correct ownership
RUN mkdir -p /app/data && chown node:node /app/data
VOLUME ["/app/data"]

# Volume validation entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint && chmod +x /usr/local/bin/entrypoint

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/storynexus.db

# User set via docker-compose (PUID/PGID env vars, defaults to 1000:1000)
ENTRYPOINT ["entrypoint"]
CMD ["node", "dist/server/server/index.js"]
