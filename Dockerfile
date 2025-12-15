# ---------- deps ----------
FROM node:22-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Sanity check
RUN test -f /app/dist/server/server/index.js || (echo "Build output missing" && exit 1)

# ---------- runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install build dependencies for native modules (needed for npm install)
RUN apk add --no-cache python3 make g++

# Production deps only
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# App artefacts
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/db/migrations ./dist/server/server/db/migrations

# Data volume
RUN mkdir -p /app/data
VOLUME ["/app/data"]

# Volume validation entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint && chmod +x /usr/local/bin/entrypoint

USER node
EXPOSE 3000

ENV DATABASE_PATH=/app/data/storynexus.db

ENTRYPOINT ["entrypoint"]
CMD ["node", "dist/server/server/index.js"]
