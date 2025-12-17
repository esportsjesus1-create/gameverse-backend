import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { BadRequestError } from './error-handler';
import { BannerType, Rarity, ItemType } from '../types';

export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new BadRequestError(message));
      } else {
        next(error);
      }
    }
  };
};

export const validateQuery = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new BadRequestError(message));
      } else {
        next(error);
      }
    }
  };
};

export const validateParams = <T>(schema: ZodSchema<T>) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const message = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        next(new BadRequestError(message));
      } else {
        next(error);
      }
    }
  };
};

export const pullRequestSchema = z.object({
  playerId: z.string().uuid(),
  bannerId: z.string().uuid(),
  count: z.number().int().min(1).max(10).optional().default(1),
});

export const createBannerSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(BannerType),
  baseRates: z
    .object({
      COMMON: z.number().min(0).max(1).optional(),
      RARE: z.number().min(0).max(1).optional(),
      EPIC: z.number().min(0).max(1).optional(),
      LEGENDARY: z.number().min(0).max(1).optional(),
      MYTHIC: z.number().min(0).max(1).optional(),
    })
    .optional(),
  pityConfig: z
    .object({
      softPityStart: z.number().int().min(1).optional(),
      hardPity: z.number().int().min(1).optional(),
      softPityRateIncrease: z.number().min(0).max(1).optional(),
      guaranteedFeaturedAfterLoss: z.boolean().optional(),
    })
    .optional(),
  featuredItems: z.array(z.string().uuid()),
  itemPool: z.array(z.string().uuid()).min(1),
  featuredRate: z.number().min(0).max(1).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  pullCost: z.number().int().min(1),
  multiPullDiscount: z.number().min(0).max(1).optional(),
});

export const createItemSchema = z.object({
  name: z.string().min(1).max(255),
  rarity: z.nativeEnum(Rarity),
  type: z.nativeEnum(ItemType),
  metadata: z.record(z.unknown()).optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const playerIdParamSchema = z.object({
  playerId: z.string().uuid(),
});

export const bannerIdParamSchema = z.object({
  bannerId: z.string().uuid(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});
