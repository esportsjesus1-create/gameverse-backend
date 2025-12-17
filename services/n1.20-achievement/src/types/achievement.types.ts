import { z } from 'zod';

export enum AchievementType {
  SINGLE = 'single',
  PROGRESSIVE = 'progressive',
  TIERED = 'tiered'
}

export enum AchievementCategory {
  GAMEPLAY = 'gameplay',
  SOCIAL = 'social',
  COLLECTION = 'collection',
  EXPLORATION = 'exploration',
  COMPETITIVE = 'competitive',
  SPECIAL = 'special'
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export const AchievementCriteriaSchema = z.object({
  type: z.enum(['count', 'threshold', 'boolean', 'compound']),
  target: z.number().positive(),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'gt', 'gte', 'lt', 'lte', 'in']),
    value: z.union([z.string(), z.number(), z.array(z.string())])
  })).optional()
});

export type AchievementCriteria = z.infer<typeof AchievementCriteriaSchema>;

export const CreateAchievementSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  iconUrl: z.string().url().optional(),
  points: z.number().int().min(0).max(10000).default(10),
  rarity: z.nativeEnum(AchievementRarity).default(AchievementRarity.COMMON),
  type: z.nativeEnum(AchievementType).default(AchievementType.SINGLE),
  category: z.nativeEnum(AchievementCategory).default(AchievementCategory.GAMEPLAY),
  criteria: AchievementCriteriaSchema,
  isHidden: z.boolean().default(false),
  tiers: z.array(z.object({
    level: z.number().int().positive(),
    target: z.number().positive(),
    points: z.number().int().min(0),
    name: z.string().optional()
  })).optional()
});

export type CreateAchievementInput = z.infer<typeof CreateAchievementSchema>;

export const UpdateAchievementSchema = CreateAchievementSchema.partial();

export type UpdateAchievementInput = z.infer<typeof UpdateAchievementSchema>;

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  points: number;
  rarity: AchievementRarity;
  type: AchievementType;
  category: AchievementCategory;
  criteria: AchievementCriteria;
  isHidden: boolean;
  tiers: AchievementTier[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AchievementTier {
  level: number;
  target: number;
  points: number;
  name?: string;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  progress: number;
  currentTier: number;
  unlocked: boolean;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAchievementWithDetails extends UserAchievement {
  achievement: Achievement;
}

export interface AchievementStats {
  totalAchievements: number;
  unlockedCount: number;
  totalPoints: number;
  earnedPoints: number;
  completionPercentage: number;
  recentUnlocks: UserAchievementWithDetails[];
  categoryBreakdown: Record<AchievementCategory, { total: number; unlocked: number }>;
}

export const UpdateProgressSchema = z.object({
  increment: z.number().optional(),
  setValue: z.number().optional(),
  metadata: z.record(z.unknown()).optional()
}).refine(data => data.increment !== undefined || data.setValue !== undefined, {
  message: 'Either increment or setValue must be provided'
});

export type UpdateProgressInput = z.infer<typeof UpdateProgressSchema>;

export interface ProgressUpdateResult {
  previousProgress: number;
  currentProgress: number;
  unlocked: boolean;
  newlyUnlocked: boolean;
  tierAdvanced: boolean;
  previousTier: number;
  currentTier: number;
  achievement: Achievement;
}
