import dotenv from 'dotenv';
import { GatewayConfig } from '../types';

dotenv.config();

export function loadConfig(): GatewayConfig {
  return {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10)
    },
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'chain_gateway',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres'
    },
    server: {
      port: parseInt(process.env.SERVER_PORT || '3000', 10),
      host: process.env.SERVER_HOST || '0.0.0.0'
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || 'ratelimit:'
    },
    gasPriceTtl: parseInt(process.env.GAS_PRICE_TTL || '15000', 10),
    nonceTtl: parseInt(process.env.NONCE_TTL || '300000', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
    reorgDepth: parseInt(process.env.REORG_DEPTH || '64', 10)
  };
}

export const config = loadConfig();

export * from './chains';
