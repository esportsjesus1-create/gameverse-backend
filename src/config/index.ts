import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_ledger',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  
  ledger: {
    baseCurrency: process.env.BASE_CURRENCY || 'USD',
    maxEntriesPerTransaction: parseInt(process.env.MAX_ENTRIES_PER_TRANSACTION || '100', 10),
    snapshotRetentionDays: parseInt(process.env.SNAPSHOT_RETENTION_DAYS || '365', 10),
  },
  
  reconciliation: {
    cronSchedule: process.env.RECONCILIATION_CRON || '0 0 * * *',
    enabled: process.env.RECONCILIATION_ENABLED !== 'false',
  },
  
  audit: {
    enabled: process.env.AUDIT_ENABLED !== 'false',
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '730', 10),
  },
};

export function getConnectionString(): string {
  const { host, port, name, user, password } = config.database;
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}
