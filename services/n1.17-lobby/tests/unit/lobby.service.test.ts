import { LobbyService, LobbyServiceError } from '../../src/services/lobby.service';
import { lobbyRepository } from '../../src/database/lobby.repository';
import { redisService } from '../../src/services/redis.service';
import { LobbyStatus, PlayerReadyStatus } from '../../src/types';

jest.mock('../../src/database/lobby.repository');
jest.mock('../../src/services/redis.service');

describe('LobbyService', () => {
  let lobbyService: LobbyService;

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
    updatedAt: new Date()
  };

  const mockPlayer = {
    lobbyId: mockLobby.id,
    playerId: 'player-123',
    readyStatus: PlayerReadyStatus.NOT_READY,
    joinedAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    lobbyService = new LobbyService();
  });

  describe('createLobby', () => {
    it('should create a lobby successfully', async () => {
      const createData = {
        name: 'Test Lobby',
        hostId: 'host-123',
        gameType: 'battle-royale'
      };

      (lobbyRepository.create as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.addPlayer as jest.Mock).mockResolvedValue(mockPlayer);
      (lobbyRepository.findByIdWithPlayers as jest.Mock).mockResolvedValue({
        ...mockLobby,
        players: [{ ...mockPlayer, playerId: 'host-123' }]
      });
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(null);

      const result = await lobbyService.createLobby(createData);

      expect(result).toBeDefined();
      expect(result.name).toBe(mockLobby.name);
      expect(lobbyRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        name: createData.name,
        hostId: createData.hostId,
        gameType: createData.gameType
      }));
      expect(lobbyRepository.addPlayer).toHaveBeenCalledWith(mockLobby.id, createData.hostId);
    });

    it('should throw error if name is empty', async () => {
      const createData = {
        name: '',
        hostId: 'host-123',
        gameType: 'battle-royale'
      };

      await expect(lobbyService.createLobby(createData)).rejects.toThrow(LobbyServiceError);
      await expect(lobbyService.createLobby(createData)).rejects.toThrow('Lobby name is required');
    });

    it('should throw error if hostId is missing', async () => {
      const createData = {
        name: 'Test Lobby',
        hostId: '',
        gameType: 'battle-royale'
      };

      await expect(lobbyService.createLobby(createData)).rejects.toThrow('Host ID is required');
    });

    it('should throw error if gameType is missing', async () => {
      const createData = {
        name: 'Test Lobby',
        hostId: 'host-123',
        gameType: ''
      };

      await expect(lobbyService.createLobby(createData)).rejects.toThrow('Game type is required');
    });

    it('should throw error if maxPlayers is less than minPlayers', async () => {
      const createData = {
        name: 'Test Lobby',
        hostId: 'host-123',
        gameType: 'battle-royale',
        maxPlayers: 2,
        minPlayers: 5
      };

      await expect(lobbyService.createLobby(createData)).rejects.toThrow(
        'Maximum players must be greater than or equal to minimum players'
      );
    });
  });

  describe('getLobbyById', () => {
    it('should return cached lobby if available', async () => {
      const cachedLobby = { ...mockLobby, players: [mockPlayer] };
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(cachedLobby);

      const result = await lobbyService.getLobbyById(mockLobby.id);

      expect(result).toEqual(cachedLobby);
      expect(redisService.getCachedLobby).toHaveBeenCalledWith(mockLobby.id);
      expect(lobbyRepository.findByIdWithPlayers).not.toHaveBeenCalled();
    });

    it('should fetch from database and cache if not in cache', async () => {
      const lobbyWithPlayers = { ...mockLobby, players: [mockPlayer] };
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(null);
      (lobbyRepository.findByIdWithPlayers as jest.Mock).mockResolvedValue(lobbyWithPlayers);

      const result = await lobbyService.getLobbyById(mockLobby.id);

      expect(result).toEqual(lobbyWithPlayers);
      expect(lobbyRepository.findByIdWithPlayers).toHaveBeenCalledWith(mockLobby.id);
      expect(redisService.cacheLobby).toHaveBeenCalledWith(lobbyWithPlayers);
    });

    it('should return null if lobby not found', async () => {
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(null);
      (lobbyRepository.findByIdWithPlayers as jest.Mock).mockResolvedValue(null);

      const result = await lobbyService.getLobbyById('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('joinLobby', () => {
    it('should allow player to join lobby', async () => {
      const lobbyWithPlayers = { ...mockLobby, players: [mockPlayer] };
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.getPlayerCount as jest.Mock).mockResolvedValue(1);
      (lobbyRepository.getPlayer as jest.Mock).mockResolvedValue(null);
      (lobbyRepository.addPlayer as jest.Mock).mockResolvedValue(mockPlayer);
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(null);
      (lobbyRepository.findByIdWithPlayers as jest.Mock).mockResolvedValue(lobbyWithPlayers);

      const result = await lobbyService.joinLobby(mockLobby.id, 'new-player');

      expect(result).toBeDefined();
      expect(lobbyRepository.addPlayer).toHaveBeenCalledWith(mockLobby.id, 'new-player');
      expect(redisService.invalidateLobbyCache).toHaveBeenCalledWith(mockLobby.id);
    });

    it('should throw error if lobby not found', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(lobbyService.joinLobby('non-existent', 'player-123')).rejects.toThrow('Lobby not found');
    });

    it('should throw error if lobby is full', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.getPlayerCount as jest.Mock).mockResolvedValue(10);

      await expect(lobbyService.joinLobby(mockLobby.id, 'new-player')).rejects.toThrow('Lobby is full');
    });

    it('should throw error if player already in lobby', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.getPlayerCount as jest.Mock).mockResolvedValue(1);
      (lobbyRepository.getPlayer as jest.Mock).mockResolvedValue(mockPlayer);

      await expect(lobbyService.joinLobby(mockLobby.id, mockPlayer.playerId)).rejects.toThrow('Player already in lobby');
    });

    it('should throw error if game already in progress', async () => {
      const inGameLobby = { ...mockLobby, status: LobbyStatus.IN_GAME };
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(inGameLobby);

      await expect(lobbyService.joinLobby(mockLobby.id, 'new-player')).rejects.toThrow(
        'Cannot join lobby - game already in progress or lobby closed'
      );
    });
  });

  describe('leaveLobby', () => {
    it('should allow player to leave lobby', async () => {
      const lobbyWithPlayers = { ...mockLobby, players: [] };
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.getPlayer as jest.Mock).mockResolvedValue(mockPlayer);
      (lobbyRepository.removePlayer as jest.Mock).mockResolvedValue(true);
      (lobbyRepository.getPlayers as jest.Mock).mockResolvedValue([{ playerId: 'other-player' }]);
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(null);
      (lobbyRepository.findByIdWithPlayers as jest.Mock).mockResolvedValue(lobbyWithPlayers);

      const result = await lobbyService.leaveLobby(mockLobby.id, mockPlayer.playerId);

      expect(result).toBeDefined();
      expect(lobbyRepository.removePlayer).toHaveBeenCalledWith(mockLobby.id, mockPlayer.playerId);
    });

    it('should delete lobby if host leaves and no players remain', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.getPlayer as jest.Mock).mockResolvedValue({ ...mockPlayer, playerId: 'host-123' });
      (lobbyRepository.removePlayer as jest.Mock).mockResolvedValue(true);
      (lobbyRepository.getPlayers as jest.Mock).mockResolvedValue([]);
      (lobbyRepository.delete as jest.Mock).mockResolvedValue(true);

      const result = await lobbyService.leaveLobby(mockLobby.id, 'host-123');

      expect(result).toBeNull();
      expect(lobbyRepository.delete).toHaveBeenCalledWith(mockLobby.id);
    });

    it('should transfer host if host leaves but players remain', async () => {
      const newHost = { playerId: 'new-host', lobbyId: mockLobby.id, readyStatus: PlayerReadyStatus.NOT_READY, joinedAt: new Date() };
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.getPlayer as jest.Mock).mockResolvedValue({ ...mockPlayer, playerId: 'host-123' });
      (lobbyRepository.removePlayer as jest.Mock).mockResolvedValue(true);
      (lobbyRepository.getPlayers as jest.Mock).mockResolvedValue([newHost]);
      (lobbyRepository.update as jest.Mock).mockResolvedValue({ ...mockLobby, hostId: 'new-host' });
      (redisService.getCachedLobby as jest.Mock).mockResolvedValue(null);
      (lobbyRepository.findByIdWithPlayers as jest.Mock).mockResolvedValue({ ...mockLobby, hostId: 'new-host', players: [newHost] });

      await lobbyService.leaveLobby(mockLobby.id, 'host-123');

      expect(lobbyRepository.update).toHaveBeenCalledWith(mockLobby.id, expect.objectContaining({ hostId: 'new-host' }));
    });
  });

  describe('setPlayerReady', () => {
    it('should set player ready status', async () => {
      const readyPlayer = { ...mockPlayer, readyStatus: PlayerReadyStatus.READY };
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.setPlayerReady as jest.Mock).mockResolvedValue(readyPlayer);
      (lobbyRepository.areAllPlayersReady as jest.Mock).mockResolvedValue(false);
      (lobbyRepository.getPlayerCount as jest.Mock).mockResolvedValue(2);

      const result = await lobbyService.setPlayerReady(mockLobby.id, mockPlayer.playerId, true);

      expect(result.player.readyStatus).toBe(PlayerReadyStatus.READY);
      expect(result.allReady).toBe(false);
    });

    it('should return allReady true when all players are ready and min players met', async () => {
      const readyPlayer = { ...mockPlayer, readyStatus: PlayerReadyStatus.READY };
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.setPlayerReady as jest.Mock).mockResolvedValue(readyPlayer);
      (lobbyRepository.areAllPlayersReady as jest.Mock).mockResolvedValue(true);
      (lobbyRepository.getPlayerCount as jest.Mock).mockResolvedValue(2);

      const result = await lobbyService.setPlayerReady(mockLobby.id, mockPlayer.playerId, true);

      expect(result.allReady).toBe(true);
    });

    it('should throw error if lobby not found', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(lobbyService.setPlayerReady('non-existent', 'player-123', true)).rejects.toThrow('Lobby not found');
    });

    it('should throw error if player not in lobby', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.setPlayerReady as jest.Mock).mockResolvedValue(null);

      await expect(lobbyService.setPlayerReady(mockLobby.id, 'unknown-player', true)).rejects.toThrow('Player not in lobby');
    });
  });

  describe('deleteLobby', () => {
    it('should delete lobby if requester is host', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);
      (lobbyRepository.delete as jest.Mock).mockResolvedValue(true);

      await lobbyService.deleteLobby(mockLobby.id, 'host-123');

      expect(lobbyRepository.delete).toHaveBeenCalledWith(mockLobby.id);
      expect(redisService.invalidateLobbyCache).toHaveBeenCalledWith(mockLobby.id);
    });

    it('should throw error if requester is not host', async () => {
      (lobbyRepository.findById as jest.Mock).mockResolvedValue(mockLobby);

      await expect(lobbyService.deleteLobby(mockLobby.id, 'not-host')).rejects.toThrow('Only the host can delete the lobby');
    });
  });
});
