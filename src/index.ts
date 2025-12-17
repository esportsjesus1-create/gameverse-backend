export * from './types';
export * from './config';
export * from './utils/errors';
export * from './utils/logger';
export * from './utils/retry';

export { PostgresClient, RpcEndpointRepository, postgresClient } from './database/postgres';
export { RedisClient, redisClient } from './database/redis';

export { ProviderManager } from './providers/ProviderManager';
export { GasPriceOracle } from './services/GasPriceOracle';
export { NonceManager } from './services/NonceManager';
export { ReorgDetector } from './services/ReorgDetector';
export { SubscriptionManager } from './services/SubscriptionManager';
export { RateLimiter, createRateLimitMiddleware } from './services/RateLimiter';
export { HealthChecker } from './services/HealthChecker';
export { ChainGateway, chainGateway } from './services/ChainGateway';

export { createApp, createWebSocketServer, startServer, stopServer } from './server';

import { startServer } from './server';
import { logger } from './utils/logger';

if (require.main === module) {
  startServer()
    .then(({ server }) => {
      logger.info('GameVerse Chain Gateway is running');

      const shutdown = async () => {
        logger.info('Received shutdown signal');
        server.close(() => {
          logger.info('Server closed');
          process.exit(0);
        });
      };

      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch((error) => {
      logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    });
}
