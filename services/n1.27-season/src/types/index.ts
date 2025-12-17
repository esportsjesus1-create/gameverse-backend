export enum RankedTier {
  BRONZE = 'BRONZE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
  DIAMOND = 'DIAMOND',
  MASTER = 'MASTER',
  GRANDMASTER = 'GRANDMASTER',
  CHALLENGER = 'CHALLENGER',
}

export enum TierDivision {
  IV = 4,
  III = 3,
  II = 2,
  I = 1,
}

export interface TierThreshold {
  tier: RankedTier;
  minMMR: number;
  maxMMR: number;
  hasDivisions: boolean;
}

export interface PlayerRank {
  tier: RankedTier;
  division: TierDivision | null;
  mmr: number;
  leaguePoints: number;
  wins: number;
  losses: number;
  winStreak: number;
  lossStreak: number;
  isInPromos: boolean;
  promoWins: number;
  promoLosses: number;
}

export interface Season {
  id: string;
  name: string;
  number: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  softResetFactor: number;
  placementMatchesRequired: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerSeason {
  id: string;
  playerId: string;
  seasonId: string;
  mmr: number;
  peakMmr: number;
  tier: RankedTier;
  division: TierDivision | null;
  leaguePoints: number;
  wins: number;
  losses: number;
  placementMatchesPlayed: number;
  placementMatchesWon: number;
  isPlacementComplete: boolean;
  winStreak: number;
  lossStreak: number;
  isInPromos: boolean;
  promoWins: number;
  promoLosses: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatchResult {
  id: string;
  playerId: string;
  seasonId: string;
  opponentId: string;
  playerMmrBefore: number;
  playerMmrAfter: number;
  opponentMmrBefore: number;
  opponentMmrAfter: number;
  isWin: boolean;
  mmrChange: number;
  isPlacementMatch: boolean;
  gameMode: string;
  createdAt: Date;
}

export interface MMRCalculationParams {
  playerMmr: number;
  opponentMmr: number;
  isWin: boolean;
  kFactor: number;
  gamesPlayed: number;
  winStreak: number;
  lossStreak: number;
}

export interface MMRCalculationResult {
  newMmr: number;
  mmrChange: number;
  expectedScore: number;
  actualScore: number;
}

export interface SoftResetParams {
  currentMmr: number;
  baseMmr: number;
  resetFactor: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  tier: RankedTier;
  division: TierDivision | null;
  leaguePoints: number;
  mmr: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface SeasonResetResult {
  playerId: string;
  previousMmr: number;
  newMmr: number;
  previousTier: RankedTier;
  newTier: RankedTier;
  previousDivision: TierDivision | null;
  newDivision: TierDivision | null;
}

export interface CreateSeasonDTO {
  name: string;
  number: number;
  startDate: Date;
  softResetFactor?: number;
  placementMatchesRequired?: number;
}

export interface UpdateMMRDTO {
  playerId: string;
  opponentId: string;
  isWin: boolean;
  gameMode?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export enum RewardType {
  CURRENCY = 'CURRENCY',
  SKIN = 'SKIN',
  BORDER = 'BORDER',
  ICON = 'ICON',
  EMOTE = 'EMOTE',
  TITLE = 'TITLE',
  CHEST = 'CHEST',
}

export enum MilestoneType {
  FIRST_WIN = 'FIRST_WIN',
  WIN_STREAK = 'WIN_STREAK',
  GAMES_PLAYED = 'GAMES_PLAYED',
  TIER_REACHED = 'TIER_REACHED',
  PEAK_MMR = 'PEAK_MMR',
  PLACEMENT_COMPLETE = 'PLACEMENT_COMPLETE',
  SEASON_COMPLETE = 'SEASON_COMPLETE',
}

export interface SeasonReward {
  id: string;
  seasonId: string;
  tier: RankedTier;
  rewardType: RewardType;
  rewardId: string;
  rewardName: string;
  rewardDescription: string;
  quantity: number;
  isExclusive: boolean;
  createdAt: Date;
}

export interface PlayerReward {
  id: string;
  playerId: string;
  seasonId: string;
  rewardId: string;
  rewardType: RewardType;
  rewardName: string;
  earnedTier: RankedTier;
  claimedAt: Date | null;
  createdAt: Date;
}

export interface PlayerMilestone {
  id: string;
  playerId: string;
  seasonId: string;
  milestoneType: MilestoneType;
  milestoneValue: number;
  achievedAt: Date;
  rewardClaimed: boolean;
  createdAt: Date;
}

export interface PlayerProgression {
  id: string;
  playerId: string;
  seasonId: string;
  date: Date;
  mmr: number;
  tier: RankedTier;
  division: TierDivision | null;
  wins: number;
  losses: number;
  createdAt: Date;
}

export interface TierLeaderboard {
  tier: RankedTier;
  entries: LeaderboardEntry[];
  total: number;
}

export interface PlayerStats {
  playerId: string;
  seasonId: string;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  currentMMR: number;
  peakMMR: number;
  currentTier: RankedTier;
  currentDivision: TierDivision | null;
  peakTier: RankedTier;
  peakDivision: TierDivision | null;
  longestWinStreak: number;
  longestLossStreak: number;
  averageMMRGain: number;
  averageMMRLoss: number;
  milestonesAchieved: number;
  rewardsEarned: number;
}

export interface CreateRewardDTO {
  seasonId: string;
  tier: RankedTier;
  rewardType: RewardType;
  rewardId: string;
  rewardName: string;
  rewardDescription: string;
  quantity: number;
  isExclusive?: boolean;
}

export interface MilestoneConfig {
  type: MilestoneType;
  threshold: number;
  rewardType?: RewardType;
  rewardQuantity?: number;
}
