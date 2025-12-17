export interface Player {
  id: string;
  username: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Score {
  id: string;
  playerId: string;
  gameId: string;
  rawScore: number;
  decayedScore: number;
  submittedAt: Date;
  lastDecayAt: Date;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  score: number;
  rawScore: number;
  submittedAt: Date;
}

export interface PaginatedLeaderboard {
  entries: LeaderboardEntry[];
  pagination: {
    page: number;
    pageSize: number;
    totalEntries: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface SubmitScoreRequest {
  playerId: string;
  gameId: string;
  score: number;
}

export interface LeaderboardQueryParams {
  gameId: string;
  page?: number;
  pageSize?: number;
}

export interface PlayerRankResponse {
  playerId: string;
  username: string;
  rank: number;
  score: number;
  rawScore: number;
  percentile: number;
}

export interface DecayConfig {
  halfLifeDays: number;
  minScore: number;
  decayIntervalHours: number;
}
