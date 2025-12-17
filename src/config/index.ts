import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3015', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-royalty-split',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_royalty',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  blockchain: {
    rpcUrls: {
      1: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
      137: process.env.POLYGON_RPC_URL || 'https://polygon.llamarpc.com',
      56: process.env.BSC_RPC_URL || 'https://bsc.llamarpc.com',
    },
    payoutWalletKey: process.env.PAYOUT_WALLET_KEY || '',
  },
  
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000', 10),
  },
};

export default config;
