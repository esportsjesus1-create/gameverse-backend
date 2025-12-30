import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3027'),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),
  DEFAULT_MMR: z.string().transform(Number).default('1200'),
  MIN_MMR: z.string().transform(Number).default('0'),
  MAX_MMR: z.string().transform(Number).default('5000'),
  PLACEMENT_MATCHES_REQUIRED: z.string().transform(Number).default('10'),
  SOFT_RESET_FACTOR: z.string().transform(Number).default('0.5'),
  LOG_LEVEL: z.string().default('info'),
});

const parseEnv = (): z.infer<typeof envSchema> => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
};

export const config = parseEnv();

export const tierThresholds = [
  { tier: 'BRONZE', minMMR: 0, maxMMR: 799, hasDivisions: true },
  { tier: 'SILVER', minMMR: 800, maxMMR: 1199, hasDivisions: true },
  { tier: 'GOLD', minMMR: 1200, maxMMR: 1599, hasDivisions: true },
  { tier: 'PLATINUM', minMMR: 1600, maxMMR: 1999, hasDivisions: true },
  { tier: 'DIAMOND', minMMR: 2000, maxMMR: 2399, hasDivisions: true },
  { tier: 'MASTER', minMMR: 2400, maxMMR: 2799, hasDivisions: false },
  { tier: 'GRANDMASTER', minMMR: 2800, maxMMR: 3199, hasDivisions: false },
  { tier: 'CHALLENGER', minMMR: 3200, maxMMR: 5000, hasDivisions: false },
] as const;

export const mmrConfig = {
  baseKFactor: 32,
  minKFactor: 16,
  maxKFactor: 48,
  streakBonus: 2,
  maxStreakBonus: 10,
  newPlayerGamesThreshold: 30,
  lpPerWin: 20,
  lpPerLoss: 15,
  promoWinsRequired: 3,
  promoLossesAllowed: 2,
  divisionLpThreshold: 100,
};

export default config;
