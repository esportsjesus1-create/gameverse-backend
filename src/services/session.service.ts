import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import {
  GameSession,
  SessionPlayer,
  PlayerStats,
  SessionSettings,
  SessionEvent,
  SessionEventType,
  MVPCalculation,
  MVPBreakdown,
  CreateSessionInput,
  UpdateStatsInput,
  ReconnectionToken,
  SessionSummary,
  PaginatedResult,
  DEFAULT_SESSION_SETTINGS,
  SessionError,
  SessionNotFoundError,
  PlayerNotInSessionError,
  InvalidReconnectionTokenError,
  SessionAlreadyEndedError,
} from '../types';
import { config } from '../config';

const sessions: Map<string, GameSession> = new Map();
const playerSessionMap: Map<string, string> = new Map();
const sessionEvents: Map<string, SessionEvent[]> = new Map();
const reconnectionTokens: Map<string, ReconnectionToken> = new Map();

function createDefaultStats(): PlayerStats {
  return {
    score: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    damageDealt: 0,
    damageTaken: 0,
    healingDone: 0,
    objectivesCompleted: 0,
    timeAlive: 0,
  };
}

export class SessionService {
  async createSession(input: CreateSessionInput): Promise<GameSession> {
    const sessionId = uuidv4();
    const now = new Date();

    const settings: SessionSettings = {
      ...DEFAULT_SESSION_SETTINGS,
      ...input.settings,
    };

    const players: SessionPlayer[] = input.players.map((p, index) => ({
      id: uuidv4(),
      sessionId,
      userId: p.userId,
      username: p.username,
      team: p.team,
      status: 'active',
      stats: createDefaultStats(),
      joinedAt: now,
    }));

    const session: GameSession = {
      id: sessionId,
      lobbyId: input.lobbyId,
      gameMode: input.gameMode,
      status: 'active',
      players,
      settings,
      startedAt: now,
      duration: 0,
      createdAt: now,
      updatedAt: now,
    };

    sessions.set(sessionId, session);
    sessionEvents.set(sessionId, []);
    
    players.forEach(p => playerSessionMap.set(p.userId, sessionId));

    await this.recordEvent(sessionId, 'session_start', undefined, { playerCount: players.length });

    return session;
  }

  async getSessionById(id: string): Promise<GameSession | null> {
    return sessions.get(id) || null;
  }

  async getPlayerSession(userId: string): Promise<GameSession | null> {
    const sessionId = playerSessionMap.get(userId);
    if (!sessionId) return null;
    return sessions.get(sessionId) || null;
  }

  async getActiveSessions(page = 1, limit = 20): Promise<PaginatedResult<GameSession>> {
    const activeSessions = Array.from(sessions.values())
      .filter(s => s.status === 'active' || s.status === 'paused')
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const total = activeSessions.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = activeSessions.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  async updatePlayerStats(input: UpdateStatsInput): Promise<SessionPlayer> {
    const session = sessions.get(input.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    if (session.status === 'completed' || session.status === 'cancelled') {
      throw new SessionAlreadyEndedError();
    }

    const player = session.players.find(p => p.userId === input.playerId);
    if (!player) {
      throw new PlayerNotInSessionError();
    }

    Object.assign(player.stats, input.stats);
    session.updatedAt = new Date();

    return player;
  }

  async recordKill(sessionId: string, killerId: string, victimId: string, assistIds: string[] = []): Promise<void> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const killer = session.players.find(p => p.userId === killerId);
    const victim = session.players.find(p => p.userId === victimId);

    if (killer) {
      killer.stats.kills += 1;
      killer.stats.score += config.mvp.killWeight;
    }

    if (victim) {
      victim.stats.deaths += 1;
    }

    for (const assistId of assistIds) {
      const assister = session.players.find(p => p.userId === assistId);
      if (assister) {
        assister.stats.assists += 1;
        assister.stats.score += config.mvp.assistWeight;
      }
    }

    await this.recordEvent(sessionId, 'player_kill', killerId, { victimId, assistIds });
    session.updatedAt = new Date();
  }

  async handlePlayerDisconnect(sessionId: string, userId: string): Promise<ReconnectionToken | null> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const player = session.players.find(p => p.userId === userId);
    if (!player) {
      throw new PlayerNotInSessionError();
    }

    player.status = 'disconnected';
    player.disconnectedAt = new Date();

    await this.recordEvent(sessionId, 'player_disconnect', userId, {});

    if (!session.settings.allowReconnection) {
      return null;
    }

    const token = jwt.sign(
      { sessionId, playerId: player.id, odbyId: userId },
      config.session.tokenSecret,
      { expiresIn: session.settings.reconnectionTimeout / 1000 }
    );

    const reconnectionToken: ReconnectionToken = {
      token,
      sessionId,
      playerId: player.id,
      userId,
      expiresAt: new Date(Date.now() + session.settings.reconnectionTimeout),
    };

    player.reconnectionToken = token;
    player.reconnectionExpiry = reconnectionToken.expiresAt;
    reconnectionTokens.set(token, reconnectionToken);

    session.updatedAt = new Date();

    return reconnectionToken;
  }

  async handlePlayerReconnect(token: string): Promise<{ session: GameSession; player: SessionPlayer }> {
    const reconnectionData = reconnectionTokens.get(token);
    
    if (!reconnectionData) {
      throw new InvalidReconnectionTokenError();
    }

    if (new Date() > reconnectionData.expiresAt) {
      reconnectionTokens.delete(token);
      throw new InvalidReconnectionTokenError();
    }

    try {
      jwt.verify(token, config.session.tokenSecret);
    } catch {
      throw new InvalidReconnectionTokenError();
    }

    const session = sessions.get(reconnectionData.sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const player = session.players.find(p => p.id === reconnectionData.playerId);
    if (!player) {
      throw new PlayerNotInSessionError();
    }

    player.status = 'active';
    player.disconnectedAt = undefined;
    player.reconnectionToken = undefined;
    player.reconnectionExpiry = undefined;

    reconnectionTokens.delete(token);

    await this.recordEvent(session.id, 'player_reconnect', player.userId, {});
    session.updatedAt = new Date();

    return { session, player };
  }

  async handlePlayerLeave(sessionId: string, userId: string): Promise<GameSession> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    const player = session.players.find(p => p.userId === userId);
    if (!player) {
      throw new PlayerNotInSessionError();
    }

    player.status = 'left';
    player.leftAt = new Date();
    playerSessionMap.delete(userId);

    await this.recordEvent(sessionId, 'player_leave', userId, {});
    session.updatedAt = new Date();

    const activePlayers = session.players.filter(p => p.status === 'active');
    if (activePlayers.length === 0) {
      await this.endSession(sessionId, 'abandoned');
    }

    return session;
  }

  async pauseSession(sessionId: string): Promise<GameSession> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    if (!session.settings.allowPause) {
      throw new SessionError('Pausing is not allowed for this session', 400, 'PAUSE_NOT_ALLOWED');
    }

    if (session.status !== 'active') {
      throw new SessionError('Session is not active', 400, 'SESSION_NOT_ACTIVE');
    }

    session.status = 'paused';
    session.pausedAt = new Date();
    session.updatedAt = new Date();

    await this.recordEvent(sessionId, 'session_pause', undefined, {});

    return session;
  }

  async resumeSession(sessionId: string): Promise<GameSession> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    if (session.status !== 'paused') {
      throw new SessionError('Session is not paused', 400, 'SESSION_NOT_PAUSED');
    }

    session.status = 'active';
    session.pausedAt = undefined;
    session.updatedAt = new Date();

    await this.recordEvent(sessionId, 'session_resume', undefined, {});

    return session;
  }

  async endSession(sessionId: string, reason: 'completed' | 'cancelled' | 'abandoned' = 'completed', winnerId?: string, winnerTeam?: number): Promise<GameSession> {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new SessionNotFoundError();
    }

    if (session.status === 'completed' || session.status === 'cancelled' || session.status === 'abandoned') {
      throw new SessionAlreadyEndedError();
    }

    session.status = reason;
    session.endedAt = new Date();
    session.duration = session.endedAt.getTime() - session.startedAt.getTime();
    session.winnerId = winnerId;
    session.winnerTeam = winnerTeam;
    session.updatedAt = new Date();

    session.players.forEach(p => {
      playerSessionMap.delete(p.userId);
      if (p.reconnectionToken) {
        reconnectionTokens.delete(p.reconnectionToken);
      }
    });

    await this.recordEvent(sessionId, 'session_end', undefined, { reason, winnerId, winnerTeam });

    return session;
  }

  calculateMVP(sessionId: string): MVPCalculation | null {
    const session = sessions.get(sessionId);
    if (!session) return null;

    let mvp: MVPCalculation | null = null;
    let highestScore = -Infinity;

    for (const player of session.players) {
      const breakdown = this.calculateMVPBreakdown(player.stats, session.duration);
      const totalScore = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

      if (totalScore > highestScore) {
        highestScore = totalScore;
        mvp = {
          playerId: player.userId,
          score: totalScore,
          breakdown,
        };
      }
    }

    return mvp;
  }

  private calculateMVPBreakdown(stats: PlayerStats, duration: number): MVPBreakdown {
    const durationMinutes = duration / 60000;

    return {
      killScore: stats.kills * config.mvp.killWeight,
      assistScore: stats.assists * config.mvp.assistWeight,
      objectiveScore: stats.objectivesCompleted * config.mvp.objectiveWeight,
      survivalScore: (stats.timeAlive / 60000) * config.mvp.survivalWeight,
      damageScore: (stats.damageDealt / 100) * config.mvp.damageWeight,
      healingScore: (stats.healingDone / 100) * config.mvp.healingWeight,
      bonusScore: stats.deaths * config.mvp.deathWeight,
    };
  }

  async getSessionSummary(sessionId: string): Promise<SessionSummary | null> {
    const session = sessions.get(sessionId);
    if (!session) return null;

    const events = sessionEvents.get(sessionId) || [];
    const mvp = this.calculateMVP(sessionId);

    return {
      sessionId,
      duration: session.duration,
      winner: {
        playerId: session.winnerId,
        team: session.winnerTeam,
      },
      mvp: mvp!,
      playerStats: session.players,
      events,
    };
  }

  private async recordEvent(sessionId: string, type: SessionEventType, playerId?: string, data?: unknown): Promise<void> {
    const event: SessionEvent = {
      id: uuidv4(),
      sessionId,
      type,
      playerId,
      data,
      timestamp: new Date(),
    };

    const events = sessionEvents.get(sessionId) || [];
    events.push(event);
    sessionEvents.set(sessionId, events);
  }

  async getSessionEvents(sessionId: string): Promise<SessionEvent[]> {
    return sessionEvents.get(sessionId) || [];
  }

  getActiveSessionsCount(): number {
    return Array.from(sessions.values()).filter(s => s.status === 'active' || s.status === 'paused').length;
  }

  getActivePlayersCount(): number {
    return playerSessionMap.size;
  }
}

export const sessionService = new SessionService();
