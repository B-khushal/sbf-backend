# ============================================
# SBF Florist Backend — Production Dockerfile
# ============================================
# Multi-stage build for optimized image size
# Node.js 20 Alpine | Express + MongoDB
# ============================================

# ── Stage 1: Dependencies ────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install openssl and libc6-compat for Prisma binary generation on Alpine
RUN apk add --no-cache openssl libc6-compat

# Copy package files and prisma schema
COPY package.json package-lock.json ./
COPY prisma/ ./prisma/

# Install production dependencies and generate Prisma client
RUN npm ci --omit=dev && npx prisma generate

# ── Stage 2: Production ─────────────────────
FROM node:20-alpine AS production

# Add labels for image metadata
LABEL maintainer="B-khushal"
LABEL description="SBF Florist Backend API"
LABEL version="1.0.2"

# Install curl for healthcheck, dumb-init, openssl for prisma, fontconfig, gcompat, libc6-compat and libstdc++ for phantomjs PDF rendering on Alpine
RUN apk add --no-cache curl dumb-init openssl fontconfig gcompat libc6-compat libstdc++

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /app

# Copy production dependencies from deps stage (includes generated @prisma/client)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source code
COPY package.json ./
COPY server.js ./
COPY healthcheck.js ./
COPY config/ ./config/
COPY controllers/ ./controllers/
COPY middleware/ ./middleware/
COPY models/ ./models/
COPY modules/ ./modules/
COPY prisma/ ./prisma/
COPY routes/ ./routes/
COPY scripts/ ./scripts/
COPY services/ ./services/
COPY utils/ ./utils/
COPY assets/ ./assets/

# Create uploads and scratch directory with correct permissions
RUN mkdir -p uploads scratch && chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose the API port
EXPOSE 5000

# Healthcheck — hits the /health endpoint every 30s
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init to handle PID 1 and signal forwarding properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]