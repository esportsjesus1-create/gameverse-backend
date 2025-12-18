import { SessionManager } from '../../src/gateway/session-manager';
import { testLogger, createMockClientInfo } from '../setup';
import { ErrorCode } from '../../src/utils/errors';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(
      {
        maxSessions: 100,
        sessionTTL: 60000,
        reconnectWindow: 300000
      },
      testLogger
    );
  });

  describe('createSession', () => {
    it('should create a new session with valid client info', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);

      expect(session).toBeDefined();
      expect(session.clientId).toBe(clientInfo.clientId);
      expect(session.connectionState).toBe('CONNECTING');
      expect(session.reconnectToken).toBeDefined();
    });

    it('should throw error when max sessions reached', () => {
      const limitedManager = new SessionManager(
        { maxSessions: 1, sessionTTL: 60000, reconnectWindow: 300000 },
        testLogger
      );

      const clientInfo1 = createMockClientInfo();
      limitedManager.createSession(clientInfo1);

      const clientInfo2 = { ...createMockClientInfo(), clientId: '550e8400-e29b-41d4-a716-446655440099' };
      
      expect(() => limitedManager.createSession(clientInfo2)).toThrow();
    });
  });

  describe('getSession', () => {
    it('should return session by sessionId', () => {
      const clientInfo = createMockClientInfo();
      const created = sessionManager.createSession(clientInfo);
      
      const retrieved = sessionManager.getSession(created.sessionId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
    });

    it('should return undefined for non-existent session', () => {
      const result = sessionManager.getSession('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getSessionByClientId', () => {
    it('should return session by clientId', () => {
      const clientInfo = createMockClientInfo();
      const created = sessionManager.createSession(clientInfo);
      
      const retrieved = sessionManager.getSessionByClientId(clientInfo.clientId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.clientId).toBe(clientInfo.clientId);
    });

    it('should return undefined for non-existent clientId', () => {
      const result = sessionManager.getSessionByClientId('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getSessionByReconnectToken', () => {
    it('should return session by reconnect token', () => {
      const clientInfo = createMockClientInfo();
      const created = sessionManager.createSession(clientInfo);
      
      const retrieved = sessionManager.getSessionByReconnectToken(created.reconnectToken);
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.sessionId).toBe(created.sessionId);
    });

    it('should return undefined for invalid token', () => {
      const result = sessionManager.getSessionByReconnectToken('invalid-token');
      expect(result).toBeUndefined();
    });
  });

  describe('updateSessionState', () => {
    it('should update session state', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      
      sessionManager.updateSessionState(session.sessionId, 'CONNECTED');
      
      const updated = sessionManager.getSession(session.sessionId);
      expect(updated?.connectionState).toBe('CONNECTED');
    });

    it('should throw error for non-existent session', () => {
      expect(() => sessionManager.updateSessionState('non-existent', 'CONNECTED')).toThrow();
    });
  });

  describe('updateHeartbeat', () => {
    it('should update heartbeat timestamp and latency', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      const originalHeartbeat = session.lastHeartbeat;
      
      jest.advanceTimersByTime(1000);
      sessionManager.updateHeartbeat(session.sessionId, 100);
      
      const updated = sessionManager.getSession(session.sessionId);
      expect(updated?.lastHeartbeat).toBeGreaterThan(originalHeartbeat);
      expect(updated?.latency).toBe(100);
    });

    it('should throw error for non-existent session', () => {
      expect(() => sessionManager.updateHeartbeat('non-existent', 50)).toThrow();
    });
  });

  describe('setSessionMetadata', () => {
    it('should set session metadata', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      
      sessionManager.setSessionMetadata(session.sessionId, 'customKey', 'customValue');
      
      const updated = sessionManager.getSession(session.sessionId);
      expect(updated?.metadata.customKey).toBe('customValue');
    });

    it('should throw error for non-existent session', () => {
      expect(() => sessionManager.setSessionMetadata('non-existent', 'key', 'value')).toThrow();
    });
  });

  describe('removeSession', () => {
    it('should remove existing session', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      
      const result = sessionManager.removeSession(session.sessionId);
      
      expect(result).toBe(true);
      expect(sessionManager.getSession(session.sessionId)).toBeUndefined();
    });

    it('should return false for non-existent session', () => {
      const result = sessionManager.removeSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', () => {
      const clientInfo1 = createMockClientInfo();
      const clientInfo2 = { ...createMockClientInfo(), clientId: '550e8400-e29b-41d4-a716-446655440099' };
      
      sessionManager.createSession(clientInfo1);
      sessionManager.createSession(clientInfo2);
      
      const sessions = sessionManager.getAllSessions();
      expect(sessions.length).toBe(2);
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', () => {
      const clientInfo1 = createMockClientInfo();
      const clientInfo2 = { ...createMockClientInfo(), clientId: '550e8400-e29b-41d4-a716-446655440099' };
      
      const session1 = sessionManager.createSession(clientInfo1);
      const session2 = sessionManager.createSession(clientInfo2);
      
      sessionManager.updateSessionState(session1.sessionId, 'CONNECTED');
      sessionManager.updateSessionState(session2.sessionId, 'DISCONNECTED');
      
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions.length).toBe(1);
      expect(activeSessions[0].sessionId).toBe(session1.sessionId);
    });
  });

  describe('getSessionCount', () => {
    it('should return correct session count', () => {
      expect(sessionManager.getSessionCount()).toBe(0);
      
      const clientInfo = createMockClientInfo();
      sessionManager.createSession(clientInfo);
      
      expect(sessionManager.getSessionCount()).toBe(1);
    });
  });

  describe('cleanupStaleSessions', () => {
    it('should remove stale sessions', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      
      jest.advanceTimersByTime(100000);
      
      const cleaned = sessionManager.cleanupStaleSessions(50000);
      
      expect(cleaned).toBe(1);
      expect(sessionManager.getSession(session.sessionId)).toBeUndefined();
    });

    it('should not remove active sessions', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      
      jest.advanceTimersByTime(10000);
      sessionManager.updateHeartbeat(session.sessionId);
      
      const cleaned = sessionManager.cleanupStaleSessions(50000);
      
      expect(cleaned).toBe(0);
      expect(sessionManager.getSession(session.sessionId)).toBeDefined();
    });
  });

  describe('reconnectSession', () => {
    it('should reconnect session with valid token', () => {
      const clientInfo = createMockClientInfo();
      const original = sessionManager.createSession(clientInfo);
      const originalToken = original.reconnectToken;
      
      const reconnected = sessionManager.reconnectSession(originalToken, clientInfo);
      
      expect(reconnected.sessionId).toBe(original.sessionId);
      expect(reconnected.reconnectToken).not.toBe(originalToken);
      expect(reconnected.connectionState).toBe('CONNECTING');
    });

    it('should throw error for invalid token', () => {
      const clientInfo = createMockClientInfo();
      
      expect(() => sessionManager.reconnectSession('invalid-token', clientInfo)).toThrow();
    });

    it('should throw error for client ID mismatch', () => {
      const clientInfo = createMockClientInfo();
      const session = sessionManager.createSession(clientInfo);
      
      const differentClientInfo = { ...clientInfo, clientId: '550e8400-e29b-41d4-a716-446655440099' };
      
      expect(() => sessionManager.reconnectSession(session.reconnectToken, differentClientInfo)).toThrow();
    });
  });
});
