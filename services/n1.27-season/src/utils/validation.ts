import { z } from 'zod';
import {
  SeasonState,
  SeasonType,
  ResetType,
  RankedTier,
  RewardType,
  MilestoneType,
  ModifierType,
  ChallengeType,
} from '../types';

/**
 * UUID validation schema with custom error message.
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Positive integer validation schema.
 */
export const positiveIntSchema = z.number().int().positive('Must be a positive integer');

/**
 * Non-negative integer validation schema.
 */
export const nonNegativeIntSchema = z.number().int().nonnegative('Must be a non-negative integer');

/**
 * Pagination parameters validation schema.
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.number().int().min(1).max(100, 'Limit must be between 1 and 100').default(50),
});

/**
 * Season creation DTO validation schema.
 */
export const createSeasonSchema = z.object({
  name: z.string()
    .min(1, 'Season name is required')
    .max(100, 'Season name must be at most 100 characters'),
  number: z.number()
    .int('Season number must be an integer')
    .positive('Season number must be positive'),
  startDate: z.coerce.date().refine(
    (date) => date >= new Date(Date.now() - 24 * 60 * 60 * 1000),
    'Start date cannot be more than 24 hours in the past'
  ),
  endDate: z.coerce.date().optional(),
  softResetFactor: z.number()
    .min(0, 'Soft reset factor must be at least 0')
    .max(1, 'Soft reset factor must be at most 1')
    .default(0.5),
  placementMatchesRequired: z.number()
    .int()
    .min(1, 'At least 1 placement match required')
    .max(20, 'At most 20 placement matches allowed')
    .default(10),
  type: z.nativeEnum(SeasonType).default(SeasonType.RANKED),
  resetType: z.nativeEnum(ResetType).default(ResetType.SOFT),
  description: z.string().max(1000).optional(),
  gameIds: z.array(z.string()).default([]),
}).refine(
  (data) => !data.endDate || data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

/**
 * Season metadata creation DTO validation schema.
 */
export const createSeasonMetadataSchema = z.object({
  seasonId: uuidSchema,
  theme: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  bannerImageUrl: z.string().url('Invalid banner image URL').optional(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional(),
  promoVideoUrl: z.string().url('Invalid promo video URL').optional(),
  colorPrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  colorSecondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color').optional(),
  localizations: z.record(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(2000),
    theme: z.string().max(100).optional(),
  })).optional(),
  customData: z.record(z.unknown()).optional(),
});

/**
 * Season template creation DTO validation schema.
 */
export const createSeasonTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  type: z.nativeEnum(SeasonType).default(SeasonType.RANKED),
  resetType: z.nativeEnum(ResetType).default(ResetType.SOFT),
  softResetFactor: z.number().min(0).max(1).default(0.5),
  placementMatchesRequired: z.number().int().min(1).max(20).default(10),
  durationDays: z.number().int().min(1).max(365).default(90),
  mmrFloor: z.number().int().min(0).default(0),
  mmrCeiling: z.number().int().min(100).default(5000),
  demotionProtection: z.number().int().min(0).max(10).default(3),
  decayEnabled: z.boolean().default(false),
  decayDays: z.number().int().min(1).max(90).default(14),
  decayAmount: z.number().int().min(0).max(500).default(25),
  promoWinsRequired: z.number().int().min(1).max(5).default(2),
  promoGamesMax: z.number().int().min(1).max(7).default(3),
  demotionShieldGames: z.number().int().min(0).max(10).default(3),
  skillGroupRestriction: z.number().int().min(0).max(5).default(2),
});

/**
 * MMR update DTO validation schema.
 */
export const updateMMRSchema = z.object({
  playerId: uuidSchema,
  opponentId: uuidSchema,
  isWin: z.boolean(),
  gameMode: z.string().max(50).default('ranked'),
}).refine(
  (data) => data.playerId !== data.opponentId,
  { message: 'Player and opponent must be different', path: ['opponentId'] }
);

/**
 * Season state transition validation schema.
 */
export const stateTransitionSchema = z.object({
  seasonId: uuidSchema,
  newState: z.nativeEnum(SeasonState),
  actorId: uuidSchema,
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Season extension validation schema.
 */
export const extendSeasonSchema = z.object({
  seasonId: uuidSchema,
  newEndDate: z.coerce.date(),
  actorId: uuidSchema,
  reason: z.string().max(500).optional(),
});

/**
 * Season termination validation schema.
 */
export const terminateSeasonSchema = z.object({
  seasonId: uuidSchema,
  actorId: uuidSchema,
  reason: z.string().min(1, 'Termination reason is required').max(500),
  gracePeriodHours: z.number().int().min(0).max(168).default(24),
});

/**
 * Reward creation DTO validation schema.
 */
export const createRewardSchema = z.object({
  seasonId: uuidSchema,
  tier: z.nativeEnum(RankedTier),
  rewardType: z.nativeEnum(RewardType),
  rewardId: z.string().min(1).max(100),
  rewardName: z.string().min(1).max(200),
  rewardDescription: z.string().max(1000),
  quantity: z.number().int().positive(),
  isExclusive: z.boolean().default(false),
});

/**
 * Milestone reward creation validation schema.
 */
export const createMilestoneRewardSchema = z.object({
  seasonId: uuidSchema,
  milestoneType: z.nativeEnum(MilestoneType),
  milestoneValue: z.number().int().positive(),
  rewardType: z.nativeEnum(RewardType),
  rewardId: z.string().min(1).max(100),
  rewardName: z.string().min(1).max(200),
  rewardDescription: z.string().max(1000),
  quantity: z.number().int().positive(),
  isExclusive: z.boolean().default(false),
});

/**
 * Participation reward creation validation schema.
 */
export const createParticipationRewardSchema = z.object({
  seasonId: uuidSchema,
  minGamesRequired: z.number().int().positive(),
  rewardType: z.nativeEnum(RewardType),
  rewardId: z.string().min(1).max(100),
  rewardName: z.string().min(1).max(200),
  rewardDescription: z.string().max(1000),
  quantity: z.number().int().positive(),
});

/**
 * Reward claim validation schema.
 */
export const claimRewardSchema = z.object({
  playerId: uuidSchema,
  rewardId: z.string().min(1).max(100),
});

/**
 * Season rule creation DTO validation schema.
 */
export const createSeasonRuleSchema = z.object({
  seasonId: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  ruleType: z.string().min(1).max(50),
  ruleConfig: z.record(z.unknown()).default({}),
  priority: z.number().int().min(0).max(1000).default(0),
  isEnabled: z.boolean().default(true),
});

/**
 * Season modifier creation DTO validation schema.
 */
export const createSeasonModifierSchema = z.object({
  seasonId: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  modifierType: z.nativeEnum(ModifierType),
  value: z.number().default(1),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
  hoursOfDay: z.array(z.number().int().min(0).max(23)).default([]),
  isActive: z.boolean().default(true),
}).refine(
  (data) => !data.startTime || !data.endTime || data.endTime > data.startTime,
  { message: 'End time must be after start time', path: ['endTime'] }
);

/**
 * Season challenge creation DTO validation schema.
 */
export const createSeasonChallengeSchema = z.object({
  seasonId: uuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  challengeType: z.nativeEnum(ChallengeType),
  targetValue: z.number().int().positive(),
  rewardType: z.nativeEnum(RewardType).optional(),
  rewardId: z.string().max(100).optional(),
  rewardQuantity: z.number().int().nonnegative().default(0),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isActive: z.boolean().default(true),
}).refine(
  (data) => !data.startDate || !data.endDate || data.endDate > data.startDate,
  { message: 'End date must be after start date', path: ['endDate'] }
);

/**
 * Challenge progress update validation schema.
 */
export const updateChallengeProgressSchema = z.object({
  playerId: uuidSchema,
  challengeId: uuidSchema,
  progressValue: z.number().int().nonnegative(),
});

/**
 * Player registration validation schema.
 */
export const registerPlayerSchema = z.object({
  playerId: uuidSchema,
  seasonId: uuidSchema,
  gamerstakePlayerId: z.string().max(100).optional(),
});

/**
 * Leaderboard query validation schema.
 */
export const leaderboardQuerySchema = z.object({
  seasonId: uuidSchema,
  tier: z.nativeEnum(RankedTier).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

/**
 * Player history query validation schema.
 */
export const playerHistoryQuerySchema = z.object({
  playerId: uuidSchema,
  seasonId: uuidSchema,
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Audit log filter validation schema.
 */
export const auditLogFilterSchema = z.object({
  seasonId: uuidSchema,
  action: z.string().optional(),
  actorId: uuidSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

/**
 * Bulk operation validation schema.
 */
export const bulkOperationSchema = z.object({
  seasonId: uuidSchema,
  playerIds: z.array(uuidSchema).min(1).max(1000),
  operation: z.enum(['reset', 'reward', 'update']),
  data: z.record(z.unknown()).optional(),
});

/**
 * Emergency action validation schema.
 */
export const emergencyActionSchema = z.object({
  seasonId: uuidSchema,
  actorId: uuidSchema,
  actionType: z.enum(['pause', 'terminate', 'rollback', 'freeze_rewards']),
  reason: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Type exports for validated data.
 */
export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type CreateSeasonMetadataInput = z.infer<typeof createSeasonMetadataSchema>;
export type CreateSeasonTemplateInput = z.infer<typeof createSeasonTemplateSchema>;
export type UpdateMMRInput = z.infer<typeof updateMMRSchema>;
export type StateTransitionInput = z.infer<typeof stateTransitionSchema>;
export type ExtendSeasonInput = z.infer<typeof extendSeasonSchema>;
export type TerminateSeasonInput = z.infer<typeof terminateSeasonSchema>;
export type CreateRewardInput = z.infer<typeof createRewardSchema>;
export type CreateMilestoneRewardInput = z.infer<typeof createMilestoneRewardSchema>;
export type CreateParticipationRewardInput = z.infer<typeof createParticipationRewardSchema>;
export type ClaimRewardInput = z.infer<typeof claimRewardSchema>;
export type CreateSeasonRuleInput = z.infer<typeof createSeasonRuleSchema>;
export type CreateSeasonModifierInput = z.infer<typeof createSeasonModifierSchema>;
export type CreateSeasonChallengeInput = z.infer<typeof createSeasonChallengeSchema>;
export type UpdateChallengeProgressInput = z.infer<typeof updateChallengeProgressSchema>;
export type RegisterPlayerInput = z.infer<typeof registerPlayerSchema>;
export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;
export type PlayerHistoryQueryInput = z.infer<typeof playerHistoryQuerySchema>;
export type AuditLogFilterInput = z.infer<typeof auditLogFilterSchema>;
export type BulkOperationInput = z.infer<typeof bulkOperationSchema>;
export type EmergencyActionInput = z.infer<typeof emergencyActionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Validation helper function that returns parsed data or throws ValidationError.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    result.error.errors.forEach((err) => {
      const path = err.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(err.message);
    });
    const { ValidationError } = require('./errors');
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

/**
 * Async validation helper for use in middleware.
 */
export async function validateAsync<T>(schema: z.ZodSchema<T>, data: unknown): Promise<T> {
  return validateInput(schema, data);
}
