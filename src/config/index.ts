import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  aws: AwsConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  ssl: boolean;
}

export interface RedisConfig {
  url: string;
  ttl: number;
}

export interface AwsConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  s3Bucket: string;
  s3Endpoint?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface CorsConfig {
  origin: string | string[];
  credentials: boolean;
}

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is required`);
  }
  return value;
}

function getEnvVarAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

function getEnvVarAsBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

export function loadConfig(): Config {
  return {
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    port: getEnvVarAsNumber('PORT', 3000),
    database: {
      url: getEnvVar('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/gameverse'),
      poolSize: getEnvVarAsNumber('DATABASE_POOL_SIZE', 10),
      ssl: getEnvVarAsBoolean('DATABASE_SSL', false),
    },
    redis: {
      url: getEnvVar('REDIS_URL', 'redis://localhost:6379'),
      ttl: getEnvVarAsNumber('REDIS_TTL', 3600),
    },
    aws: {
      region: getEnvVar('AWS_REGION', 'us-east-1'),
      accessKeyId: getEnvVar('AWS_ACCESS_KEY_ID', ''),
      secretAccessKey: getEnvVar('AWS_SECRET_ACCESS_KEY', ''),
      s3Bucket: getEnvVar('S3_BUCKET', 'gameverse-avatars'),
      s3Endpoint: process.env.S3_ENDPOINT,
    },
    jwt: {
      secret: getEnvVar('JWT_SECRET', 'development-secret-key'),
      expiresIn: getEnvVar('JWT_EXPIRES_IN', '24h'),
    },
    cors: {
      origin: getEnvVar('CORS_ORIGIN', '*'),
      credentials: getEnvVarAsBoolean('CORS_CREDENTIALS', true),
    },
  };
}

export const config = loadConfig();
