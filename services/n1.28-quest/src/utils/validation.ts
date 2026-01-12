import { z } from 'zod';
import { QuestType, ObjectiveType, RewardType } from '../types';

export const createQuestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  type: z.nativeEnum(QuestType),
  requiredLevel: z.number().int().min(1).max(100).optional().default(1),
  objectives: z.array(z.object({
    type: z.nativeEnum(ObjectiveType),
    description: z.string().max(500).optional(),
    targetValue: z.number().int().min(1),
    targetId: z.string().max(255).optional(),
    orderIndex: z.number().int().min(0).optional(),
    isOptional: z.boolean().optional().default(false)
  })).min(1),
  rewards: z.array(z.object({
    type: z.nativeEnum(RewardType),
    value: z.number().int().min(1),
    itemId: z.string().max(255).optional(),
    metadata: z.record(z.unknown()).optional()
  })).min(1),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
});

export const updateProgressSchema = z.object({
  objectiveId: z.string().uuid(),
  incrementBy: z.number().int().min(1).optional(),
  setValue: z.number().int().min(0).optional()
}).refine(
  (data) => data.incrementBy !== undefined || data.setValue !== undefined,
  { message: 'Either incrementBy or setValue must be provided' }
);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

export const questFilterSchema = z.object({
  type: z.nativeEnum(QuestType).optional(),
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  minLevel: z.coerce.number().int().min(1).optional(),
  maxLevel: z.coerce.number().int().max(100).optional()
});

export const uuidSchema = z.string().uuid();

export type CreateQuestInput = z.infer<typeof createQuestSchema>;
export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type QuestFilterInput = z.infer<typeof questFilterSchema>;
