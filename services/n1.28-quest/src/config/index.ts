import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3028', 10),
    host: process.env.HOST || '0.0.0.0'
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'gameverse_quest',
    user: process.env.POSTGRES_USER || 'gameverse',
    password: process.env.POSTGRES_PASSWORD || 'gameverse_secret'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },
  quest: {
    dailyResetHour: parseInt(process.env.DAILY_RESET_HOUR || '0', 10),
    weeklyResetDay: parseInt(process.env.WEEKLY_RESET_DAY || '1', 10),
    cacheTtl: parseInt(process.env.QUEST_CACHE_TTL || '300', 10)
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  }
};

export default config;
