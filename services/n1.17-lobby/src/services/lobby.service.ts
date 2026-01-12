import { 
  Lobby, 
  LobbyWithPlayers, 
  LobbyStatus, 
  CreateLobbyRequest,
  LobbyFilters,
  LobbyPlayer
} from '../types';
import { lobbyRepository } from '../database/lobby.repository';
import { redisService } from './redis.service';
import { LoggerService } from './logger.service';
import { config } from '../config';

const logger = new LoggerService('LobbyService');

export class LobbyServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'LobbyServiceError';
  }
}

export class LobbyService {
  async createLobby(data: CreateLobbyRequest): Promise<LobbyWithPlayers> {
    if (!data.name || data.name.trim().length === 0) {
      throw new LobbyServiceError('Lobby name is required');
    }

    if (!data.hostId) {
      throw new LobbyServiceError('Host ID is required');
    }

    if (!data.gameType) {
      throw new LobbyServiceError('Game type is required');
    }

    const maxPlayers = data.maxPlayers || config.lobby.defaultMaxPlayers;
    const minPlayers = data.minPlayers || config.lobby.defaultMinPlayers;

    if (minPlayers < 1) {
      throw new LobbyServiceError('Minimum players must be at least 1');
    }

    if (maxPlayers < minPlayers) {
      throw new LobbyServiceError('Maximum players must be greater than or equal to minimum players');
    }

    const countdownDuration = data.countdownDuration || config.lobby.defaultCountdownDuration;
    if (countdownDuration > config.lobby.maxCountdownDuration) {
      throw new LobbyServiceError(`Countdown duration cannot exceed ${config.lobby.maxCountdownDuration} seconds`);
    }

    const lobby = await lobbyRepository.create({
      ...data,
      maxPlayers,
      minPlayers,
      countdownDuration
    });

    await lobbyRepository.addPlayer(lobby.id, data.hostId);
    
    const lobbyWithPlayers = await this.getLobbyById(lobby.id);
    if (!lobbyWithPlayers) {
      throw new LobbyServiceError('Failed to create lobby', 500);
    }

    logger.info('Lobby created', { lobbyId: lobby.id, hostId: data.hostId });
    return lobbyWithPlayers;
  }

  async getLobbyById(id: string): Promise<LobbyWithPlayers | null> {
    const cached = await redisService.getCachedLobby(id);
    if (cached) {
      return cached;
    }

    const lobby = await lobbyRepository.findByIdWithPlayers(id);
    if (lobby) {
      await redisService.cacheLobby(lobby);
    }
    return lobby;
  }

  async listLobbies(
    filters?: LobbyFilters,
    page = 1,
    limit = 20
  ): Promise<{ lobbies: LobbyWithPlayers[]; total: number; page: number; limit: number }> {
    const { lobbies, total } = await lobbyRepository.findAll(filters, page, limit);
    
    const lobbiesWithPlayers = await Promise.all(
      lobbies.map(async (lobby) => {
        const players = await lobbyRepository.getPlayers(lobby.id);
        return { ...lobby, players };
      })
    );

    return { lobbies: lobbiesWithPlayers, total, page, limit };
  }

  async joinLobby(lobbyId: string, playerId: string): Promise<LobbyWithPlayers> {
    const lobby = await lobbyRepository.findById(lobbyId);
    
    if (!lobby) {
      throw new LobbyServiceError('Lobby not found', 404);
    }

    if (lobby.status !== LobbyStatus.WAITING) {
      throw new LobbyServiceError('Cannot join lobby - game already in progress or lobby closed');
    }

    const playerCount = await lobbyRepository.getPlayerCount(lobbyId);
    if (playerCount >= lobby.maxPlayers) {
      throw new LobbyServiceError('Lobby is full');
    }

    const existingPlayer = await lobbyRepository.getPlayer(lobbyId, playerId);
    if (existingPlayer) {
      throw new LobbyServiceError('Player already in lobby');
    }

    await lobbyRepository.addPlayer(lobbyId, playerId);
    await redisService.invalidateLobbyCache(lobbyId);

    const updatedLobby = await this.getLobbyById(lobbyId);
    if (!updatedLobby) {
      throw new LobbyServiceError('Failed to join lobby', 500);
    }

    logger.info('Player joined lobby', { lobbyId, playerId });
    return updatedLobby;
  }

  async leaveLobby(lobbyId: string, playerId: string): Promise<LobbyWithPlayers | null> {
    const lobby = await lobbyRepository.findById(lobbyId);
    
    if (!lobby) {
      throw new LobbyServiceError('Lobby not found', 404);
    }

    const player = await lobbyRepository.getPlayer(lobbyId, playerId);
    if (!player) {
      throw new LobbyServiceError('Player not in lobby', 404);
    }

    await lobbyRepository.removePlayer(lobbyId, playerId);
    await redisService.invalidateLobbyCache(lobbyId);

    if (lobby.hostId === playerId) {
      const remainingPlayers = await lobbyRepository.getPlayers(lobbyId);
      
      if (remainingPlayers.length === 0) {
        await lobbyRepository.delete(lobbyId);
        logger.info('Lobby deleted - host left and no players remaining', { lobbyId });
        return null;
      }

      const newHost = remainingPlayers[0];
      await lobbyRepository.update(lobbyId, { hostId: newHost.playerId } as Partial<Lobby>);
      logger.info('Host transferred', { lobbyId, newHostId: newHost.playerId });
    }

    const updatedLobby = await this.getLobbyById(lobbyId);
    logger.info('Player left lobby', { lobbyId, playerId });
    return updatedLobby;
  }

  async deleteLobby(lobbyId: string, requesterId: string): Promise<void> {
    const lobby = await lobbyRepository.findById(lobbyId);
    
    if (!lobby) {
      throw new LobbyServiceError('Lobby not found', 404);
    }

    if (lobby.hostId !== requesterId) {
      throw new LobbyServiceError('Only the host can delete the lobby', 403);
    }

    await lobbyRepository.delete(lobbyId);
    await redisService.invalidateLobbyCache(lobbyId);
    await redisService.deleteCountdownState(lobbyId);

    logger.info('Lobby deleted', { lobbyId, deletedBy: requesterId });
  }

  async setPlayerReady(lobbyId: string, playerId: string, ready: boolean): Promise<{ player: LobbyPlayer; allReady: boolean }> {
    const lobby = await lobbyRepository.findById(lobbyId);
    
    if (!lobby) {
      throw new LobbyServiceError('Lobby not found', 404);
    }

    if (lobby.status !== LobbyStatus.WAITING && lobby.status !== LobbyStatus.READY_CHECK) {
      throw new LobbyServiceError('Cannot change ready status - game already in progress');
    }

    const player = await lobbyRepository.setPlayerReady(lobbyId, playerId, ready);
    if (!player) {
      throw new LobbyServiceError('Player not in lobby', 404);
    }

    await redisService.invalidateLobbyCache(lobbyId);

    const allReady = await lobbyRepository.areAllPlayersReady(lobbyId);
    const playerCount = await lobbyRepository.getPlayerCount(lobbyId);

    logger.info('Player ready status changed', { lobbyId, playerId, ready, allReady });

    return { 
      player, 
      allReady: allReady && playerCount >= lobby.minPlayers 
    };
  }

  async updateLobbyStatus(lobbyId: string, status: LobbyStatus): Promise<Lobby> {
    const lobby = await lobbyRepository.update(lobbyId, { status });
    
    if (!lobby) {
      throw new LobbyServiceError('Lobby not found', 404);
    }

    await redisService.invalidateLobbyCache(lobbyId);
    logger.info('Lobby status updated', { lobbyId, status });
    return lobby;
  }

  async resetReadyStatus(lobbyId: string): Promise<void> {
    await lobbyRepository.resetAllPlayersReady(lobbyId);
    await redisService.invalidateLobbyCache(lobbyId);
    logger.info('Ready status reset for all players', { lobbyId });
  }

  async canStartGame(lobbyId: string): Promise<boolean> {
    const lobby = await lobbyRepository.findById(lobbyId);
    if (!lobby) return false;

    const playerCount = await lobbyRepository.getPlayerCount(lobbyId);
    const allReady = await lobbyRepository.areAllPlayersReady(lobbyId);

    return allReady && playerCount >= lobby.minPlayers;
  }
}

export const lobbyService = new LobbyService();
