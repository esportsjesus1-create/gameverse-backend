import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from 'http';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { webSocketHandler } from './websocket/WebSocketHandler';
import { monitoringService } from './services';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startServer(app: Application, port: number): Server {
  const server = app.listen(port, () => {
    logger.info(`Telemetry service started on port ${port}`);
  });

  webSocketHandler.initialize(server);
  monitoringService.startMonitoring();

  return server;
}

export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    monitoringService.stopMonitoring();
    webSocketHandler.close();
    
    server.close((err) => {
      if (err !== undefined && err !== null) {
        reject(err);
      } else {
        logger.info('Telemetry service stopped');
        resolve();
      }
    });
  });
}
