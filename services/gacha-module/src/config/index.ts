import dotenv from 'dotenv';
import { Rarity, RarityRates, SpendingLimits, GamerstakeNFTConfig } from '../types';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3022', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    username: process.env.POSTGRES_USER || 'gameverse',
    password: process.env.POSTGRES_PASSWORD || 'gameverse_secret',
    database: process.env.POSTGRES_DB || 'gameverse_gacha',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  gacha: {
    defaultSoftPityStart: parseInt(process.env.DEFAULT_SOFT_PITY_START || '74', 10),
    defaultHardPity: parseInt(process.env.DEFAULT_HARD_PITY || '90', 10),
    defaultSoftPityRateIncrease: 0.06,
    defaultRates: {
      [Rarity.COMMON]: parseFloat(process.env.DEFAULT_COMMON_RATE || '0.513'),
      [Rarity.RARE]: parseFloat(process.env.DEFAULT_RARE_RATE || '0.43'),
      [Rarity.EPIC]: parseFloat(process.env.DEFAULT_EPIC_RATE || '0.051'),
      [Rarity.LEGENDARY]: parseFloat(process.env.DEFAULT_LEGENDARY_RATE || '0.006'),
      [Rarity.MYTHIC]: 0,
    } as RarityRates,
    defaultFeaturedRate: 0.5,
    defaultMultiPullCount: 10,
    defaultMultiPullDiscount: 0.1,
    maxPullsPerRequest: 10,
    maxSimulationPulls: 1000000,
  },

  regulatory: {
    minAgeRequirement: parseInt(process.env.MIN_AGE_REQUIREMENT || '18', 10),
    requireAgeVerification: process.env.REQUIRE_AGE_VERIFICATION === 'true',
    dropRateDisclosureEnabled: process.env.DROP_RATE_DISCLOSURE_ENABLED !== 'false',
    spendingLimits: {
      daily: parseFloat(process.env.DAILY_SPENDING_LIMIT || '500'),
      weekly: parseFloat(process.env.WEEKLY_SPENDING_LIMIT || '2000'),
      monthly: parseFloat(process.env.MONTHLY_SPENDING_LIMIT || '5000'),
    } as SpendingLimits,
  },

  gamerstake: {
    apiUrl: process.env.GAMERSTAKE_API_URL || 'https://api.gamerstake.io',
    apiKey: process.env.GAMERSTAKE_API_KEY || '',
    contractAddress: process.env.GAMERSTAKE_CONTRACT_ADDRESS || '',
    chainId: parseInt(process.env.GAMERSTAKE_CHAIN_ID || '1', 10),
    gasLimit: parseInt(process.env.GAMERSTAKE_GAS_LIMIT || '300000', 10),
    enabled: process.env.NFT_REWARDS_ENABLED === 'true',
  } as GamerstakeNFTConfig & { enabled: boolean },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key',
    expiry: process.env.JWT_EXPIRY || '24h',
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    pullWindowMs: parseInt(process.env.PULL_RATE_LIMIT_WINDOW_MS || '1000', 10),
    pullMaxRequests: parseInt(process.env.PULL_RATE_LIMIT_MAX_REQUESTS || '10', 10),
  },

  performance: {
    maxConcurrentPulls: 50000,
    maxCurrencyPurchasesPerMinute: 20000,
    cacheEnabled: true,
    cacheTTL: {
      banner: 300,
      pity: 60,
      inventory: 120,
      dropRates: 3600,
    },
  },
};

export default config;
