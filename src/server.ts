import express, { Request, Response, NextFunction } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { ChainId, RpcRequest, SubscriptionType } from './types';
import { chainGateway } from './services/ChainGateway';
import { createRateLimitMiddleware, RateLimiter } from './services/RateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { config, isValidChainId, getChainName } from './config';
import { logger } from './utils/logger';
import { ValidationError } from './utils/errors';

export function createApp(): express.Application {
  const app = express();

  app.use(express.json({ limit: '1mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.debug('Request completed', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration
      });
    });
    next();
  });

  const rateLimiter = new RateLimiter();
  rateLimiter.start();
  app.use(createRateLimitMiddleware(rateLimiter));

  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const health = await chainGateway.getHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    try {
      const health = await chainGateway.getHealth();
      if (health.status === 'unhealthy') {
        res.status(503).json({ status: 'not ready', details: health });
      } else {
        res.status(200).json({ status: 'ready' });
      }
    } catch (error) {
      res.status(503).json({ status: 'not ready', error: (error as Error).message });
    }
  });

  app.post('/rpc/:chainId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const rpcRequest: RpcRequest = req.body;
      if (!rpcRequest.method) {
        throw new ValidationError('Missing method in RPC request');
      }

      const clientId = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0] || 'unknown';
      const response = await chainGateway.executeRpcRequest(chainId, rpcRequest, clientId);

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  app.get('/gas/:chainId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const gasPrice = await chainGateway.getGasPrice(chainId);

      res.json({
        chainId,
        chainName: getChainName(chainId),
        gasPrice: {
          slow: gasPrice.slow.toString(),
          standard: gasPrice.standard.toString(),
          fast: gasPrice.fast.toString(),
          instant: gasPrice.instant.toString(),
          baseFee: gasPrice.baseFee?.toString(),
          maxPriorityFee: gasPrice.maxPriorityFee?.toString()
        },
        timestamp: gasPrice.timestamp.toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/gas/:chainId/refresh', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const gasPrice = await chainGateway.refreshGasPrice(chainId);

      res.json({
        chainId,
        chainName: getChainName(chainId),
        gasPrice: {
          slow: gasPrice.slow.toString(),
          standard: gasPrice.standard.toString(),
          fast: gasPrice.fast.toString(),
          instant: gasPrice.instant.toString(),
          baseFee: gasPrice.baseFee?.toString(),
          maxPriorityFee: gasPrice.maxPriorityFee?.toString()
        },
        timestamp: gasPrice.timestamp.toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/gas/:chainId/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const limit = parseInt(req.query.limit as string, 10) || 50;
      const history = await chainGateway.getGasPriceHistory(chainId, limit);

      res.json({
        chainId,
        chainName: getChainName(chainId),
        history: history.map((h) => ({
          price: h.price.toString(),
          timestamp: h.timestamp.toISOString()
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/nonce/:chainId/:address', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const { address } = req.params;
      const nonce = await chainGateway.getNonce(chainId, address);

      res.json({
        chainId,
        address,
        nonce
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/nonce/:chainId/:address/increment', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const { address } = req.params;
      const nonce = await chainGateway.incrementNonce(chainId, address);

      res.json({
        chainId,
        address,
        nonce
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/nonce/:chainId/:address/reset', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const { address } = req.params;
      await chainGateway.resetNonce(chainId, address);

      res.json({
        chainId,
        address,
        message: 'Nonce reset successfully'
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/nonce/:chainId/:address/sync', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const { address } = req.params;
      const nonce = await chainGateway.syncNonce(chainId, address);

      res.json({
        chainId,
        address,
        nonce,
        message: 'Nonce synced with on-chain value'
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/reorg/:chainId/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const limit = parseInt(req.query.limit as string, 10) || 10;
      const history = await chainGateway.getReorgHistory(chainId, limit);

      res.json({
        chainId,
        chainName: getChainName(chainId),
        reorgs: history.map((r) => ({
          oldBlockNumber: r.oldBlockNumber,
          oldBlockHash: r.oldBlockHash,
          newBlockNumber: r.newBlockNumber,
          newBlockHash: r.newBlockHash,
          depth: r.depth,
          timestamp: r.timestamp.toISOString()
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/providers/:chainId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chainId = parseInt(req.params.chainId, 10) as ChainId;
      if (!isValidChainId(chainId)) {
        throw new ValidationError(`Invalid chain ID: ${req.params.chainId}`);
      }

      const health = chainGateway.getProviderHealth(chainId);

      res.json({
        chainId,
        chainName: getChainName(chainId),
        providers: health.map((h) => ({
          endpointId: h.endpointId,
          status: h.status,
          latency: h.latency,
          blockHeight: h.blockHeight,
          errorCount: h.errorCount,
          successCount: h.successCount,
          lastCheck: h.lastCheck.toISOString()
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/providers', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const allHealth = chainGateway.getAllProviderHealth();
      const result: Record<string, unknown[]> = {};

      for (const [chainId, healths] of allHealth.entries()) {
        result[getChainName(chainId)] = healths.map((h) => ({
          endpointId: h.endpointId,
          status: h.status,
          latency: h.latency,
          blockHeight: h.blockHeight,
          lastCheck: h.lastCheck.toISOString()
        }));
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get('/subscriptions', (_req: Request, res: Response) => {
    const subscriptions = chainGateway.getActiveSubscriptions();
    res.json({
      count: subscriptions.length,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        chainId: s.chainId,
        type: s.type
      }))
    });
  });

  app.get('/chains', (_req: Request, res: Response) => {
    const chains = [
      { chainId: ChainId.ETHEREUM, name: 'Ethereum Mainnet' },
      { chainId: ChainId.POLYGON, name: 'Polygon' },
      { chainId: ChainId.BSC, name: 'BNB Smart Chain' },
      { chainId: ChainId.ARBITRUM, name: 'Arbitrum One' },
      { chainId: ChainId.OPTIMISM, name: 'Optimism' }
    ];
    res.json({ chains });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function createWebSocketServer(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = req.socket.remoteAddress || 'unknown';
    logger.info('WebSocket client connected', { clientId });

    const subscriptionIds: string[] = [];

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'subscribe') {
          const chainId = message.chainId as ChainId;
          if (!isValidChainId(chainId)) {
            ws.send(JSON.stringify({ error: 'Invalid chain ID' }));
            return;
          }

          const subscriptionId = await chainGateway.subscribe({
            id: message.id,
            chainId,
            type: message.subscriptionType as SubscriptionType || SubscriptionType.NEW_BLOCKS,
            filter: message.filter,
            callback: (eventData) => {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'event',
                  subscriptionId,
                  chainId,
                  data: eventData
                }));
              }
            }
          });

          subscriptionIds.push(subscriptionId);
          ws.send(JSON.stringify({
            type: 'subscribed',
            subscriptionId,
            chainId
          }));
        } else if (message.type === 'unsubscribe') {
          const success = await chainGateway.unsubscribe(message.subscriptionId);
          const index = subscriptionIds.indexOf(message.subscriptionId);
          if (index > -1) {
            subscriptionIds.splice(index, 1);
          }
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            subscriptionId: message.subscriptionId,
            success
          }));
        } else if (message.type === 'rpc') {
          const chainId = message.chainId as ChainId;
          const response = await chainGateway.executeRpcRequest(chainId, message.request, clientId);
          ws.send(JSON.stringify({
            type: 'rpcResponse',
            ...response
          }));
        }
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'error',
          message: (error as Error).message
        }));
      }
    });

    ws.on('close', async () => {
      logger.info('WebSocket client disconnected', { clientId });
      for (const subId of subscriptionIds) {
        await chainGateway.unsubscribe(subId);
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { clientId, error: error.message });
    });

    ws.send(JSON.stringify({ type: 'connected', message: 'Connected to GameVerse Chain Gateway' }));
  });

  return wss;
}

export async function startServer(): Promise<{ app: express.Application; server: Server; wss: WebSocketServer }> {
  await chainGateway.initialize();

  const app = createApp();
  const server = createServer(app);
  const wss = createWebSocketServer(server);

  return new Promise((resolve) => {
    server.listen(config.server.port, config.server.host, () => {
      logger.info(`Server started on ${config.server.host}:${config.server.port}`);
      resolve({ app, server, wss });
    });
  });
}

export async function stopServer(server: Server, wss: WebSocketServer): Promise<void> {
  return new Promise((resolve) => {
    wss.close(() => {
      server.close(async () => {
        await chainGateway.shutdown();
        resolve();
      });
    });
  });
}
