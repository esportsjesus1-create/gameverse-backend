export enum SessionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended'
}

export enum PlayerConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting'
}

export interface GameSession {
  id: string;
  gameType: string;
  status: SessionStatus;
  startedAt: Date | null;
  pausedAt: Date | null;
  endedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionPlayer {
  id: string;
  sessionId: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  connectionStatus: PlayerConnectionStatus;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface PlayerStats {
  id: string;
  sessionId: string;
  playerId: string;
  kills: number;
  deaths: number;
  assists: number;
  damageDealt: number;
  damageReceived: number;
  objectivesCompleted: number;
  score: number;
  customStats: Record<string, number>;
  updatedAt: Date;
}

export interface MVPResult {
  playerId: string;
  playerName: string;
  totalScore: number;
  breakdown: {
    killScore: number;
    assistScore: number;
    objectiveScore: number;
    damageScore: number;
    survivalScore: number;
  };
}

export interface ReconnectionToken {
  token: string;
  sessionId: string;
  playerId: string;
  createdAt: number;
  expiresAt: number;
}

export interface CreateSessionRequest {
  gameType: string;
  players: Array<{
    playerId: string;
    playerName: string;
    teamId?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface UpdatePlayerStatsRequest {
  kills?: number;
  deaths?: number;
  assists?: number;
  damageDealt?: number;
  damageReceived?: number;
  objectivesCompleted?: number;
  customStats?: Record<string, number>;
}

export interface ReconnectRequest {
  token: string;
  playerId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
