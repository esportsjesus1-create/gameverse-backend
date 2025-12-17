import dotenv from 'dotenv';
import { Rarity, RarityRates, PityConfig } from '../types';

dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string | undefined;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
}

export interface GachaDefaults {
  baseRates: RarityRates;
  pityConfig: PityConfig;
  featuredRate: number;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  gachaDefaults: GachaDefaults;
}

const config: Config = {
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
  gachaDefaults: {
    baseRates: {
      [Rarity.COMMON]: parseFloat(process.env.DEFAULT_COMMON_RATE || '0.503'),
      [Rarity.RARE]: parseFloat(process.env.DEFAULT_RARE_RATE || '0.43'),
      [Rarity.EPIC]: parseFloat(process.env.DEFAULT_EPIC_RATE || '0.051'),
      [Rarity.LEGENDARY]: parseFloat(process.env.DEFAULT_LEGENDARY_RATE || '0.006'),
      [Rarity.MYTHIC]: 0,
    },
    pityConfig: {
      softPityStart: parseInt(process.env.DEFAULT_SOFT_PITY_START || '74', 10),
      hardPity: parseInt(process.env.DEFAULT_HARD_PITY || '90', 10),
      softPityRateIncrease: 0.06,
      guaranteedFeaturedAfterLoss: true,
    },
    featuredRate: parseFloat(process.env.DEFAULT_FEATURED_RATE || '0.5'),
  },
};

export default config;
