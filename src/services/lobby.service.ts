import { v4 as uuidv4 } from 'uuid';
import {
  Lobby,
  LobbyPlayer,
  LobbySettings,
  LobbyStatus,
  CreateLobbyInput,
  JoinLobbyInput,
  PaginatedResult,
  DEFAULT_LOBBY_SETTINGS,
  LobbyError,
  LobbyFullError,
  LobbyNotFoundError,
  PlayerNotInLobbyError,
  UnauthorizedError,
} from '../types';
import { config } from '../config';

const lobbies: Map<string, Lobby> = new Map();
const playerLobbyMap: Map<string, string> = new Map();

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < config.lobby.inviteCodeLength; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export class LobbyService {
  async createLobby(input: CreateLobbyInput): Promise<Lobby> {
    const existingLobby = playerLobbyMap.get(input.hostId);
    if (existingLobby) {
      throw new LobbyError('Player is already in a lobby', 400, 'ALREADY_IN_LOBBY');
    }

    const lobbyId = uuidv4();
    const now = new Date();

    const settings: LobbySettings = {
      ...DEFAULT_LOBBY_SETTINGS,
      ...input.settings,
      isPrivate: input.type === 'private',
    };

    const hostPlayer: LobbyPlayer = {
      id: uuidv4(),
      lobbyId,
      userId: input.hostId,
      username: input.hostId,
      status: 'joined',
      slot: 0,
      isHost: true,
      joinedAt: now,
    };

    const lobby: Lobby = {
      id: lobbyId,
      name: input.name,
      hostId: input.hostId,
      type: input.type,
      gameMode: input.gameMode,
      status: 'waiting',
      maxPlayers: input.maxPlayers,
      minPlayers: input.minPlayers || config.lobby.minPlayersDefault,
      players: [hostPlayer],
      settings,
      inviteCode: input.type === 'private' ? generateInviteCode() : undefined,
      createdAt: now,
      updatedAt: now,
    };

    lobbies.set(lobbyId, lobby);
    playerLobbyMap.set(input.hostId, lobbyId);

    return lobby;
  }

  async getLobbyById(id: string): Promise<Lobby | null> {
    return lobbies.get(id) || null;
  }

  async getLobbyByInviteCode(code: string): Promise<Lobby | null> {
    return Array.from(lobbies.values()).find(l => l.inviteCode === code) || null;
  }

  async getPublicLobbies(page = 1, limit = 20): Promise<PaginatedResult<Lobby>> {
    const publicLobbies = Array.from(lobbies.values())
      .filter(l => l.type === 'public' && l.status === 'waiting')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = publicLobbies.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = publicLobbies.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  async joinLobby(input: JoinLobbyInput): Promise<{ lobby: Lobby; player: LobbyPlayer }> {
    const existingLobby = playerLobbyMap.get(input.userId);
    if (existingLobby) {
      throw new LobbyError('Player is already in a lobby', 400, 'ALREADY_IN_LOBBY');
    }

    const lobby = lobbies.get(input.lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    if (lobby.status !== 'waiting') {
      throw new LobbyError('Lobby is not accepting players', 400, 'LOBBY_NOT_ACCEPTING');
    }

    if (lobby.players.length >= lobby.maxPlayers) {
      throw new LobbyFullError();
    }

    if (lobby.type === 'private' && lobby.inviteCode !== input.inviteCode) {
      throw new UnauthorizedError('Invalid invite code');
    }

    const usedSlots = new Set(lobby.players.map(p => p.slot));
    let slot = 0;
    while (usedSlots.has(slot)) slot++;

    const player: LobbyPlayer = {
      id: uuidv4(),
      lobbyId: lobby.id,
      userId: input.userId,
      username: input.username,
      status: 'joined',
      slot,
      isHost: false,
      joinedAt: new Date(),
    };

    lobby.players.push(player);
    lobby.updatedAt = new Date();
    playerLobbyMap.set(input.userId, lobby.id);

    return { lobby, player };
  }

  async leaveLobby(lobbyId: string, userId: string): Promise<Lobby | null> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    const playerIndex = lobby.players.findIndex(p => p.userId === userId);
    if (playerIndex === -1) {
      throw new PlayerNotInLobbyError();
    }

    const player = lobby.players[playerIndex];
    lobby.players.splice(playerIndex, 1);
    playerLobbyMap.delete(userId);

    if (lobby.players.length === 0) {
      lobbies.delete(lobbyId);
      return null;
    }

    if (player.isHost && lobby.players.length > 0) {
      const newHost = lobby.players.reduce((oldest, p) => 
        p.joinedAt < oldest.joinedAt ? p : oldest
      );
      newHost.isHost = true;
      lobby.hostId = newHost.userId;
    }

    lobby.updatedAt = new Date();
    return lobby;
  }

  async kickPlayer(lobbyId: string, hostId: string, targetUserId: string): Promise<Lobby> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    if (lobby.hostId !== hostId) {
      throw new UnauthorizedError('Only the host can kick players');
    }

    if (hostId === targetUserId) {
      throw new LobbyError('Cannot kick yourself', 400, 'CANNOT_KICK_SELF');
    }

    const playerIndex = lobby.players.findIndex(p => p.userId === targetUserId);
    if (playerIndex === -1) {
      throw new PlayerNotInLobbyError();
    }

    lobby.players.splice(playerIndex, 1);
    playerLobbyMap.delete(targetUserId);
    lobby.updatedAt = new Date();

    return lobby;
  }

  async setPlayerReady(lobbyId: string, userId: string, ready: boolean): Promise<Lobby> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    const player = lobby.players.find(p => p.userId === userId);
    if (!player) {
      throw new PlayerNotInLobbyError();
    }

    player.status = ready ? 'ready' : 'joined';
    player.readyAt = ready ? new Date() : undefined;
    lobby.updatedAt = new Date();

    return lobby;
  }

  async startReadyCheck(lobbyId: string, hostId: string): Promise<Lobby> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    if (lobby.hostId !== hostId) {
      throw new UnauthorizedError('Only the host can start ready check');
    }

    if (lobby.status !== 'waiting') {
      throw new LobbyError('Lobby is not in waiting state', 400, 'INVALID_STATE');
    }

    if (lobby.players.length < lobby.minPlayers) {
      throw new LobbyError(`Need at least ${lobby.minPlayers} players`, 400, 'NOT_ENOUGH_PLAYERS');
    }

    lobby.status = 'ready_check';
    lobby.readyCheckStartedAt = new Date();
    lobby.players.forEach(p => {
      if (!p.isHost) p.status = 'not_ready';
    });
    lobby.updatedAt = new Date();

    return lobby;
  }

  async checkReadyStatus(lobbyId: string): Promise<{ allReady: boolean; lobby: Lobby }> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    const allReady = lobby.players.every(p => p.status === 'ready' || p.isHost);
    return { allReady, lobby };
  }

  async startCountdown(lobbyId: string): Promise<Lobby> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    lobby.status = 'countdown';
    lobby.countdownStartedAt = new Date();
    lobby.updatedAt = new Date();

    return lobby;
  }

  async startGame(lobbyId: string, gameSessionId: string): Promise<Lobby> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    lobby.status = 'in_game';
    lobby.gameSessionId = gameSessionId;
    lobby.updatedAt = new Date();

    return lobby;
  }

  async closeLobby(lobbyId: string): Promise<void> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.players.forEach(p => playerLobbyMap.delete(p.userId));
    lobbies.delete(lobbyId);
  }

  async updateSettings(lobbyId: string, hostId: string, settings: Partial<LobbySettings>): Promise<Lobby> {
    const lobby = lobbies.get(lobbyId);
    if (!lobby) {
      throw new LobbyNotFoundError();
    }

    if (lobby.hostId !== hostId) {
      throw new UnauthorizedError('Only the host can update settings');
    }

    lobby.settings = { ...lobby.settings, ...settings };
    lobby.updatedAt = new Date();

    return lobby;
  }

  async getPlayerLobby(userId: string): Promise<Lobby | null> {
    const lobbyId = playerLobbyMap.get(userId);
    if (!lobbyId) return null;
    return lobbies.get(lobbyId) || null;
  }

  async handleDisconnect(userId: string): Promise<{ lobby: Lobby | null; removed: boolean }> {
    const lobbyId = playerLobbyMap.get(userId);
    if (!lobbyId) return { lobby: null, removed: false };

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return { lobby: null, removed: false };

    const player = lobby.players.find(p => p.userId === userId);
    if (player) {
      player.status = 'disconnected';
      player.disconnectedAt = new Date();
    }

    return { lobby, removed: false };
  }

  async handleReconnect(userId: string): Promise<Lobby | null> {
    const lobbyId = playerLobbyMap.get(userId);
    if (!lobbyId) return null;

    const lobby = lobbies.get(lobbyId);
    if (!lobby) return null;

    const player = lobby.players.find(p => p.userId === userId);
    if (player && player.status === 'disconnected') {
      player.status = 'joined';
      player.disconnectedAt = undefined;
    }

    return lobby;
  }

  getActiveLobbiesCount(): number {
    return lobbies.size;
  }

  getActivePlayersCount(): number {
    return playerLobbyMap.size;
  }
}

export const lobbyService = new LobbyService();
