import dotenv from 'dotenv';

dotenv.config();

export const config = {
  app: {
    name: 'gameverse-backend',
    version: process.env.npm_package_version || '1.0.0',
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiVersion: process.env.API_VERSION || 'v1',
  },
  database: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    name: process.env.POSTGRES_DB || 'gameverse',
    user: process.env.POSTGRES_USER || 'gameverse',
    password: process.env.POSTGRES_PASSWORD || 'gameverse',
    poolSize: parseInt(process.env.POSTGRES_POOL_SIZE || '20', 10),
    idleTimeout: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000', 10),
    connectionTimeout: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '2000', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    poolSize: parseInt(process.env.REDIS_POOL_SIZE || '10', 10),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
  },
  monitoring: {
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
    metricsPrefix: process.env.METRICS_PREFIX || 'gameverse_',
    otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    otelServiceName: process.env.OTEL_SERVICE_NAME || 'gameverse-backend',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    dir: process.env.LOG_DIR || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
  },
  test: {
    database: {
      host: process.env.TEST_POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.TEST_POSTGRES_PORT || '5433', 10),
      name: process.env.TEST_POSTGRES_DB || 'gameverse_test',
      user: process.env.TEST_POSTGRES_USER || 'gameverse_test',
      password: process.env.TEST_POSTGRES_PASSWORD || 'gameverse_test_secret',
    },
    redis: {
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
      db: parseInt(process.env.TEST_REDIS_DB || '1', 10),
    },
  },
};

export default config;
