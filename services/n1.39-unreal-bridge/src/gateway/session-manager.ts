import { v4 as uuidv4 } from 'uuid';
import { LRUCache } from 'lru-cache';
import { SessionData, ClientInfo, ConnectionState } from '../types';
import { SessionError, ErrorCode } from '../utils/errors';
import pino from 'pino';

export interface SessionManagerConfig {
  maxSessions: number;
  sessionTTL: number;
  reconnectWindow: number;
}

export class SessionManager {
  private readonly sessions: Map<string, SessionData>;
  private readonly clientToSession: Map<string, string>;
  private readonly reconnectTokens: LRUCache<string, string>;
  private readonly config: SessionManagerConfig;
  private readonly logger: pino.Logger;

  constructor(config: SessionManagerConfig, logger: pino.Logger) {
    this.config = config;
    this.logger = logger;
    this.sessions = new Map();
    this.clientToSession = new Map();
    this.reconnectTokens = new LRUCache({
      max: config.maxSessions,
      ttl: config.reconnectWindow
    });
  }

  createSession(clientInfo: ClientInfo): SessionData {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new SessionError(
        ErrorCode.CONNECTION_LIMIT_REACHED,
        'Maximum session limit reached'
      );
    }

    const sessionId = uuidv4();
    const reconnectToken = uuidv4();
    const now = Date.now();

    const session: SessionData = {
      sessionId,
      clientId: clientInfo.clientId,
      clientInfo,
      connectionState: 'CONNECTING',
      connectedAt: now,
      lastHeartbeat: now,
      latency: 0,
      reconnectToken,
      metadata: {}
    };

    this.sessions.set(sessionId, session);
    this.clientToSession.set(clientInfo.clientId, sessionId);
    this.reconnectTokens.set(reconnectToken, sessionId);

    this.logger.info({ sessionId, clientId: clientInfo.clientId }, 'Session created');

    return session;
  }

  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByClientId(clientId: string): SessionData | undefined {
    const sessionId = this.clientToSession.get(clientId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  getSessionByReconnectToken(token: string): SessionData | undefined {
    const sessionId = this.reconnectTokens.get(token);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  updateSessionState(sessionId: string, state: ConnectionState): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(ErrorCode.SESSION_NOT_FOUND, `Session not found: ${sessionId}`);
    }

    session.connectionState = state;
    this.logger.debug({ sessionId, state }, 'Session state updated');
  }

  updateHeartbeat(sessionId: string, latency?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(ErrorCode.SESSION_NOT_FOUND, `Session not found: ${sessionId}`);
    }

    session.lastHeartbeat = Date.now();
    if (latency !== undefined) {
      session.latency = latency;
    }
  }

  setSessionMetadata(sessionId: string, key: string, value: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(ErrorCode.SESSION_NOT_FOUND, `Session not found: ${sessionId}`);
    }

    session.metadata[key] = value;
  }

  removeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    this.sessions.delete(sessionId);
    this.clientToSession.delete(session.clientId);
    this.reconnectTokens.delete(session.reconnectToken);

    this.logger.info({ sessionId, clientId: session.clientId }, 'Session removed');

    return true;
  }

  getAllSessions(): SessionData[] {
    return Array.from(this.sessions.values());
  }

  getActiveSessions(): SessionData[] {
    return this.getAllSessions().filter(
      s => s.connectionState === 'CONNECTED' || s.connectionState === 'AUTHENTICATED'
    );
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getActiveSessionCount(): number {
    return this.getActiveSessions().length;
  }

  cleanupStaleSessions(heartbeatTimeout: number): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastHeartbeat > heartbeatTimeout) {
        this.removeSession(sessionId);
        cleanedCount++;
        this.logger.warn({ sessionId }, 'Stale session cleaned up');
      }
    }

    return cleanedCount;
  }

  reconnectSession(reconnectToken: string, clientInfo: ClientInfo): SessionData {
    const existingSession = this.getSessionByReconnectToken(reconnectToken);
    
    if (!existingSession) {
      throw new SessionError(
        ErrorCode.SESSION_NOT_FOUND,
        'Invalid reconnect token or session expired'
      );
    }

    if (existingSession.clientId !== clientInfo.clientId) {
      throw new SessionError(
        ErrorCode.AUTHENTICATION_FAILED,
        'Client ID mismatch during reconnection'
      );
    }

    const newReconnectToken = uuidv4();
    existingSession.reconnectToken = newReconnectToken;
    existingSession.connectionState = 'CONNECTING';
    existingSession.lastHeartbeat = Date.now();
    existingSession.clientInfo = clientInfo;

    this.reconnectTokens.delete(reconnectToken);
    this.reconnectTokens.set(newReconnectToken, existingSession.sessionId);

    this.logger.info(
      { sessionId: existingSession.sessionId, clientId: clientInfo.clientId },
      'Session reconnected'
    );

    return existingSession;
  }
}
