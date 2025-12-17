import { SessionService } from '../services/session.service';
import {
  SessionError,
  SessionNotFoundError,
  PlayerNotInSessionError,
  InvalidReconnectionTokenError,
  SessionAlreadyEndedError,
} from '../types';

describe('SessionService', () => {
  let sessionService: SessionService;

  beforeEach(() => {
    sessionService = new SessionService();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000001',
        gameMode: 'squad',
        players: [
          { userId: 'player-1', username: 'Player1' },
          { userId: 'player-2', username: 'Player2' },
        ],
      });

      expect(session).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.players).toHaveLength(2);
      expect(session.gameMode).toBe('squad');
    });

    it('should create session with custom settings', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000002',
        gameMode: 'duo',
        players: [{ userId: 'player-3', username: 'Player3' }],
        settings: {
          allowReconnection: false,
          maxDuration: 1800000,
        },
      });

      expect(session.settings.allowReconnection).toBe(false);
      expect(session.settings.maxDuration).toBe(1800000);
    });

    it('should initialize player stats', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000003',
        gameMode: 'solo',
        players: [{ userId: 'player-4', username: 'Player4' }],
      });

      const player = session.players[0];
      expect(player.stats.score).toBe(0);
      expect(player.stats.kills).toBe(0);
      expect(player.stats.deaths).toBe(0);
    });
  });

  describe('updatePlayerStats', () => {
    it('should update player stats', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000004',
        gameMode: 'squad',
        players: [{ userId: 'player-5', username: 'Player5' }],
      });

      const updatedPlayer = await sessionService.updatePlayerStats({
        sessionId: session.id,
        playerId: 'player-5',
        stats: { kills: 5, damageDealt: 1000 },
      });

      expect(updatedPlayer.stats.kills).toBe(5);
      expect(updatedPlayer.stats.damageDealt).toBe(1000);
    });

    it('should throw error for non-existent session', async () => {
      await expect(
        sessionService.updatePlayerStats({
          sessionId: '00000000-0000-0000-0000-000000000000',
          playerId: 'player-x',
          stats: { kills: 1 },
        })
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw error for non-existent player', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000005',
        gameMode: 'solo',
        players: [{ userId: 'player-6', username: 'Player6' }],
      });

      await expect(
        sessionService.updatePlayerStats({
          sessionId: session.id,
          playerId: 'non-existent',
          stats: { kills: 1 },
        })
      ).rejects.toThrow(PlayerNotInSessionError);
    });
  });

  describe('recordKill', () => {
    it('should record kill and update stats', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000006',
        gameMode: 'squad',
        players: [
          { userId: 'killer-1', username: 'Killer' },
          { userId: 'victim-1', username: 'Victim' },
          { userId: 'assist-1', username: 'Assister' },
        ],
      });

      await sessionService.recordKill(session.id, 'killer-1', 'victim-1', ['assist-1']);

      const updatedSession = await sessionService.getSessionById(session.id);
      const killer = updatedSession!.players.find(p => p.userId === 'killer-1');
      const victim = updatedSession!.players.find(p => p.userId === 'victim-1');
      const assister = updatedSession!.players.find(p => p.userId === 'assist-1');

      expect(killer!.stats.kills).toBe(1);
      expect(victim!.stats.deaths).toBe(1);
      expect(assister!.stats.assists).toBe(1);
    });
  });

  describe('handlePlayerDisconnect and handlePlayerReconnect', () => {
    it('should handle player disconnect and generate reconnection token', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000007',
        gameMode: 'squad',
        players: [{ userId: 'player-7', username: 'Player7' }],
        settings: { allowReconnection: true, reconnectionTimeout: 120000 },
      });

      const token = await sessionService.handlePlayerDisconnect(session.id, 'player-7');

      expect(token).toBeDefined();
      expect(token!.token).toBeDefined();
      expect(token!.userId).toBe('player-7');

      const updatedSession = await sessionService.getSessionById(session.id);
      const player = updatedSession!.players.find(p => p.userId === 'player-7');
      expect(player!.status).toBe('disconnected');
    });

    it('should handle player reconnect with valid token', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000008',
        gameMode: 'squad',
        players: [{ userId: 'player-8', username: 'Player8' }],
        settings: { allowReconnection: true, reconnectionTimeout: 120000 },
      });

      const token = await sessionService.handlePlayerDisconnect(session.id, 'player-8');
      const result = await sessionService.handlePlayerReconnect(token!.token);

      expect(result.player.status).toBe('active');
      expect(result.player.disconnectedAt).toBeUndefined();
    });

    it('should throw error for invalid reconnection token', async () => {
      await expect(
        sessionService.handlePlayerReconnect('invalid-token')
      ).rejects.toThrow(InvalidReconnectionTokenError);
    });

    it('should not generate token when reconnection is disabled', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000009',
        gameMode: 'squad',
        players: [{ userId: 'player-9', username: 'Player9' }],
        settings: { allowReconnection: false },
      });

      const token = await sessionService.handlePlayerDisconnect(session.id, 'player-9');

      expect(token).toBeNull();
    });
  });

  describe('handlePlayerLeave', () => {
    it('should handle player leaving session', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000010',
        gameMode: 'squad',
        players: [
          { userId: 'player-10', username: 'Player10' },
          { userId: 'player-11', username: 'Player11' },
        ],
      });

      const updatedSession = await sessionService.handlePlayerLeave(session.id, 'player-10');

      const player = updatedSession.players.find(p => p.userId === 'player-10');
      expect(player!.status).toBe('left');
      expect(player!.leftAt).toBeDefined();
    });

    it('should end session when all players leave', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000011',
        gameMode: 'solo',
        players: [{ userId: 'player-12', username: 'Player12' }],
      });

      await sessionService.handlePlayerLeave(session.id, 'player-12');

      const updatedSession = await sessionService.getSessionById(session.id);
      expect(updatedSession!.status).toBe('abandoned');
    });
  });

  describe('pauseSession and resumeSession', () => {
    it('should pause and resume session', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000012',
        gameMode: 'squad',
        players: [{ userId: 'player-13', username: 'Player13' }],
        settings: { allowPause: true },
      });

      const pausedSession = await sessionService.pauseSession(session.id);
      expect(pausedSession.status).toBe('paused');
      expect(pausedSession.pausedAt).toBeDefined();

      const resumedSession = await sessionService.resumeSession(session.id);
      expect(resumedSession.status).toBe('active');
      expect(resumedSession.pausedAt).toBeUndefined();
    });

    it('should throw error when pause is not allowed', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000013',
        gameMode: 'squad',
        players: [{ userId: 'player-14', username: 'Player14' }],
        settings: { allowPause: false },
      });

      await expect(sessionService.pauseSession(session.id)).rejects.toThrow(SessionError);
    });
  });

  describe('endSession', () => {
    it('should end session with winner', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000014',
        gameMode: 'squad',
        players: [
          { userId: 'player-15', username: 'Player15' },
          { userId: 'player-16', username: 'Player16' },
        ],
      });

      const endedSession = await sessionService.endSession(session.id, 'completed', 'player-15');

      expect(endedSession.status).toBe('completed');
      expect(endedSession.winnerId).toBe('player-15');
      expect(endedSession.endedAt).toBeDefined();
      expect(endedSession.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw error when ending already ended session', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000015',
        gameMode: 'solo',
        players: [{ userId: 'player-17', username: 'Player17' }],
      });

      await sessionService.endSession(session.id, 'completed');

      await expect(
        sessionService.endSession(session.id, 'completed')
      ).rejects.toThrow(SessionAlreadyEndedError);
    });
  });

  describe('calculateMVP', () => {
    it('should calculate MVP based on stats', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000016',
        gameMode: 'squad',
        players: [
          { userId: 'mvp-1', username: 'MVP1' },
          { userId: 'mvp-2', username: 'MVP2' },
        ],
      });

      await sessionService.updatePlayerStats({
        sessionId: session.id,
        playerId: 'mvp-1',
        stats: { kills: 10, assists: 5, damageDealt: 5000 },
      });

      await sessionService.updatePlayerStats({
        sessionId: session.id,
        playerId: 'mvp-2',
        stats: { kills: 3, assists: 2, damageDealt: 1000 },
      });

      const mvp = sessionService.calculateMVP(session.id);

      expect(mvp).toBeDefined();
      expect(mvp!.playerId).toBe('mvp-1');
      expect(mvp!.score).toBeGreaterThan(0);
      expect(mvp!.breakdown).toBeDefined();
    });
  });

  describe('getSessionSummary', () => {
    it('should return session summary', async () => {
      const session = await sessionService.createSession({
        lobbyId: '00000000-0000-0000-0000-000000000017',
        gameMode: 'squad',
        players: [{ userId: 'player-18', username: 'Player18' }],
      });

      await sessionService.endSession(session.id, 'completed', 'player-18');

      const summary = await sessionService.getSessionSummary(session.id);

      expect(summary).toBeDefined();
      expect(summary!.sessionId).toBe(session.id);
      expect(summary!.winner.playerId).toBe('player-18');
      expect(summary!.playerStats).toHaveLength(1);
      expect(summary!.events.length).toBeGreaterThan(0);
    });
  });
});
