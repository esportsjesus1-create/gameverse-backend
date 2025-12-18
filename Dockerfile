# GameVerse N1.38 Room Instance Service
# Multi-stage build for optimized production image

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gameverse -u 1001

# Copy package files and install production dependencies only
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy migrations
COPY src/migrations ./dist/migrations

# Set ownership to non-root user
RUN chown -R gameverse:nodejs /app

# Switch to non-root user
USER gameverse

# Expose port
EXPOSE 3038

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3038/health || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3038

# Start the application
CMD ["node", "dist/index.js"]
