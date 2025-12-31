import dotenv from 'dotenv';

dotenv.config();

export const config = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3006', 10),
  HOST: process.env.HOST || '0.0.0.0',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: parseInt(process.env.REDIS_DB || '0', 10),

  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/gameverse_leaderboard',

  CACHE_TTL_LEADERBOARD: parseInt(process.env.CACHE_TTL_LEADERBOARD || '60', 10),
  CACHE_TTL_PLAYER_RANK: parseInt(process.env.CACHE_TTL_PLAYER_RANK || '300', 10),
  CACHE_TTL_TOP_100: parseInt(process.env.CACHE_TTL_TOP_100 || '30', 10),
  CACHE_TTL_STATISTICS: parseInt(process.env.CACHE_TTL_STATISTICS || '600', 10),

  RATE_LIMIT_ANONYMOUS_REQUESTS: parseInt(process.env.RATE_LIMIT_ANONYMOUS_REQUESTS || '30', 10),
  RATE_LIMIT_ANONYMOUS_WINDOW: parseInt(process.env.RATE_LIMIT_ANONYMOUS_WINDOW || '60', 10),
  RATE_LIMIT_AUTHENTICATED_REQUESTS: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_REQUESTS || '100', 10),
  RATE_LIMIT_AUTHENTICATED_WINDOW: parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW || '60', 10),
  RATE_LIMIT_PREMIUM_REQUESTS: parseInt(process.env.RATE_LIMIT_PREMIUM_REQUESTS || '500', 10),
  RATE_LIMIT_PREMIUM_WINDOW: parseInt(process.env.RATE_LIMIT_PREMIUM_WINDOW || '60', 10),

  QUERY_TIMEOUT_MS: parseInt(process.env.QUERY_TIMEOUT_MS || '100', 10),
  SLOW_QUERY_THRESHOLD_MS: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '50', 10),

  MAX_LEADERBOARD_ENTRIES: parseInt(process.env.MAX_LEADERBOARD_ENTRIES || '10000', 10),
  DEFAULT_PAGE_SIZE: parseInt(process.env.DEFAULT_PAGE_SIZE || '50', 10),
  MAX_PAGE_SIZE: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),

  ANTI_CHEAT_ENABLED: process.env.ANTI_CHEAT_ENABLED === 'true',
  ANTI_CHEAT_SCORE_VARIANCE_THRESHOLD: parseFloat(process.env.ANTI_CHEAT_SCORE_VARIANCE_THRESHOLD || '3.0'),
  ANTI_CHEAT_SUBMISSION_RATE_LIMIT: parseInt(process.env.ANTI_CHEAT_SUBMISSION_RATE_LIMIT || '10', 10),
  ANTI_CHEAT_SUBMISSION_RATE_WINDOW: parseInt(process.env.ANTI_CHEAT_SUBMISSION_RATE_WINDOW || '60', 10),

  WEBSOCKET_ENABLED: process.env.WEBSOCKET_ENABLED !== 'false',
  WEBSOCKET_HEARTBEAT_INTERVAL: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || '30000', 10),
  WEBSOCKET_MAX_SUBSCRIPTIONS: parseInt(process.env.WEBSOCKET_MAX_SUBSCRIPTIONS || '10', 10),

  RANK_DECAY_ENABLED: process.env.RANK_DECAY_ENABLED === 'true',
  RANK_DECAY_DAYS: parseInt(process.env.RANK_DECAY_DAYS || '14', 10),
  RANK_DECAY_AMOUNT: parseInt(process.env.RANK_DECAY_AMOUNT || '25', 10),
  RANK_DECAY_MIN_TIER: process.env.RANK_DECAY_MIN_TIER || 'PLATINUM',

  GAMERSTAKE_API_URL: process.env.GAMERSTAKE_API_URL || 'http://localhost:3000/api/v1',
  GAMERSTAKE_API_KEY: process.env.GAMERSTAKE_API_KEY || '',

  JWT_SECRET: process.env.JWT_SECRET || 'development-secret-key',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
};

export default config;
