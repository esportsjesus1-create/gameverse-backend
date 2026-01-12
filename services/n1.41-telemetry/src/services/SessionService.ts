import { v4 as uuidv4 } from 'uuid';
import {
  Session,
  SessionAnalytics,
  TimeSeriesData,
  QueryOptions
} from '../types';
import { logger } from '../utils/logger';
import { getCurrentTimestamp, calculateAverage, groupBy } from '../utils/helpers';

export class SessionService {
  private sessions: Map<string, Session> = new Map();
  private readonly sessionTimeout: number;

  constructor(sessionTimeout = 30 * 60 * 1000) {
    this.sessionTimeout = sessionTimeout;
  }

  public createSession(userId?: string, metadata?: Record<string, unknown>): Session {
    const session: Session = {
      id: uuidv4(),
      userId,
      startTime: getCurrentTimestamp(),
      pageViews: 0,
      events: 0,
      metadata
    };

    this.sessions.set(session.id, session);
    logger.debug('Session created', { sessionId: session.id, userId });
    
    return session;
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  public updateSession(
    sessionId: string,
    updates: Partial<Pick<Session, 'pageViews' | 'events' | 'metadata'>>
  ): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session === undefined) {
      return undefined;
    }

    if (updates.pageViews !== undefined) {
      session.pageViews = updates.pageViews;
    }
    
    if (updates.events !== undefined) {
      session.events = updates.events;
    }
    
    if (updates.metadata !== undefined) {
      session.metadata = { ...session.metadata, ...updates.metadata };
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  public incrementPageViews(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session === undefined) {
      return undefined;
    }

    session.pageViews++;
    this.sessions.set(sessionId, session);
    return session;
  }

  public incrementEvents(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session === undefined) {
      return undefined;
    }

    session.events++;
    this.sessions.set(sessionId, session);
    return session;
  }

  public endSession(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session === undefined) {
      return undefined;
    }

    const now = getCurrentTimestamp();
    session.endTime = now;
    session.duration = now - session.startTime;
    
    this.sessions.set(sessionId, session);
    logger.debug('Session ended', { sessionId, duration: session.duration });
    
    return session;
  }

  public getActiveSessions(): Session[] {
    const now = getCurrentTimestamp();
    return Array.from(this.sessions.values()).filter(
      session => session.endTime === undefined && 
                 (now - session.startTime) < this.sessionTimeout
    );
  }

  public getSessionsByUser(userId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      session => session.userId === userId
    );
  }

  public querySessions(options: QueryOptions = {}): Session[] {
    let filteredSessions = Array.from(this.sessions.values());

    if (options.startTime !== undefined) {
      filteredSessions = filteredSessions.filter(s => s.startTime >= options.startTime!);
    }

    if (options.endTime !== undefined) {
      filteredSessions = filteredSessions.filter(s => s.startTime <= options.endTime!);
    }

    if (options.userId !== undefined) {
      filteredSessions = filteredSessions.filter(s => s.userId === options.userId);
    }

    filteredSessions.sort((a, b) => b.startTime - a.startTime);

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;
    
    return filteredSessions.slice(offset, offset + limit);
  }

  public getSessionAnalytics(startTime?: number, endTime?: number): SessionAnalytics {
    const now = getCurrentTimestamp();
    const defaultStartTime = startTime ?? (now - 24 * 60 * 60 * 1000);
    const defaultEndTime = endTime ?? now;

    const sessionsInRange = Array.from(this.sessions.values()).filter(
      session => session.startTime >= defaultStartTime && session.startTime <= defaultEndTime
    );

    const completedSessions = sessionsInRange.filter(s => s.duration !== undefined);
    const durations = completedSessions
      .map(s => s.duration)
      .filter((d): d is number => d !== undefined);
    
    const bouncedSessions = sessionsInRange.filter(s => s.pageViews <= 1);
    const bounceRate = sessionsInRange.length > 0 
      ? bouncedSessions.length / sessionsInRange.length 
      : 0;

    const sessionsOverTime = this.getSessionsOverTime(sessionsInRange, defaultStartTime, defaultEndTime);

    return {
      totalSessions: sessionsInRange.length,
      activeSessions: this.getActiveSessions().length,
      averageDuration: calculateAverage(durations),
      bounceRate,
      sessionsOverTime
    };
  }

  private getSessionsOverTime(
    sessions: Session[],
    startTime: number,
    endTime: number
  ): TimeSeriesData[] {
    const hourMs = 60 * 60 * 1000;
    const result: TimeSeriesData[] = [];
    
    const grouped = groupBy(sessions, session => {
      const hour = Math.floor(session.startTime / hourMs) * hourMs;
      return hour.toString();
    });

    for (let time = Math.floor(startTime / hourMs) * hourMs; time <= endTime; time += hourMs) {
      const key = time.toString();
      const sessionsInHour = grouped[key];
      result.push({
        timestamp: time,
        value: sessionsInHour !== undefined ? sessionsInHour.length : 0
      });
    }

    return result;
  }

  public getSessionCount(): number {
    return this.sessions.size;
  }

  public clearSessions(): void {
    this.sessions.clear();
    logger.info('All sessions cleared');
  }

  public cleanupExpiredSessions(): number {
    const now = getCurrentTimestamp();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.endTime === undefined && (now - session.startTime) > this.sessionTimeout) {
        this.endSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', { count: cleanedCount });
    }

    return cleanedCount;
  }
}

export const sessionService = new SessionService();
