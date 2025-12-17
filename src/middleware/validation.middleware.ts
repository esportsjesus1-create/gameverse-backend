import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { BadRequestError } from './error.middleware';
import { BlockchainChain, KycStatus } from '../types';

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        next(new BadRequestError(messages.join(', ')));
        return;
      }
      next(error);
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        next(new BadRequestError(messages.join(', ')));
        return;
      }
      next(error);
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
        next(new BadRequestError(messages.join(', ')));
        return;
      }
      next(error);
    }
  };
}

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  displayName: z.string().max(100, 'Display name must be at most 100 characters').optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
});

export const updateUserSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z.string().max(100, 'Display name must be at most 100 characters').optional(),
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),
  preferences: z
    .object({
      notifications: z
        .object({
          email: z.boolean().optional(),
          push: z.boolean().optional(),
          marketing: z.boolean().optional(),
          gameUpdates: z.boolean().optional(),
          friendRequests: z.boolean().optional(),
        })
        .optional(),
      privacy: z
        .object({
          profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
          showOnlineStatus: z.boolean().optional(),
          showGameActivity: z.boolean().optional(),
          allowFriendRequests: z.boolean().optional(),
        })
        .optional(),
      display: z
        .object({
          theme: z.enum(['light', 'dark', 'system']).optional(),
          compactMode: z.boolean().optional(),
          animationsEnabled: z.boolean().optional(),
        })
        .optional(),
      locale: z.string().optional(),
      timezone: z.string().optional(),
    })
    .optional(),
});

const blockchainChains: [BlockchainChain, ...BlockchainChain[]] = [
  'ethereum',
  'polygon',
  'solana',
  'avalanche',
  'binance',
  'arbitrum',
  'optimism',
  'base',
];

export const linkAddressSchema = z.object({
  chain: z.enum(blockchainChains),
  address: z.string().min(1, 'Address is required'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required'),
  label: z.string().max(50, 'Label must be at most 50 characters').optional(),
});

export const updateAddressLabelSchema = z.object({
  label: z.string().max(50, 'Label must be at most 50 characters').nullable(),
});

const kycStatuses: [KycStatus, ...KycStatus[]] = [
  'none',
  'pending',
  'verified',
  'rejected',
  'expired',
];

export const updateKycStatusSchema = z.object({
  status: z.enum(kycStatuses),
  provider: z.string().optional(),
  reference: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const exportFormatSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
});
