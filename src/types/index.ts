export type LeaderboardType = 'global' | 'seasonal' | 'weekly' | 'daily' | 'custom';
export type LeaderboardCategory = 'score' | 'kills' | 'wins' | 'playtime' | 'achievements' | 'custom';
export type DecayType = 'none' | 'linear' | 'exponential' | 'logarithmic';

export interface Leaderboard {
  id: string;
  name: string;
  type: LeaderboardType;
  category: LeaderboardCategory;
  gameMode?: string;
  seasonId?: string;
  decayConfig: DecayConfig;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecayConfig {
  type: DecayType;
  rate: number;
  interval: number;
  minScore: number;
  maxInactivityDays: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  score: number;
  previousRank?: number;
  rankChange?: number;
  metadata?: Record<string, unknown>;
  lastUpdatedAt: Date;
}

export interface UserRanking {
  leaderboardId: string;
  userId: string;
  username: string;
  score: number;
  rank: number;
  percentile: number;
  previousRank?: number;
  rankChange?: number;
  metadata?: Record<string, unknown>;
}

export interface ScoreUpdate {
  leaderboardId: string;
  userId: string;
  username: string;
  score: number;
  increment?: boolean;
  metadata?: Record<string, unknown>;
}

export interface LeaderboardSnapshot {
  id: string;
  leaderboardId: string;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  snapshotAt: Date;
}

export interface CreateLeaderboardInput {
  name: string;
  type: LeaderboardType;
  category: LeaderboardCategory;
  gameMode?: string;
  seasonId?: string;
  decayConfig?: Partial<DecayConfig>;
  startsAt?: Date;
  endsAt?: Date;
}

export interface GetLeaderboardOptions {
  start?: number;
  count?: number;
  withScores?: boolean;
  aroundUser?: string;
  aroundRange?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  type: 'none',
  rate: 0,
  interval: 86400000,
  minScore: 0,
  maxInactivityDays: 30,
};

export const REDIS_KEY_PREFIX = 'leaderboard:';
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;

export class LeaderboardError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'LEADERBOARD_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, LeaderboardError.prototype);
  }
}

export class LeaderboardNotFoundError extends LeaderboardError {
  constructor() {
    super('Leaderboard not found', 404, 'LEADERBOARD_NOT_FOUND');
  }
}

export class UserNotRankedError extends LeaderboardError {
  constructor() {
    super('User is not ranked on this leaderboard', 404, 'USER_NOT_RANKED');
  }
}

export class LeaderboardInactiveError extends LeaderboardError {
  constructor() {
    super('Leaderboard is not active', 400, 'LEADERBOARD_INACTIVE');
  }
}
