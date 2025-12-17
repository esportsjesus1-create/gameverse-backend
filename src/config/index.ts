import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-audit',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_audit',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  retention: {
    defaultDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '2555', 10),
    gdprDays: parseInt(process.env.GDPR_RETENTION_DAYS || '2555', 10),
    soc2Days: parseInt(process.env.SOC2_RETENTION_DAYS || '2555', 10),
  },
  
  hashSecret: process.env.AUDIT_HASH_SECRET || 'audit-hash-secret-change-in-production',
};

export default config;
