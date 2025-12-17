import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  port: number;
  nodeEnv: string;
  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
    maxConnections: number;
  };
  redis: {
    host: string;
    port: number;
    password: string | undefined;
    db: number;
    keyPrefix: string;
  };
  cache: {
    achievementTtl: number;
    progressTtl: number;
    statsTtl: number;
  };
  notifications: {
    maxPerUser: number;
    retentionDays: number;
  };
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvVarInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer value for environment variable: ${key}`);
  }
  return parsed;
}

function getEnvVarBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true' || value === '1';
}

export const config: Config = {
  port: getEnvVarInt('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  database: {
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getEnvVarInt('DB_PORT', 5432),
    user: getEnvVar('DB_USER', 'gameverse'),
    password: getEnvVar('DB_PASSWORD', 'gameverse'),
    database: getEnvVar('DB_NAME', 'gameverse_achievements'),
    ssl: getEnvVarBool('DB_SSL', false),
    maxConnections: getEnvVarInt('DB_MAX_CONNECTIONS', 20)
  },
  redis: {
    host: getEnvVar('REDIS_HOST', 'localhost'),
    port: getEnvVarInt('REDIS_PORT', 6379),
    password: process.env['REDIS_PASSWORD'],
    db: getEnvVarInt('REDIS_DB', 0),
    keyPrefix: getEnvVar('REDIS_KEY_PREFIX', 'gv:ach:')
  },
  cache: {
    achievementTtl: getEnvVarInt('CACHE_ACHIEVEMENT_TTL', 3600),
    progressTtl: getEnvVarInt('CACHE_PROGRESS_TTL', 300),
    statsTtl: getEnvVarInt('CACHE_STATS_TTL', 600)
  },
  notifications: {
    maxPerUser: getEnvVarInt('NOTIFICATIONS_MAX_PER_USER', 100),
    retentionDays: getEnvVarInt('NOTIFICATIONS_RETENTION_DAYS', 30)
  }
};

export default config;
