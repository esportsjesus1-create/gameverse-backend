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

export enum SeasonState {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ENDING = 'ENDING',
  ENDED = 'ENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum SeasonType {
  RANKED = 'RANKED',
  CASUAL = 'CASUAL',
  TOURNAMENT = 'TOURNAMENT',
  EVENT = 'EVENT',
  SPECIAL = 'SPECIAL',
}

export enum ResetType {
  SOFT = 'SOFT',
  HARD = 'HARD',
  NONE = 'NONE',
}

export enum ModifierType {
  MMR_MULTIPLIER = 'MMR_MULTIPLIER',
  XP_MULTIPLIER = 'XP_MULTIPLIER',
  BONUS_EVENT = 'BONUS_EVENT',
  DECAY_RULE = 'DECAY_RULE',
  STREAK_BONUS = 'STREAK_BONUS',
  TIME_BASED = 'TIME_BASED',
}

export enum ChallengeType {
  WINS = 'WINS',
  GAMES_PLAYED = 'GAMES_PLAYED',
  TIER_REACHED = 'TIER_REACHED',
  WIN_STREAK = 'WIN_STREAK',
  MMR_GAINED = 'MMR_GAINED',
  KILLS = 'KILLS',
  ASSISTS = 'ASSISTS',
  OBJECTIVES = 'OBJECTIVES',
  CUSTOM = 'CUSTOM',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ACTIVATE = 'ACTIVATE',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  END = 'END',
  EXTEND = 'EXTEND',
  TERMINATE = 'TERMINATE',
  DISTRIBUTE_REWARDS = 'DISTRIBUTE_REWARDS',
  BULK_OPERATION = 'BULK_OPERATION',
  EMERGENCY_ACTION = 'EMERGENCY_ACTION',
}

export enum EventType {
  STATE_CHANGE = 'STATE_CHANGE',
  REWARD_DISTRIBUTION = 'REWARD_DISTRIBUTION',
  PLAYER_MILESTONE = 'PLAYER_MILESTONE',
  CHALLENGE_COMPLETE = 'CHALLENGE_COMPLETE',
  TIER_CHANGE = 'TIER_CHANGE',
  SEASON_START = 'SEASON_START',
  SEASON_END = 'SEASON_END',
  BONUS_EVENT = 'BONUS_EVENT',
  EMERGENCY = 'EMERGENCY',
  CUSTOM = 'CUSTOM',
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
  state: SeasonState;
  type: SeasonType;
  resetType: ResetType;
  version: number;
  templateId: string | null;
  parentSeasonId: string | null;
  gameIds: string[];
  timezone: string;
  mmrFloor: number;
  mmrCeiling: number;
  demotionProtection: number;
  decayEnabled: boolean;
  decayDays: number;
  decayAmount: number;
  promoWinsRequired: number;
  promoGamesMax: number;
  demotionShieldGames: number;
  skillGroupRestriction: number;
  gamerstakeEventId: string | null;
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
  lastActivityAt: Date;
  decayWarningAt: Date | null;
  isDecayProtected: boolean;
  demotionShieldGames: number;
  previousTier: RankedTier | null;
  previousDivision: TierDivision | null;
  gamerstakePlayerId: string | null;
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

export interface SeasonMetadata {
  id: string;
  seasonId: string;
  theme: string | null;
  description: string | null;
  bannerImageUrl: string | null;
  thumbnailUrl: string | null;
  promoVideoUrl: string | null;
  colorPrimary: string | null;
  colorSecondary: string | null;
  localizations: Record<string, LocalizedContent>;
  customData: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface LocalizedContent {
  name: string;
  description: string;
  theme?: string;
}

export interface SeasonTemplate {
  id: string;
  name: string;
  description: string | null;
  type: SeasonType;
  resetType: ResetType;
  softResetFactor: number;
  placementMatchesRequired: number;
  durationDays: number;
  mmrFloor: number;
  mmrCeiling: number;
  demotionProtection: number;
  decayEnabled: boolean;
  decayDays: number;
  decayAmount: number;
  promoWinsRequired: number;
  promoGamesMax: number;
  demotionShieldGames: number;
  skillGroupRestriction: number;
  defaultRules: SeasonRuleConfig[];
  defaultModifiers: SeasonModifierConfig[];
  defaultRewards: SeasonRewardConfig[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonRuleConfig {
  name: string;
  description?: string;
  ruleType: string;
  ruleConfig: Record<string, unknown>;
  priority?: number;
}

export interface SeasonModifierConfig {
  name: string;
  description?: string;
  modifierType: ModifierType;
  value: number;
  startTime?: Date;
  endTime?: Date;
  daysOfWeek?: number[];
  hoursOfDay?: number[];
}

export interface SeasonRewardConfig {
  tier: RankedTier;
  rewardType: RewardType;
  rewardId: string;
  rewardName: string;
  rewardDescription: string;
  quantity: number;
  isExclusive?: boolean;
}

export interface SeasonRule {
  id: string;
  seasonId: string;
  name: string;
  description: string | null;
  ruleType: string;
  ruleConfig: Record<string, unknown>;
  priority: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonModifier {
  id: string;
  seasonId: string;
  name: string;
  description: string | null;
  modifierType: ModifierType;
  value: number;
  startTime: Date | null;
  endTime: Date | null;
  daysOfWeek: number[];
  hoursOfDay: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonChallenge {
  id: string;
  seasonId: string;
  name: string;
  description: string | null;
  challengeType: ChallengeType;
  targetValue: number;
  rewardType: RewardType | null;
  rewardId: string | null;
  rewardQuantity: number;
  startDate: Date | null;
  endDate: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerChallengeProgress {
  id: string;
  playerId: string;
  challengeId: string;
  currentValue: number;
  isCompleted: boolean;
  completedAt: Date | null;
  rewardClaimed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeasonEvent {
  id: string;
  seasonId: string;
  eventType: EventType;
  eventData: Record<string, unknown>;
  webhookUrl: string | null;
  isProcessed: boolean;
  processedAt: Date | null;
  error: string | null;
  createdAt: Date;
}

export interface SeasonAuditLog {
  id: string;
  seasonId: string;
  action: AuditAction;
  actorId: string;
  actorType: string;
  targetType: string | null;
  targetId: string | null;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface SeasonAnalytics {
  id: string;
  seasonId: string;
  totalPlayers: number;
  activePlayers: number;
  totalMatches: number;
  averageMatchesPerDay: number;
  averageMMR: number;
  medianMMR: number;
  tierDistribution: Record<RankedTier, number>;
  dailyActiveUsers: DailyActiveUsers[];
  weeklyActiveUsers: WeeklyActiveUsers[];
  monthlyActiveUsers: MonthlyActiveUsers[];
  retentionRate: number;
  churnRate: number;
  rewardsDistributed: number;
  rewardsClaimed: number;
  challengesCompleted: number;
  peakConcurrentPlayers: number;
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyActiveUsers {
  date: string;
  count: number;
}

export interface WeeklyActiveUsers {
  week: string;
  count: number;
}

export interface MonthlyActiveUsers {
  month: string;
  count: number;
}

export interface PlayerSeasonHistory {
  id: string;
  playerId: string;
  seasonId: string;
  seasonNumber: number;
  seasonName: string;
  finalMmr: number;
  peakMmr: number;
  finalTier: RankedTier;
  finalDivision: TierDivision | null;
  finalRank: number | null;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  playtime: number;
  achievements: string[];
  rewards: string[];
  challenges: string[];
  carryoverItems: CarryoverItem[];
  createdAt: Date;
}

export interface CarryoverItem {
  itemType: string;
  itemId: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

export interface PlayerLifetimeStats {
  id: string;
  playerId: string;
  totalSeasons: number;
  totalWins: number;
  totalLosses: number;
  totalMatches: number;
  highestMmr: number;
  highestTier: RankedTier;
  highestDivision: TierDivision | null;
  totalRewardsEarned: number;
  totalRewardsClaimed: number;
  achievementCount: number;
  challengesCompleted: number;
  totalPlaytime: number;
  firstSeasonId: string | null;
  lastActiveSeasonId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlayerInventoryCarryover {
  id: string;
  playerId: string;
  fromSeasonId: string;
  toSeasonId: string;
  itemType: string;
  itemId: string;
  quantity: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateSeasonMetadataDTO {
  seasonId: string;
  theme?: string;
  description?: string;
  bannerImageUrl?: string;
  thumbnailUrl?: string;
  promoVideoUrl?: string;
  colorPrimary?: string;
  colorSecondary?: string;
  localizations?: Record<string, LocalizedContent>;
  customData?: Record<string, unknown>;
}

export interface CreateSeasonTemplateDTO {
  name: string;
  description?: string;
  type?: SeasonType;
  resetType?: ResetType;
  softResetFactor?: number;
  placementMatchesRequired?: number;
  durationDays?: number;
  mmrFloor?: number;
  mmrCeiling?: number;
  demotionProtection?: number;
  decayEnabled?: boolean;
  decayDays?: number;
  decayAmount?: number;
  promoWinsRequired?: number;
  promoGamesMax?: number;
  demotionShieldGames?: number;
  skillGroupRestriction?: number;
  defaultRules?: SeasonRuleConfig[];
  defaultModifiers?: SeasonModifierConfig[];
  defaultRewards?: SeasonRewardConfig[];
}

export interface CreateSeasonRuleDTO {
  seasonId: string;
  name: string;
  description?: string;
  ruleType: string;
  ruleConfig?: Record<string, unknown>;
  priority?: number;
  isEnabled?: boolean;
}

export interface CreateSeasonModifierDTO {
  seasonId: string;
  name: string;
  description?: string;
  modifierType: ModifierType;
  value?: number;
  startTime?: Date;
  endTime?: Date;
  daysOfWeek?: number[];
  hoursOfDay?: number[];
  isActive?: boolean;
}

export interface CreateSeasonChallengeDTO {
  seasonId: string;
  name: string;
  description?: string;
  challengeType: ChallengeType;
  targetValue: number;
  rewardType?: RewardType;
  rewardId?: string;
  rewardQuantity?: number;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

export interface SeasonTransitionResult {
  previousSeasonId: string;
  newSeasonId: string;
  playersTransitioned: number;
  rewardsDistributed: number;
  resetResults: SeasonResetResult[];
}

export interface SeasonHealthMetrics {
  seasonId: string;
  isHealthy: boolean;
  activePlayerCount: number;
  matchesLast24h: number;
  averageQueueTime: number;
  errorRate: number;
  warnings: string[];
  lastCheckedAt: Date;
}

export interface BulkOperationResult {
  operationType: string;
  totalProcessed: number;
  successful: number;
  failed: number;
  errors: BulkOperationError[];
}

export interface BulkOperationError {
  playerId: string;
  error: string;
}

export interface EmergencyAction {
  type: 'FREEZE' | 'ROLLBACK' | 'FORCE_END' | 'PAUSE_MATCHMAKING';
  seasonId: string;
  reason: string;
  actorId: string;
  timestamp: Date;
}

export interface GamerstakeIntegration {
  eventId: string;
  seasonId: string;
  syncStatus: 'SYNCED' | 'PENDING' | 'ERROR';
  lastSyncAt: Date | null;
  playerMappings: number;
}

export interface SeasonPreview {
  season: Season;
  metadata: SeasonMetadata | null;
  rules: SeasonRule[];
  modifiers: SeasonModifier[];
  challenges: SeasonChallenge[];
  rewards: SeasonReward[];
  estimatedPlayerCount: number;
  validationErrors: string[];
}

export interface AuditLogFilter {
  seasonId?: string;
  action?: AuditAction;
  actorId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface DecayResult {
  playerId: string;
  previousMmr: number;
  newMmr: number;
  decayAmount: number;
  previousTier: RankedTier;
  newTier: RankedTier;
  daysInactive: number;
}

export interface PromotionSeriesResult {
  playerId: string;
  seriesWon: boolean;
  wins: number;
  losses: number;
  previousTier: RankedTier;
  previousDivision: TierDivision | null;
  newTier: RankedTier;
  newDivision: TierDivision | null;
}

export interface RewardNotification {
  id: string;
  playerId: string;
  rewardId: string;
  rewardName: string;
  rewardType: RewardType;
  notificationType: 'EARNED' | 'AVAILABLE' | 'EXPIRING' | 'CLAIMED';
  message: string;
  createdAt: Date;
  isRead: boolean;
}

export interface RewardPreview {
  playerId: string;
  seasonId: string;
  currentTier: RankedTier;
  eligibleRewards: SeasonReward[];
  potentialRewards: SeasonReward[];
  totalValue: number;
}

export interface MilestoneProgress {
  milestoneType: MilestoneType;
  currentValue: number;
  targetValue: number;
  isCompleted: boolean;
  reward?: SeasonReward;
}
