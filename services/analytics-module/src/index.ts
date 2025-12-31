/**
 * GameVerse Analytics Module
 * Production-ready analytics service with comprehensive error handling,
 * validation, logging, caching, and security features.
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import routes from './routes';
import {
  rateLimiter,
  validateRequestId,
  errorHandler,
  notFoundHandler,
  setupUncaughtExceptionHandler,
} from './middleware';
import { logger, LogEventType } from './utils/logger';
import { cacheService } from './services';

// Setup uncaught exception handlers
setupUncaughtExceptionHandler();

// Create Express application
const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true,
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message: string) => {
      logger.http(LogEventType.API_CALL, message.trim());
    },
  },
}));

// Request ID middleware
app.use(validateRequestId);

// Rate limiting
app.use(rateLimiter());

// Health check endpoints
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });
});

app.get('/ready', (_req, res) => {
  const cacheStats = cacheService.getStats();
  res.json({
    success: true,
    data: {
      status: 'ready',
      cache: {
        enabled: config.CACHE_ENABLED,
        hitRate: cacheStats.hitRate,
        size: cacheStats.size,
      },
    },
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = (): void => {
  const server = app.listen(config.PORT, config.HOST, () => {
    logger.logServiceLifecycle('started', 'GameVerse Analytics Module', {
      port: config.PORT,
      host: config.HOST,
      environment: config.NODE_ENV,
    });
  });

  // Graceful shutdown
  const shutdown = (): void => {
    logger.logServiceLifecycle('stopped', 'GameVerse Analytics Module', {
      reason: 'shutdown signal received',
    });

    server.close(() => {
      cacheService.stop();
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

// Export for testing
export { app, startServer };

// Start server if running directly
if (require.main === module) {
  startServer();
}
