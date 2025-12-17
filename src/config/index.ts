import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3019', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-leaderboard',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_leaderboard',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'lb:',
  },
  
  leaderboard: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '100', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '1000', 10),
    decayInterval: parseInt(process.env.DECAY_INTERVAL || '3600000', 10),
    snapshotInterval: parseInt(process.env.SNAPSHOT_INTERVAL || '86400000', 10),
    aroundUserRange: parseInt(process.env.AROUND_USER_RANGE || '10', 10),
  },
  
  decay: {
    linearRate: parseFloat(process.env.DECAY_LINEAR_RATE || '0.01'),
    exponentialRate: parseFloat(process.env.DECAY_EXPONENTIAL_RATE || '0.005'),
    logarithmicRate: parseFloat(process.env.DECAY_LOGARITHMIC_RATE || '0.1'),
  },
};

export default config;
