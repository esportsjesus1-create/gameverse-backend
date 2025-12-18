import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3038', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'gameverse',
    password: process.env.POSTGRES_PASSWORD || 'gameverse_secret',
    database: process.env.POSTGRES_DB || 'gameverse_rooms',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-jwt-secret',
    expiry: process.env.JWT_EXPIRY || '24h',
  },
  room: {
    defaultCapacity: parseInt(process.env.DEFAULT_ROOM_CAPACITY || '50', 10),
    maxCapacity: parseInt(process.env.MAX_ROOM_CAPACITY || '100', 10),
    idleTimeoutMs: parseInt(process.env.ROOM_IDLE_TIMEOUT_MS || '3600000', 10),
    cleanupIntervalMs: parseInt(process.env.ROOM_CLEANUP_INTERVAL_MS || '60000', 10),
  },
};

export default config;
