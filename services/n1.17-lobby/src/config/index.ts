import dotenv from 'dotenv';

dotenv.config();

export const config = {
  serviceName: 'gameverse-lobby',
  version: '1.17.0',
  
  port: parseInt(process.env.PORT || '3017', 10),
  wsPort: parseInt(process.env.WS_PORT || '3018', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'gameverse_lobby',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    ssl: process.env.POSTGRES_SSL === 'true',
    maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10)
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: 'gameverse:lobby:'
  },
  
  lobby: {
    defaultMaxPlayers: parseInt(process.env.DEFAULT_MAX_PLAYERS || '10', 10),
    defaultMinPlayers: parseInt(process.env.DEFAULT_MIN_PLAYERS || '2', 10),
    defaultCountdownDuration: parseInt(process.env.DEFAULT_COUNTDOWN_DURATION || '10', 10),
    maxCountdownDuration: parseInt(process.env.MAX_COUNTDOWN_DURATION || '60', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '60000', 10)
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'gameverse-lobby-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  }
};

export type Config = typeof config;
