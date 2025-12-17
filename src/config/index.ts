import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3020', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-achievement',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_achievement',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },
  
  achievement: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '50', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '1000', 10),
  },
};

export default config;
