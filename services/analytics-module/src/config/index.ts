/**
 * GameVerse Analytics Module - Configuration
 * Environment-based configuration with validation
 */

import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  // Server Configuration
  NODE_ENV: string;
  PORT: number;
  HOST: string;

  // Logging Configuration
  LOG_LEVEL: string;

  // Cache Configuration
  CACHE_ENABLED: boolean;
  CACHE_DEFAULT_TTL: number;
  CACHE_MAX_SIZE: number;
  CACHE_METRICS_TTL: number;
  CACHE_QUERY_TTL: number;
  CACHE_AGGREGATION_TTL: number;

  // Rate Limiting Configuration
  RATE_LIMIT_ENABLED: boolean;
  RATE_LIMIT_BASIC_RPM: number;
  RATE_LIMIT_BASIC_RPH: number;
  RATE_LIMIT_BASIC_RPD: number;
  RATE_LIMIT_STANDARD_RPM: number;
  RATE_LIMIT_STANDARD_RPH: number;
  RATE_LIMIT_STANDARD_RPD: number;
  RATE_LIMIT_PREMIUM_RPM: number;
  RATE_LIMIT_PREMIUM_RPH: number;
  RATE_LIMIT_PREMIUM_RPD: number;
  RATE_LIMIT_BURST_MULTIPLIER: number;

  // Query Configuration
  QUERY_TIMEOUT_MS: number;
  QUERY_MAX_RESULTS: number;
  QUERY_MAX_TIME_RANGE_DAYS: number;

  // Batch Configuration
  BATCH_MAX_METRICS: number;
  BATCH_MAX_EVENTS: number;

  // Security Configuration
  API_KEY_HEADER: string;
  CORS_ORIGINS: string[];

  // Health Check Configuration
  HEALTH_CHECK_INTERVAL_MS: number;
}

function getEnvString(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

export const config: Config = {
  // Server Configuration
  NODE_ENV: getEnvString('NODE_ENV', 'development'),
  PORT: getEnvNumber('PORT', 3000),
  HOST: getEnvString('HOST', '0.0.0.0'),

  // Logging Configuration
  LOG_LEVEL: getEnvString('LOG_LEVEL', 'info'),

  // Cache Configuration
  CACHE_ENABLED: getEnvBoolean('CACHE_ENABLED', true),
  CACHE_DEFAULT_TTL: getEnvNumber('CACHE_DEFAULT_TTL', 300), // 5 minutes
  CACHE_MAX_SIZE: getEnvNumber('CACHE_MAX_SIZE', 10000),
  CACHE_METRICS_TTL: getEnvNumber('CACHE_METRICS_TTL', 60), // 1 minute
  CACHE_QUERY_TTL: getEnvNumber('CACHE_QUERY_TTL', 300), // 5 minutes
  CACHE_AGGREGATION_TTL: getEnvNumber('CACHE_AGGREGATION_TTL', 600), // 10 minutes

  // Rate Limiting Configuration
  RATE_LIMIT_ENABLED: getEnvBoolean('RATE_LIMIT_ENABLED', true),
  RATE_LIMIT_BASIC_RPM: getEnvNumber('RATE_LIMIT_BASIC_RPM', 60),
  RATE_LIMIT_BASIC_RPH: getEnvNumber('RATE_LIMIT_BASIC_RPH', 1000),
  RATE_LIMIT_BASIC_RPD: getEnvNumber('RATE_LIMIT_BASIC_RPD', 10000),
  RATE_LIMIT_STANDARD_RPM: getEnvNumber('RATE_LIMIT_STANDARD_RPM', 300),
  RATE_LIMIT_STANDARD_RPH: getEnvNumber('RATE_LIMIT_STANDARD_RPH', 5000),
  RATE_LIMIT_STANDARD_RPD: getEnvNumber('RATE_LIMIT_STANDARD_RPD', 50000),
  RATE_LIMIT_PREMIUM_RPM: getEnvNumber('RATE_LIMIT_PREMIUM_RPM', 1000),
  RATE_LIMIT_PREMIUM_RPH: getEnvNumber('RATE_LIMIT_PREMIUM_RPH', 20000),
  RATE_LIMIT_PREMIUM_RPD: getEnvNumber('RATE_LIMIT_PREMIUM_RPD', 200000),
  RATE_LIMIT_BURST_MULTIPLIER: getEnvNumber('RATE_LIMIT_BURST_MULTIPLIER', 2),

  // Query Configuration
  QUERY_TIMEOUT_MS: getEnvNumber('QUERY_TIMEOUT_MS', 30000),
  QUERY_MAX_RESULTS: getEnvNumber('QUERY_MAX_RESULTS', 10000),
  QUERY_MAX_TIME_RANGE_DAYS: getEnvNumber('QUERY_MAX_TIME_RANGE_DAYS', 365),

  // Batch Configuration
  BATCH_MAX_METRICS: getEnvNumber('BATCH_MAX_METRICS', 1000),
  BATCH_MAX_EVENTS: getEnvNumber('BATCH_MAX_EVENTS', 500),

  // Security Configuration
  API_KEY_HEADER: getEnvString('API_KEY_HEADER', 'X-API-Key'),
  CORS_ORIGINS: getEnvArray('CORS_ORIGINS', ['*']),

  // Health Check Configuration
  HEALTH_CHECK_INTERVAL_MS: getEnvNumber('HEALTH_CHECK_INTERVAL_MS', 30000),
};

export default config;
