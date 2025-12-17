import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://gameverse:gameverse_secret@localhost:5432/gameverse_shop',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  
  inventory: {
    defaultLowStockThreshold: parseInt(process.env.DEFAULT_LOW_STOCK_THRESHOLD || '10', 10),
  },
};

export function validateConfig(): void {
  const requiredEnvVars = ['DATABASE_URL'];
  
  if (config.nodeEnv === 'production') {
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
