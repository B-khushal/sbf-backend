# ============================================
# SBF Florist Backend — Production Dockerfile
# ============================================
# Multi-stage build for optimized image size
# Node.js 20 Alpine | Express + MongoDB
# ============================================

# ── Stage 1: Dependencies ────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files for optimal Docker layer caching
COPY package.json package-lock.json ./

# Install production dependencies only (ci ensures lockfile integrity)
RUN npm ci --omit=dev

# ── Stage 2: Production ─────────────────────
FROM node:20-alpine AS production

# Add labels for image metadata
LABEL maintainer="B-khushal"
LABEL description="SBF Florist Backend API"
LABEL version="1.0.2"

# Install curl for healthcheck and dumb-init for proper signal handling
RUN apk add --no-cache curl dumb-init

# Set production environment
ENV NODE_ENV=production

WORKDIR /app

# Copy production dependencies from deps stage
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
COPY routes/ ./routes/
COPY scripts/ ./scripts/
COPY services/ ./services/
COPY utils/ ./utils/
COPY assets/ ./assets/

# Create uploads directory with correct permissions
RUN mkdir -p uploads && chown -R node:node /app

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