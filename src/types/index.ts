export type AchievementType = 'standard' | 'hidden' | 'secret' | 'tiered' | 'daily' | 'seasonal';
export type AchievementCategory = 'combat' | 'exploration' | 'social' | 'collection' | 'progression' | 'special';
export type TriggerType = 'stat_threshold' | 'event' | 'cumulative' | 'streak' | 'first_time' | 'timed' | 'compound';
export type RewardType = 'currency' | 'item' | 'title' | 'badge' | 'xp' | 'unlock' | 'cosmetic';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: AchievementType;
  category: AchievementCategory;
  iconUrl?: string;
  points: number;
  isActive: boolean;
  isHidden: boolean;
  trigger: AchievementTrigger;
  rewards: AchievementReward[];
  prerequisites?: string[];
  tiers?: AchievementTier[];
  seasonId?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementTrigger {
  type: TriggerType;
  statKey?: string;
  eventType?: string;
  threshold: number;
  comparison: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
  timeWindow?: number;
  conditions?: TriggerCondition[];
}

export interface TriggerCondition {
  statKey: string;
  threshold: number;
  comparison: 'gte' | 'lte' | 'eq' | 'gt' | 'lt';
}

export interface AchievementTier {
  tier: number;
  name: string;
  threshold: number;
  rewards: AchievementReward[];
  points: number;
}

export interface AchievementReward {
  type: RewardType;
  itemId?: string;
  amount: number;
  metadata?: Record<string, unknown>;
}

export interface UserAchievement {
  id: string;
  odbyId: string;
  achievementId: string;
  progress: number;
  currentTier: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
  claimedRewards: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementProgress {
  odbyId: string;
  achievementId: string;
  achievement: Achievement;
  progress: number;
  progressPercent: number;
  currentTier: number;
  nextTierThreshold?: number;
  isUnlocked: boolean;
  unlockedAt?: Date;
  claimedRewards: boolean;
}

export interface ProgressUpdateInput {
  odbyId: string;
  achievementId: string;
  progress: number;
  increment?: boolean;
}

export interface StatUpdateInput {
  odbyId: string;
  statKey: string;
  value: number;
  increment?: boolean;
}

export interface EventTriggerInput {
  odbyId: string;
  eventType: string;
  data?: Record<string, unknown>;
}

export interface UnlockResult {
  achievement: Achievement;
  tier?: number;
  rewards: AchievementReward[];
  isNewUnlock: boolean;
  isTierUp: boolean;
}

export interface CreateAchievementInput {
  name: string;
  description: string;
  type: AchievementType;
  category: AchievementCategory;
  iconUrl?: string;
  points: number;
  isHidden?: boolean;
  trigger: AchievementTrigger;
  rewards: AchievementReward[];
  prerequisites?: string[];
  tiers?: AchievementTier[];
  seasonId?: string;
  expiresAt?: Date;
}

export interface UserStats {
  odbyId: string;
  stats: Record<string, number>;
  updatedAt: Date;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AchievementError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'ACHIEVEMENT_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AchievementError.prototype);
  }
}

export class AchievementNotFoundError extends AchievementError {
  constructor() {
    super('Achievement not found', 404, 'ACHIEVEMENT_NOT_FOUND');
  }
}

export class AchievementAlreadyUnlockedError extends AchievementError {
  constructor() {
    super('Achievement already unlocked', 400, 'ACHIEVEMENT_ALREADY_UNLOCKED');
  }
}

export class PrerequisitesNotMetError extends AchievementError {
  constructor() {
    super('Prerequisites not met', 400, 'PREREQUISITES_NOT_MET');
  }
}

export class RewardsAlreadyClaimedError extends AchievementError {
  constructor() {
    super('Rewards already claimed', 400, 'REWARDS_ALREADY_CLAIMED');
  }
}
