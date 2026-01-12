import { SessionService } from '../../src/services/SessionService';

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService(30 * 60 * 1000);
  });

  afterEach(() => {
    sessionService.clearSessions();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = sessionService.createSession('user123');

      expect(session.id).toBeDefined();
      expect(session.userId).toBe('user123');
      expect(session.startTime).toBeDefined();
      expect(session.pageViews).toBe(0);
      expect(session.events).toBe(0);
    });

    it('should create session without userId', () => {
      const session = sessionService.createSession();

      expect(session.id).toBeDefined();
      expect(session.userId).toBeUndefined();
    });

    it('should create session with metadata', () => {
      const metadata = { browser: 'Chrome', os: 'Windows' };
      const session = sessionService.createSession('user123', metadata);

      expect(session.metadata).toEqual(metadata);
    });
  });

  describe('getSession', () => {
    it('should retrieve a session by id', () => {
      const created = sessionService.createSession('user123');
      const retrieved = sessionService.getSession(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionService.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('updateSession', () => {
    it('should update session pageViews', () => {
      const session = sessionService.createSession();
      const updated = sessionService.updateSession(session.id, { pageViews: 5 });

      expect(updated?.pageViews).toBe(5);
    });

    it('should update session events', () => {
      const session = sessionService.createSession();
      const updated = sessionService.updateSession(session.id, { events: 10 });

      expect(updated?.events).toBe(10);
    });

    it('should merge metadata', () => {
      const session = sessionService.createSession('user', { key1: 'value1' });
      const updated = sessionService.updateSession(session.id, { 
        metadata: { key2: 'value2' } 
      });

      expect(updated?.metadata).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should return undefined for non-existent session', () => {
      const updated = sessionService.updateSession('non-existent', { pageViews: 5 });
      expect(updated).toBeUndefined();
    });
  });

  describe('incrementPageViews', () => {
    it('should increment page views by 1', () => {
      const session = sessionService.createSession();
      sessionService.incrementPageViews(session.id);
      sessionService.incrementPageViews(session.id);

      const updated = sessionService.getSession(session.id);
      expect(updated?.pageViews).toBe(2);
    });

    it('should return undefined for non-existent session', () => {
      const result = sessionService.incrementPageViews('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('incrementEvents', () => {
    it('should increment events by 1', () => {
      const session = sessionService.createSession();
      sessionService.incrementEvents(session.id);
      sessionService.incrementEvents(session.id);
      sessionService.incrementEvents(session.id);

      const updated = sessionService.getSession(session.id);
      expect(updated?.events).toBe(3);
    });

    it('should return undefined for non-existent session', () => {
      const result = sessionService.incrementEvents('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('endSession', () => {
    it('should end a session and set duration', () => {
      const session = sessionService.createSession();
      
      const ended = sessionService.endSession(session.id);

      expect(ended?.endTime).toBeDefined();
      expect(ended?.duration).toBeDefined();
      expect(ended?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return undefined for non-existent session', () => {
      const result = sessionService.endSession('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', () => {
      const session1 = sessionService.createSession('user1');
      const session2 = sessionService.createSession('user2');
      sessionService.endSession(session1.id);

      const active = sessionService.getActiveSessions();

      expect(active).toHaveLength(1);
      expect(active[0]?.id).toBe(session2.id);
    });
  });

  describe('getSessionsByUser', () => {
    it('should return sessions for a specific user', () => {
      sessionService.createSession('user1');
      sessionService.createSession('user2');
      sessionService.createSession('user1');

      const userSessions = sessionService.getSessionsByUser('user1');

      expect(userSessions).toHaveLength(2);
    });
  });

  describe('querySessions', () => {
    beforeEach(() => {
      sessionService.createSession('user1');
      sessionService.createSession('user2');
      sessionService.createSession('user1');
    });

    it('should return all sessions with default options', () => {
      const sessions = sessionService.querySessions();
      expect(sessions).toHaveLength(3);
    });

    it('should filter by userId', () => {
      const sessions = sessionService.querySessions({ userId: 'user1' });
      expect(sessions).toHaveLength(2);
    });

    it('should apply pagination', () => {
      const sessions = sessionService.querySessions({ limit: 2, offset: 0 });
      expect(sessions).toHaveLength(2);
    });
  });

  describe('getSessionAnalytics', () => {
    it('should return session analytics', () => {
      const session1 = sessionService.createSession('user1');
      const session2 = sessionService.createSession('user2');
      sessionService.incrementPageViews(session1.id);
      sessionService.incrementPageViews(session1.id);
      sessionService.endSession(session1.id);

      const analytics = sessionService.getSessionAnalytics();

      expect(analytics.totalSessions).toBe(2);
      expect(analytics.activeSessions).toBe(1);
      expect(analytics.bounceRate).toBeGreaterThanOrEqual(0);
      expect(analytics.sessionsOverTime).toBeDefined();
    });

    it('should calculate bounce rate correctly', () => {
      const session1 = sessionService.createSession();
      const session2 = sessionService.createSession();
      sessionService.incrementPageViews(session1.id);
      sessionService.incrementPageViews(session1.id);

      const analytics = sessionService.getSessionAnalytics();

      expect(analytics.bounceRate).toBe(0.5);
    });
  });

  describe('getSessionCount', () => {
    it('should return total session count', () => {
      sessionService.createSession();
      sessionService.createSession();
      sessionService.createSession();

      expect(sessionService.getSessionCount()).toBe(3);
    });
  });

  describe('clearSessions', () => {
    it('should clear all sessions', () => {
      sessionService.createSession();
      sessionService.createSession();
      sessionService.clearSessions();

      expect(sessionService.getSessionCount()).toBe(0);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', () => {
      const shortTimeoutService = new SessionService(1);
      shortTimeoutService.createSession();
      
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          const cleaned = shortTimeoutService.cleanupExpiredSessions();
          expect(cleaned).toBe(1);
          shortTimeoutService.clearSessions();
          resolve();
        }, 10);
      });
    });
  });
});
