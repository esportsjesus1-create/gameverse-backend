import { z } from 'zod';

export enum LeaderboardType {
  GLOBAL = 'GLOBAL',
  SEASONAL = 'SEASONAL',
  REGIONAL = 'REGIONAL',
  FRIEND = 'FRIEND',
  TOURNAMENT = 'TOURNAMENT',
  CUSTOM = 'CUSTOM',
}

export enum RankingPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  SEASONAL = 'SEASONAL',
  ALL_TIME = 'ALL_TIME',
}

export enum RankTier {
  UNRANKED = 'UNRANKED',
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
  MASTER = 'MASTER',
  GRANDMASTER = 'GRANDMASTER',
  CHALLENGER = 'CHALLENGER',
  LEGEND = 'LEGEND',
}

export enum TierDivision {
  IV = 4,
  III = 3,
  II = 2,
  I = 1,
}

export enum ScoreSubmissionStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  DISPUTED = 'DISPUTED',
  ROLLED_BACK = 'ROLLED_BACK',
}

export enum RankChangeType {
  PROMOTION = 'PROMOTION',
  DEMOTION = 'DEMOTION',
  TIER_UP = 'TIER_UP',
  TIER_DOWN = 'TIER_DOWN',
  SCORE_UPDATE = 'SCORE_UPDATE',
  DECAY = 'DECAY',
  RESET = 'RESET',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum Region {
  NA = 'NA',
  EU = 'EU',
  ASIA = 'ASIA',
  OCE = 'OCE',
  SA = 'SA',
  MENA = 'MENA',
  SEA = 'SEA',
  JP = 'JP',
  KR = 'KR',
  CN = 'CN',
  GLOBAL = 'GLOBAL',
}

export enum GameMode {
  RANKED = 'RANKED',
  CASUAL = 'CASUAL',
  COMPETITIVE = 'COMPETITIVE',
  TOURNAMENT = 'TOURNAMENT',
  CUSTOM = 'CUSTOM',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum SortField {
  RANK = 'RANK',
  SCORE = 'SCORE',
  WINS = 'WINS',
  WIN_RATE = 'WIN_RATE',
  MMR = 'MMR',
  GAMES_PLAYED = 'GAMES_PLAYED',
  LAST_ACTIVE = 'LAST_ACTIVE',
}

export const LeaderboardEntrySchema = z.object({
  id: z.string().uuid(),
  leaderboardId: z.string().uuid(),
  playerId: z.string().uuid(),
  playerName: z.string().min(1).max(50),
  playerAvatar: z.string().url().optional(),
  rank: z.number().int().positive(),
  previousRank: z.number().int().positive().optional(),
  rankChange: z.number().int().optional(),
  score: z.number().int().min(0),
  tier: z.nativeEnum(RankTier),
  division: z.nativeEnum(TierDivision).optional(),
  mmr: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  draws: z.number().int().min(0).default(0),
  winRate: z.number().min(0).max(100),
  gamesPlayed: z.number().int().min(0),
  winStreak: z.number().int().min(0).default(0),
  bestWinStreak: z.number().int().min(0).default(0),
  region: z.nativeEnum(Region).optional(),
  gameId: z.string().uuid().optional(),
  seasonId: z.string().uuid().optional(),
  lastActiveAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const LeaderboardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(LeaderboardType),
  period: z.nativeEnum(RankingPeriod),
  gameId: z.string().uuid().optional(),
  seasonId: z.string().uuid().optional(),
  region: z.nativeEnum(Region).optional(),
  gameMode: z.nativeEnum(GameMode).optional(),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  maxEntries: z.number().int().positive().default(10000),
  resetSchedule: z.string().optional(),
  lastResetAt: z.date().optional(),
  nextResetAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const ScoreSubmissionSchema = z.object({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  leaderboardId: z.string().uuid(),
  score: z.number().int().min(0),
  previousScore: z.number().int().min(0).optional(),
  scoreDelta: z.number().int().optional(),
  gameId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  status: z.nativeEnum(ScoreSubmissionStatus),
  validationChecksum: z.string().optional(),
  validationData: z.record(z.unknown()).optional(),
  antiCheatScore: z.number().min(0).max(100).optional(),
  submittedAt: z.date(),
  validatedAt: z.date().optional(),
  approvedAt: z.date().optional(),
  rejectedAt: z.date().optional(),
  rejectionReason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const RankHistorySchema = z.object({
  id: z.string().uuid(),
  playerId: z.string().uuid(),
  leaderboardId: z.string().uuid(),
  rank: z.number().int().positive(),
  previousRank: z.number().int().positive().optional(),
  score: z.number().int().min(0),
  previousScore: z.number().int().min(0).optional(),
  tier: z.nativeEnum(RankTier),
  previousTier: z.nativeEnum(RankTier).optional(),
  division: z.nativeEnum(TierDivision).optional(),
  previousDivision: z.nativeEnum(TierDivision).optional(),
  changeType: z.nativeEnum(RankChangeType),
  changeReason: z.string().optional(),
  snapshotAt: z.date(),
  createdAt: z.date(),
});

export const PlayerRankingSchema = z.object({
  playerId: z.string().uuid(),
  playerName: z.string().min(1).max(50),
  playerAvatar: z.string().url().optional(),
  globalRank: z.number().int().positive().optional(),
  seasonalRank: z.number().int().positive().optional(),
  regionalRank: z.number().int().positive().optional(),
  friendRank: z.number().int().positive().optional(),
  totalScore: z.number().int().min(0),
  tier: z.nativeEnum(RankTier),
  division: z.nativeEnum(TierDivision).optional(),
  mmr: z.number().int().min(0),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winRate: z.number().min(0).max(100),
  gamesPlayed: z.number().int().min(0),
  region: z.nativeEnum(Region).optional(),
  seasonId: z.string().uuid().optional(),
  lastActiveAt: z.date(),
});

export const FriendRankingSchema = z.object({
  playerId: z.string().uuid(),
  friendId: z.string().uuid(),
  friendName: z.string().min(1).max(50),
  friendAvatar: z.string().url().optional(),
  rank: z.number().int().positive(),
  score: z.number().int().min(0),
  tier: z.nativeEnum(RankTier),
  division: z.nativeEnum(TierDivision).optional(),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  winRate: z.number().min(0).max(100),
  headToHeadWins: z.number().int().min(0).default(0),
  headToHeadLosses: z.number().int().min(0).default(0),
  lastPlayedAt: z.date().optional(),
});

export const LeaderboardQuerySchema = z.object({
  leaderboardId: z.string().uuid().optional(),
  type: z.nativeEnum(LeaderboardType).optional(),
  period: z.nativeEnum(RankingPeriod).optional(),
  gameId: z.string().uuid().optional(),
  seasonId: z.string().uuid().optional(),
  region: z.nativeEnum(Region).optional(),
  gameMode: z.nativeEnum(GameMode).optional(),
  tier: z.nativeEnum(RankTier).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).optional(),
  cursor: z.string().optional(),
  sortBy: z.nativeEnum(SortField).default(SortField.RANK),
  sortOrder: z.nativeEnum(SortOrder).default(SortOrder.ASC),
  search: z.string().max(100).optional(),
  minScore: z.number().int().min(0).optional(),
  maxScore: z.number().int().min(0).optional(),
  minRank: z.number().int().positive().optional(),
  maxRank: z.number().int().positive().optional(),
});

export const ScoreSubmissionRequestSchema = z.object({
  playerId: z.string().uuid(),
  leaderboardId: z.string().uuid().optional(),
  score: z.number().int().min(0),
  gameId: z.string().uuid().optional(),
  matchId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  gameMode: z.nativeEnum(GameMode).optional(),
  region: z.nativeEnum(Region).optional(),
  validationChecksum: z.string().optional(),
  validationData: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const BatchScoreSubmissionSchema = z.object({
  submissions: z.array(ScoreSubmissionRequestSchema).min(1).max(100),
  tournamentId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
});

export const RankContextQuerySchema = z.object({
  playerId: z.string().uuid(),
  leaderboardId: z.string().uuid().optional(),
  contextSize: z.number().int().min(1).max(50).default(5),
});

export const FriendLeaderboardQuerySchema = z.object({
  playerId: z.string().uuid(),
  gameId: z.string().uuid().optional(),
  seasonId: z.string().uuid().optional(),
  period: z.nativeEnum(RankingPeriod).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(50),
  includeMutual: z.boolean().default(false),
  groupId: z.string().uuid().optional(),
});

export const PlayerComparisonSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  leaderboardId: z.string().uuid().optional(),
  gameId: z.string().uuid().optional(),
  seasonId: z.string().uuid().optional(),
});

export const ScoreDisputeSchema = z.object({
  submissionId: z.string().uuid(),
  playerId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  evidence: z.array(z.string().url()).max(5).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AdminScoreActionSchema = z.object({
  submissionId: z.string().uuid(),
  adminId: z.string().uuid(),
  action: z.enum(['APPROVE', 'REJECT', 'ROLLBACK']),
  reason: z.string().min(1).max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const LeaderboardSnapshotSchema = z.object({
  id: z.string().uuid(),
  leaderboardId: z.string().uuid(),
  snapshotType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'SEASONAL', 'MANUAL']),
  totalEntries: z.number().int().min(0),
  topEntries: z.array(LeaderboardEntrySchema).max(100),
  statistics: z.object({
    averageScore: z.number(),
    medianScore: z.number(),
    highestScore: z.number(),
    lowestScore: z.number(),
    totalPlayers: z.number().int(),
    activePlayers: z.number().int(),
    tierDistribution: z.record(z.nativeEnum(RankTier), z.number().int()),
    regionDistribution: z.record(z.nativeEnum(Region), z.number().int()).optional(),
  }),
  snapshotAt: z.date(),
  createdAt: z.date(),
});

export const RealTimeUpdateSchema = z.object({
  type: z.enum(['RANK_CHANGE', 'SCORE_UPDATE', 'NEW_ENTRY', 'ENTRY_REMOVED', 'LEADERBOARD_RESET']),
  leaderboardId: z.string().uuid(),
  playerId: z.string().uuid().optional(),
  data: z.record(z.unknown()),
  timestamp: z.date(),
});

export const WebSocketSubscriptionSchema = z.object({
  action: z.enum(['SUBSCRIBE', 'UNSUBSCRIBE']),
  leaderboardIds: z.array(z.string().uuid()).min(1).max(10),
  playerId: z.string().uuid().optional(),
  filters: z.object({
    minRank: z.number().int().positive().optional(),
    maxRank: z.number().int().positive().optional(),
    tier: z.nativeEnum(RankTier).optional(),
    region: z.nativeEnum(Region).optional(),
  }).optional(),
});

export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
export type ScoreSubmission = z.infer<typeof ScoreSubmissionSchema>;
export type RankHistory = z.infer<typeof RankHistorySchema>;
export type PlayerRanking = z.infer<typeof PlayerRankingSchema>;
export type FriendRanking = z.infer<typeof FriendRankingSchema>;
export type LeaderboardQuery = z.infer<typeof LeaderboardQuerySchema>;
export type ScoreSubmissionRequest = z.infer<typeof ScoreSubmissionRequestSchema>;
export type BatchScoreSubmission = z.infer<typeof BatchScoreSubmissionSchema>;
export type RankContextQuery = z.infer<typeof RankContextQuerySchema>;
export type FriendLeaderboardQuery = z.infer<typeof FriendLeaderboardQuerySchema>;
export type PlayerComparison = z.infer<typeof PlayerComparisonSchema>;
export type ScoreDispute = z.infer<typeof ScoreDisputeSchema>;
export type AdminScoreAction = z.infer<typeof AdminScoreActionSchema>;
export type LeaderboardSnapshot = z.infer<typeof LeaderboardSnapshotSchema>;
export type RealTimeUpdate = z.infer<typeof RealTimeUpdateSchema>;
export type WebSocketSubscription = z.infer<typeof WebSocketSubscriptionSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
  cursor?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  message?: string;
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
  };
}

export interface LeaderboardStatistics {
  leaderboardId: string;
  totalPlayers: number;
  activePlayers: number;
  averageScore: number;
  medianScore: number;
  highestScore: number;
  lowestScore: number;
  averageMMR: number;
  tierDistribution: Record<RankTier, number>;
  regionDistribution?: Record<Region, number>;
  gameModeDistribution?: Record<GameMode, number>;
  lastUpdatedAt: Date;
}

export interface PlayerContext {
  player: LeaderboardEntry;
  above: LeaderboardEntry[];
  below: LeaderboardEntry[];
  totalPlayers: number;
  percentile: number;
}

export interface HeadToHeadComparison {
  player1: PlayerRanking;
  player2: PlayerRanking;
  headToHead: {
    player1Wins: number;
    player2Wins: number;
    draws: number;
    lastMatchAt?: Date;
  };
  rankDifference: number;
  scoreDifference: number;
  mmrDifference: number;
}

export interface SeasonalRewardPreview {
  playerId: string;
  seasonId: string;
  currentRank: number;
  currentTier: RankTier;
  currentDivision?: TierDivision;
  projectedRewards: {
    rewardId: string;
    rewardName: string;
    rewardType: string;
    quantity: number;
    isGuaranteed: boolean;
  }[];
  rankToNextReward?: number;
  nextRewardTier?: RankTier;
}

export interface DecayStatus {
  playerId: string;
  leaderboardId: string;
  isDecaying: boolean;
  decayStartAt?: Date;
  lastActivityAt: Date;
  daysUntilDecay: number;
  decayAmount: number;
  isProtected: boolean;
  protectionExpiresAt?: Date;
}

export interface RankNotificationSettings {
  playerId: string;
  enableRankChangeNotifications: boolean;
  enableFriendRankNotifications: boolean;
  enableMilestoneNotifications: boolean;
  enableDecayWarnings: boolean;
  notificationThreshold: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

export interface FriendChallenge {
  id: string;
  challengerId: string;
  challengedId: string;
  leaderboardId: string;
  targetScore: number;
  currentChallengerScore: number;
  currentChallengedScore: number;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  winnerId?: string;
  expiresAt: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface FriendGroup {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityFeedItem {
  id: string;
  playerId: string;
  playerName: string;
  type: 'RANK_UP' | 'RANK_DOWN' | 'TIER_UP' | 'TIER_DOWN' | 'NEW_HIGH_SCORE' | 'MILESTONE' | 'CHALLENGE_WON';
  data: Record<string, unknown>;
  leaderboardId: string;
  timestamp: Date;
}
