import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-identity',
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    issuer: process.env.JWT_ISSUER || 'gameverse-identity',
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_identity',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    sessionTtl: parseInt(process.env.SESSION_TTL || '86400', 10),
  },
  
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID || '',
      clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
      callbackUrl: process.env.DISCORD_CALLBACK_URL || '/auth/discord/callback',
    },
  },
  
  web3: {
    supportedChains: [1, 137, 56, 43114, 42161, 10, 8453],
    messagePrefix: 'Sign this message to authenticate with GameVerse: ',
    nonceExpiry: 300,
  },
  
  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },
};

export default config;
