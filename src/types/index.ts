export type SessionStatus = 'pending' | 'active' | 'paused' | 'completed' | 'cancelled' | 'abandoned';
export type PlayerSessionStatus = 'active' | 'disconnected' | 'reconnecting' | 'left' | 'kicked';
export type GameMode = 'solo' | 'duo' | 'squad' | 'custom';

export interface GameSession {
  id: string;
  lobbyId: string;
  gameMode: GameMode;
  status: SessionStatus;
  players: SessionPlayer[];
  settings: SessionSettings;
  startedAt: Date;
  endedAt?: Date;
  pausedAt?: Date;
  duration: number;
  winnerId?: string;
  winnerTeam?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionPlayer {
  id: string;
  sessionId: string;
  userId: string;
  username: string;
  team?: number;
  status: PlayerSessionStatus;
  reconnectionToken?: string;
  reconnectionExpiry?: Date;
  stats: PlayerStats;
  joinedAt: Date;
  leftAt?: Date;
  disconnectedAt?: Date;
}

export interface PlayerStats {
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  objectivesCompleted: number;
  timeAlive: number;
  customStats?: Record<string, number>;
}

export interface SessionSettings {
  maxDuration: number;
  allowReconnection: boolean;
  reconnectionTimeout: number;
  allowPause: boolean;
  maxPauseDuration: number;
  teamBased: boolean;
  scoreLimit?: number;
  timeLimit?: number;
  customRules?: Record<string, unknown>;
}

export interface MVPCalculation {
  playerId: string;
  score: number;
  breakdown: MVPBreakdown;
}

export interface MVPBreakdown {
  killScore: number;
  assistScore: number;
  objectiveScore: number;
  survivalScore: number;
  damageScore: number;
  healingScore: number;
  bonusScore: number;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionEventType;
  playerId?: string;
  data: unknown;
  timestamp: Date;
}

export type SessionEventType = 
  | 'session_start'
  | 'session_end'
  | 'session_pause'
  | 'session_resume'
  | 'player_join'
  | 'player_leave'
  | 'player_disconnect'
  | 'player_reconnect'
  | 'player_kill'
  | 'player_death'
  | 'objective_complete'
  | 'score_update'
  | 'custom_event';

export interface CreateSessionInput {
  lobbyId: string;
  gameMode: GameMode;
  players: {
    userId: string;
    username: string;
    team?: number;
  }[];
  settings?: Partial<SessionSettings>;
}

export interface UpdateStatsInput {
  sessionId: string;
  playerId: string;
  stats: Partial<PlayerStats>;
}

export interface ReconnectionToken {
  token: string;
  sessionId: string;
  playerId: string;
  userId: string;
  expiresAt: Date;
}

export interface SessionSummary {
  sessionId: string;
  duration: number;
  winner: {
    playerId?: string;
    team?: number;
  };
  mvp: MVPCalculation;
  playerStats: SessionPlayer[];
  events: SessionEvent[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  maxDuration: 3600000,
  allowReconnection: true,
  reconnectionTimeout: 120000,
  allowPause: false,
  maxPauseDuration: 300000,
  teamBased: false,
};

export const MVP_WEIGHTS = {
  kill: 100,
  assist: 50,
  death: -25,
  objective: 150,
  damagePerHundred: 10,
  healingPerHundred: 15,
  survivalPerMinute: 5,
};

export class SessionError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'SESSION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, SessionError.prototype);
  }
}

export class SessionNotFoundError extends SessionError {
  constructor() {
    super('Game session not found', 404, 'SESSION_NOT_FOUND');
  }
}

export class PlayerNotInSessionError extends SessionError {
  constructor() {
    super('Player is not in this session', 400, 'PLAYER_NOT_IN_SESSION');
  }
}

export class InvalidReconnectionTokenError extends SessionError {
  constructor() {
    super('Invalid or expired reconnection token', 401, 'INVALID_RECONNECTION_TOKEN');
  }
}

export class SessionAlreadyEndedError extends SessionError {
  constructor() {
    super('Session has already ended', 400, 'SESSION_ALREADY_ENDED');
  }
}
