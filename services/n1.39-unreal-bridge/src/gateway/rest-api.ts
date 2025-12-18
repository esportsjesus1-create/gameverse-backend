import express, { Express, Request, Response, NextFunction } from 'express';
import { UnrealBridgeConfig, BridgeMetrics, SessionData } from '../types';
import { SessionManager } from './session-manager';
import { UnrealBridgeError, ErrorCode, createErrorPayload } from '../utils/errors';
import pino from 'pino';

export interface RestApiDependencies {
  sessionManager: SessionManager;
  getMetrics: () => BridgeMetrics;
}

export function createRestApi(
  config: UnrealBridgeConfig,
  deps: RestApiDependencies,
  logger: pino.Logger
): Express {
  const app = express();

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (config.corsOrigins.length > 0) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      if (origin && config.corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });
  }

  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.debug({ method: req.method, path: req.path }, 'API request');
    next();
  });

  app.get(`${config.apiPath}/health`, (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      version: '1.39.0',
      service: 'unreal-bridge'
    });
  });

  app.get(`${config.apiPath}/metrics`, (_req: Request, res: Response) => {
    const metrics = deps.getMetrics();
    res.json(metrics);
  });

  app.get(`${config.apiPath}/sessions`, (_req: Request, res: Response) => {
    const sessions = deps.sessionManager.getAllSessions();
    res.json({
      total: sessions.length,
      active: deps.sessionManager.getActiveSessionCount(),
      sessions: sessions.map(sanitizeSession)
    });
  });

  app.get(`${config.apiPath}/sessions/:sessionId`, (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const session = deps.sessionManager.getSession(sessionId);

    if (!session) {
      res.status(404).json({
        error: createErrorPayload(
          new UnrealBridgeError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')
        )
      });
      return;
    }

    res.json(sanitizeSession(session));
  });

  app.delete(`${config.apiPath}/sessions/:sessionId`, (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const removed = deps.sessionManager.removeSession(sessionId);

    if (!removed) {
      res.status(404).json({
        error: createErrorPayload(
          new UnrealBridgeError(ErrorCode.SESSION_NOT_FOUND, 'Session not found')
        )
      });
      return;
    }

    res.json({ success: true, sessionId });
  });

  app.post(`${config.apiPath}/sessions/:sessionId/metadata`, (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { key, value } = req.body;

    if (!key) {
      res.status(400).json({
        error: createErrorPayload(
          new UnrealBridgeError(ErrorCode.INVALID_PAYLOAD, 'Missing key in request body')
        )
      });
      return;
    }

    try {
      deps.sessionManager.setSessionMetadata(sessionId, key, value);
      res.json({ success: true, sessionId, key });
    } catch (error) {
      if (error instanceof UnrealBridgeError) {
        res.status(404).json({ error: createErrorPayload(error) });
      } else {
        res.status(500).json({
          error: createErrorPayload(
            new UnrealBridgeError(ErrorCode.UNKNOWN, 'Internal server error')
          )
        });
      }
    }
  });

  app.get(`${config.apiPath}/config`, (_req: Request, res: Response) => {
    res.json({
      maxConnections: config.maxConnections,
      heartbeatInterval: config.heartbeatInterval,
      heartbeatTimeout: config.heartbeatTimeout,
      reconnectWindow: config.reconnectWindow,
      maxMessageSize: config.maxMessageSize,
      enableCompression: config.enableCompression,
      enableBinaryProtocol: config.enableBinaryProtocol,
      authRequired: config.authRequired
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ error: err }, 'Unhandled API error');

    if (err instanceof UnrealBridgeError) {
      res.status(400).json({ error: createErrorPayload(err) });
    } else {
      res.status(500).json({
        error: createErrorPayload(
          new UnrealBridgeError(ErrorCode.UNKNOWN, 'Internal server error')
        )
      });
    }
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: createErrorPayload(
        new UnrealBridgeError(ErrorCode.UNKNOWN, 'Endpoint not found')
      )
    });
  });

  return app;
}

function sanitizeSession(session: SessionData): Record<string, unknown> {
  return {
    sessionId: session.sessionId,
    clientId: session.clientId,
    connectionState: session.connectionState,
    connectedAt: session.connectedAt,
    lastHeartbeat: session.lastHeartbeat,
    latency: session.latency,
    clientInfo: {
      unrealVersion: session.clientInfo.unrealVersion,
      platform: session.clientInfo.platform,
      buildVersion: session.clientInfo.buildVersion
    },
    metadata: session.metadata
  };
}
