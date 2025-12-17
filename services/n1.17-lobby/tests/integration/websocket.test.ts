import { WebSocketHandlers } from '../../src/websocket/handlers';
import { WebSocket } from 'ws';
import { WebSocketEventType, LobbyStatus, PlayerReadyStatus } from '../../src/types';
import { lobbyService } from '../../src/services/lobby.service';
import { countdownService } from '../../src/services/countdown.service';
import { redisService } from '../../src/services/redis.service';

jest.mock('../../src/services/lobby.service');
jest.mock('../../src/services/countdown.service');
jest.mock('../../src/services/redis.service');

describe('WebSocket Handlers Integration Tests', () => {
  let wsHandlers: WebSocketHandlers;
  let mockWs: Partial<WebSocket>;
  let sentMessages: string[];

  const mockLobby = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Lobby',
    hostId: 'host-123',
    maxPlayers: 10,
    minPlayers: 2,
    status: LobbyStatus.WAITING,
    gameType: 'battle-royale',
    countdownDuration: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
    players: []
  };

  beforeEach(() => {
    jest.clearAllMocks();
    sentMessages = [];
    
    mockWs = {
      readyState: WebSocket.OPEN,
      send: jest.fn((data: string) => {
        sentMessages.push(data);
      }),
      terminate: jest.fn(),
      ping: jest.fn()
    };

    wsHandlers = new WebSocketHandlers();
  });

  describe('Client Registration', () => {
    it('should register a client', () => {
      wsHandlers.registerClient(mockWs as WebSocket, 'player-123');
      
      const client = wsHandlers.getClient(mockWs as WebSocket);
      expect(client).toBeDefined();
      expect(client?.playerId).toBe('player-123');
      expect(client?.lobbyId).toBeNull();
      expect(client?.isAlive).toBe(true);
    });

    it('should unregister a client', () => {
      wsHandlers.registerClient(mockWs as WebSocket, 'player-123');
      wsHandlers.unregisterClient(mockWs as WebSocket);
      
      const client = wsHandlers.getClient(mockWs as WebSocket);
      expect(client).toBeUndefined();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      wsHandlers.registerClient(mockWs as WebSocket, 'player-123');
    });

    it('should handle join lobby message', async () => {
      const lobbyWithPlayer = {
        ...mockLobby,
        players: [{ lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() }]
      };
      
      (lobbyService.joinLobby as jest.Mock).mockResolvedValue(lobbyWithPlayer);

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-123' },
        timestamp: new Date().toISOString()
      });

      expect(lobbyService.joinLobby).toHaveBeenCalledWith(mockLobby.id, 'player-123');
      expect(sentMessages.length).toBeGreaterThan(0);
      
      const response = JSON.parse(sentMessages[0]);
      expect(response.type).toBe(WebSocketEventType.JOIN_LOBBY);
      expect(response.payload.success).toBe(true);
    });

    it('should handle leave lobby message', async () => {
      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [{ lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() }]
      });
      (lobbyService.leaveLobby as jest.Mock).mockResolvedValue(mockLobby);
      (countdownService.isCountdownActive as jest.Mock).mockReturnValue(false);

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-123' },
        timestamp: new Date().toISOString()
      });

      sentMessages = [];

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.LEAVE_LOBBY,
        payload: {},
        timestamp: new Date().toISOString()
      });

      expect(lobbyService.leaveLobby).toHaveBeenCalledWith(mockLobby.id, 'player-123');
      
      const response = JSON.parse(sentMessages[0]);
      expect(response.type).toBe(WebSocketEventType.LEAVE_LOBBY);
      expect(response.payload.success).toBe(true);
    });

    it('should handle ready status change message', async () => {
      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [{ lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() }]
      });
      (lobbyService.setPlayerReady as jest.Mock).mockResolvedValue({
        player: { lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.READY, joinedAt: new Date() },
        allReady: false
      });
      (countdownService.isCountdownActive as jest.Mock).mockReturnValue(false);

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-123' },
        timestamp: new Date().toISOString()
      });

      sentMessages = [];

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.READY_STATUS_CHANGED,
        payload: { ready: true },
        timestamp: new Date().toISOString()
      });

      expect(lobbyService.setPlayerReady).toHaveBeenCalledWith(mockLobby.id, 'player-123', true);
    });

    it('should start countdown when all players ready', async () => {
      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [{ lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() }]
      });
      (lobbyService.setPlayerReady as jest.Mock).mockResolvedValue({
        player: { lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.READY, joinedAt: new Date() },
        allReady: true
      });
      (lobbyService.getLobbyById as jest.Mock).mockResolvedValue(mockLobby);
      (countdownService.isCountdownActive as jest.Mock).mockReturnValue(false);
      (countdownService.startCountdown as jest.Mock).mockResolvedValue({
        lobbyId: mockLobby.id,
        startedAt: Date.now(),
        duration: 10,
        remaining: 10,
        active: true
      });

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-123' },
        timestamp: new Date().toISOString()
      });

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.READY_STATUS_CHANGED,
        payload: { ready: true },
        timestamp: new Date().toISOString()
      });

      expect(countdownService.startCountdown).toHaveBeenCalledWith(mockLobby.id, mockLobby.countdownDuration);
    });

    it('should cancel countdown when player unreadies', async () => {
      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [{ lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.READY, joinedAt: new Date() }]
      });
      (lobbyService.setPlayerReady as jest.Mock).mockResolvedValue({
        player: { lobbyId: mockLobby.id, playerId: 'player-123', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() },
        allReady: false
      });
      (countdownService.isCountdownActive as jest.Mock).mockReturnValue(true);
      (countdownService.cancelCountdown as jest.Mock).mockResolvedValue(undefined);

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-123' },
        timestamp: new Date().toISOString()
      });

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.READY_STATUS_CHANGED,
        payload: { ready: false },
        timestamp: new Date().toISOString()
      });

      expect(countdownService.cancelCountdown).toHaveBeenCalledWith(mockLobby.id);
    });

    it('should handle ping message', async () => {
      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.PING,
        payload: {},
        timestamp: new Date().toISOString()
      });

      const response = JSON.parse(sentMessages[0]);
      expect(response.type).toBe(WebSocketEventType.PONG);
    });

    it('should send error for unknown message type', async () => {
      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: 'unknown_type' as WebSocketEventType,
        payload: {},
        timestamp: new Date().toISOString()
      });

      const response = JSON.parse(sentMessages[0]);
      expect(response.type).toBe(WebSocketEventType.ERROR);
    });

    it('should send error for unregistered client', async () => {
      const unregisteredWs: Partial<WebSocket> = {
        readyState: WebSocket.OPEN,
        send: jest.fn((data: string) => {
          sentMessages.push(data);
        })
      };

      await wsHandlers.handleMessage(unregisteredWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id },
        timestamp: new Date().toISOString()
      });

      const response = JSON.parse(sentMessages[sentMessages.length - 1]);
      expect(response.type).toBe(WebSocketEventType.ERROR);
      expect(response.payload.error).toBe('Client not registered');
    });
  });

  describe('Broadcasting', () => {
    it('should broadcast to all clients in lobby except sender', async () => {
      const mockWs2: Partial<WebSocket> = {
        readyState: WebSocket.OPEN,
        send: jest.fn()
      };

      wsHandlers.registerClient(mockWs as WebSocket, 'player-1');
      wsHandlers.registerClient(mockWs2 as WebSocket, 'player-2');

      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [
          { lobbyId: mockLobby.id, playerId: 'player-1', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() }
        ]
      });

      await wsHandlers.handleMessage(mockWs as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-1' },
        timestamp: new Date().toISOString()
      });

      (lobbyService.joinLobby as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [
          { lobbyId: mockLobby.id, playerId: 'player-1', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() },
          { lobbyId: mockLobby.id, playerId: 'player-2', readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() }
        ]
      });

      await wsHandlers.handleMessage(mockWs2 as WebSocket, {
        type: WebSocketEventType.JOIN_LOBBY,
        payload: { lobbyId: mockLobby.id, playerId: 'player-2' },
        timestamp: new Date().toISOString()
      });

      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('Heartbeat', () => {
    it('should mark clients as not alive during heartbeat', () => {
      wsHandlers.registerClient(mockWs as WebSocket, 'player-123');
      
      const client = wsHandlers.getClient(mockWs as WebSocket);
      expect(client?.isAlive).toBe(true);

      wsHandlers.heartbeat();

      expect(client?.isAlive).toBe(false);
      expect(mockWs.ping).toHaveBeenCalled();
    });

    it('should terminate clients that miss heartbeat', () => {
      wsHandlers.registerClient(mockWs as WebSocket, 'player-123');
      
      const client = wsHandlers.getClient(mockWs as WebSocket);
      if (client) {
        client.isAlive = false;
      }

      wsHandlers.heartbeat();

      expect(mockWs.terminate).toHaveBeenCalled();
    });
  });
});
