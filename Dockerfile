# ── Build stage ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json knexfile.ts ./
COPY src/ ./src/

RUN npx tsc

# ── Production stage ──
FROM node:20-alpine
WORKDIR /app

# Install pg_dump for backups
RUN apk add --no-cache postgresql-client ffmpeg font-dejavu python3 \
    && wget -qO /usr/local/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/api/views ./dist/api/views

# Create session and backup directories
RUN mkdir -p /app/sessions /app/backups

ENV NODE_ENV=production
ENV WA_SESSION_DIR=/app/sessions
ENV BACKUP_DIR=/app/backups

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/login', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
