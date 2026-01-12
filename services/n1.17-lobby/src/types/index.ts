export enum LobbyStatus {
  WAITING = 'waiting',
  READY_CHECK = 'ready_check',
  COUNTDOWN = 'countdown',
  IN_GAME = 'in_game',
  CLOSED = 'closed'
}

export enum PlayerReadyStatus {
  NOT_READY = 'not_ready',
  READY = 'ready'
}

export interface Lobby {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  minPlayers: number;
  status: LobbyStatus;
  gameType: string;
  countdownDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LobbyPlayer {
  lobbyId: string;
  playerId: string;
  readyStatus: PlayerReadyStatus;
  joinedAt: Date;
}

export interface LobbyWithPlayers extends Lobby {
  players: LobbyPlayer[];
}

export interface CreateLobbyRequest {
  name: string;
  hostId: string;
  maxPlayers?: number;
  minPlayers?: number;
  gameType: string;
  countdownDuration?: number;
}

export interface JoinLobbyRequest {
  playerId: string;
}

export interface LeaveLobbyRequest {
  playerId: string;
}

export interface SetReadyRequest {
  playerId: string;
  ready: boolean;
}

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload: unknown;
  lobbyId?: string;
  playerId?: string;
  timestamp: string;
}

export enum WebSocketEventType {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  JOIN_LOBBY = 'join_lobby',
  LEAVE_LOBBY = 'leave_lobby',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  READY_STATUS_CHANGED = 'ready_status_changed',
  ALL_PLAYERS_READY = 'all_players_ready',
  COUNTDOWN_STARTED = 'countdown_started',
  COUNTDOWN_TICK = 'countdown_tick',
  COUNTDOWN_CANCELLED = 'countdown_cancelled',
  GAME_STARTING = 'game_starting',
  LOBBY_UPDATED = 'lobby_updated',
  LOBBY_CLOSED = 'lobby_closed',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong'
}

export interface CountdownState {
  lobbyId: string;
  startedAt: number;
  duration: number;
  remaining: number;
  active: boolean;
}

export interface WebSocketClient {
  playerId: string;
  lobbyId: string | null;
  isAlive: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number;
  limit: number;
  total: number;
}

export interface LobbyFilters {
  status?: LobbyStatus;
  gameType?: string;
  hasSpace?: boolean;
}
