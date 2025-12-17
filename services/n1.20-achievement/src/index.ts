import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { closePool } from './config/database.js';
import { closeRedis } from './config/redis.js';

const app = express();

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (config.nodeEnv !== 'test') {
  app.use(morgan('combined'));
}

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.info(`Achievement service started on port ${config.port}`);
  console.info(`Environment: ${config.nodeEnv}`);
});

function gracefulShutdown(signal: string): void {
  console.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    console.info('HTTP server closed');
    
    Promise.all([
      closePool(),
      closeRedis()
    ])
      .then(() => {
        console.info('Database and Redis connections closed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Error during shutdown:', error);
        process.exit(1);
      });
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });

export { app };
