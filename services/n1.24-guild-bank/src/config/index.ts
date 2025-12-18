import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3024', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/guild_bank?schema=public',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  multiSignature: {
    defaultApprovalThreshold: parseInt(process.env.DEFAULT_APPROVAL_THRESHOLD || '2', 10),
    maxApprovalThreshold: parseInt(process.env.MAX_APPROVAL_THRESHOLD || '5', 10),
  },
  
  withdrawalLimits: {
    defaultDailyLimit: parseInt(process.env.DEFAULT_DAILY_WITHDRAWAL_LIMIT || '10000', 10),
    defaultSingleLimit: parseInt(process.env.DEFAULT_SINGLE_WITHDRAWAL_LIMIT || '5000', 10),
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export function validateConfig(): void {
  const requiredEnvVars = ['JWT_SECRET'];
  
  if (config.nodeEnv === 'production') {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
