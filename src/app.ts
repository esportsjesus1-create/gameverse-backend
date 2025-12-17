import express, { Application } from 'express';
import morgan from 'morgan';
import {
  helmetMiddleware,
  corsMiddleware,
  compressionMiddleware,
  rateLimitMiddleware,
  requestIdMiddleware,
  requestLoggerMiddleware,
  responseWrapper,
  errorHandler,
  notFoundHandler,
} from './middleware';
import routes from './routes';
import { config } from './config';
import logger from './utils/logger';

export function createApp(): Application {
  const app = express();

  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(compressionMiddleware);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);
  app.use(responseWrapper);

  if (config.nodeEnv !== 'test') {
    app.use(
      morgan('combined', {
        stream: { write: (message: string) => logger.info(message.trim()) },
      })
    );
  }

  app.use('/api', rateLimitMiddleware);

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
