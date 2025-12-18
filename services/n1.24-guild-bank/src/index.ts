import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config, validateConfig } from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware';
import { logger } from './utils/logger';

// Validate configuration
validateConfig();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'guild-bank',
    version: '1.24.0',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/v1/guild-bank', routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(config.port, () => {
    logger.info(`Guild Bank service started on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}

export { app };
