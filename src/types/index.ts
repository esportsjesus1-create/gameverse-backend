export type LobbyStatus = 'waiting' | 'ready_check' | 'countdown' | 'starting' | 'in_game' | 'closed';
export type PlayerStatus = 'joined' | 'ready' | 'not_ready' | 'disconnected';
export type LobbyType = 'public' | 'private' | 'ranked' | 'custom';
export type GameMode = 'solo' | 'duo' | 'squad' | 'custom';

export interface Lobby {
  id: string;
  name: string;
  hostId: string;
  type: LobbyType;
  gameMode: GameMode;
  status: LobbyStatus;
  maxPlayers: number;
  minPlayers: number;
  players: LobbyPlayer[];
  settings: LobbySettings;
  inviteCode?: string;
  readyCheckStartedAt?: Date;
  countdownStartedAt?: Date;
  gameSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LobbyPlayer {
  id: string;
  lobbyId: string;
  userId: string;
  username: string;
  status: PlayerStatus;
  team?: number;
  slot: number;
  isHost: boolean;
  joinedAt: Date;
  readyAt?: Date;
  disconnectedAt?: Date;
}

export interface LobbySettings {
  isPrivate: boolean;
  allowSpectators: boolean;
  autoStart: boolean;
  readyCheckTimeout: number;
  countdownDuration: number;
  teamSize?: number;
  mapId?: string;
  customRules?: Record<string, unknown>;
}

export interface LobbyInvite {
  id: string;
  lobbyId: string;
  inviterId: string;
  inviteeId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateLobbyInput {
  name: string;
  hostId: string;
  type: LobbyType;
  gameMode: GameMode;
  maxPlayers: number;
  minPlayers?: number;
  settings?: Partial<LobbySettings>;
}

export interface JoinLobbyInput {
  lobbyId: string;
  userId: string;
  username: string;
  inviteCode?: string;
}

export type WebSocketMessageType = 
  | 'lobby:join'
  | 'lobby:leave'
  | 'lobby:ready'
  | 'lobby:unready'
  | 'lobby:kick'
  | 'lobby:settings'
  | 'lobby:chat'
  | 'lobby:invite'
  | 'lobby:start'
  | 'lobby:update'
  | 'lobby:player_joined'
  | 'lobby:player_left'
  | 'lobby:player_ready'
  | 'lobby:player_unready'
  | 'lobby:ready_check'
  | 'lobby:countdown'
  | 'lobby:game_starting'
  | 'lobby:error'
  | 'ping'
  | 'pong';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: unknown;
  timestamp: number;
  requestId?: string;
}

export interface LobbyEvent {
  type: string;
  lobbyId: string;
  userId?: string;
  data: unknown;
  timestamp: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DEFAULT_LOBBY_SETTINGS: LobbySettings = {
  isPrivate: false,
  allowSpectators: false,
  autoStart: true,
  readyCheckTimeout: 30000,
  countdownDuration: 5000,
};

export const MAX_LOBBY_PLAYERS = 100;
export const MIN_LOBBY_PLAYERS = 2;
export const READY_CHECK_TIMEOUT = 30000;
export const COUNTDOWN_DURATION = 5000;

export class LobbyError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'LOBBY_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, LobbyError.prototype);
  }
}

export class LobbyFullError extends LobbyError {
  constructor() {
    super('Lobby is full', 400, 'LOBBY_FULL');
  }
}

export class LobbyNotFoundError extends LobbyError {
  constructor() {
    super('Lobby not found', 404, 'LOBBY_NOT_FOUND');
  }
}

export class PlayerNotInLobbyError extends LobbyError {
  constructor() {
    super('Player is not in this lobby', 400, 'PLAYER_NOT_IN_LOBBY');
  }
}

export class UnauthorizedError extends LobbyError {
  constructor(message: string = 'Unauthorized action') {
    super(message, 403, 'UNAUTHORIZED');
  }
}
