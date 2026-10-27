# ============================================
# SBF Florist Backend — Production Dockerfile
# ============================================
# Node.js 20 Debian Slim with Native Prisma, Sharp & PhantomJS support
# ============================================

FROM node:20-slim

WORKDIR /app

# Install system dependencies
# - dumb-init: PID 1 signal handler & zombie reaper
# - openssl: Prisma query engine
# - libfontconfig1 & libfreetype6: PDF generation
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    openssl \
    libfontconfig1 \
    libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Copy package definitions and prisma schema first for Docker layer caching
COPY package.json package-lock.json ./
COPY prisma/ ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci --omit=dev && npx prisma generate

# Copy application source code
COPY . .

# Ensure upload/scratch directories exist with proper node permissions
RUN mkdir -p uploads scratch && chown -R node:node /app

# Switch to non-root user
USER node

# Expose backend port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node healthcheck.js

# Entrypoint with dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]