import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3017', 10),
  wsPort: parseInt(process.env.WS_PORT || '3018', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-lobby',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_lobby',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'lobby:',
  },
  
  lobby: {
    maxPlayersDefault: parseInt(process.env.MAX_PLAYERS_DEFAULT || '10', 10),
    minPlayersDefault: parseInt(process.env.MIN_PLAYERS_DEFAULT || '2', 10),
    readyCheckTimeout: parseInt(process.env.READY_CHECK_TIMEOUT || '30000', 10),
    countdownDuration: parseInt(process.env.COUNTDOWN_DURATION || '5000', 10),
    inviteCodeLength: parseInt(process.env.INVITE_CODE_LENGTH || '6', 10),
    inviteExpiry: parseInt(process.env.INVITE_EXPIRY || '3600000', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '60000', 10),
    inactivityTimeout: parseInt(process.env.INACTIVITY_TIMEOUT || '300000', 10),
  },
  
  websocket: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '10000', 10),
    maxPayloadSize: parseInt(process.env.WS_MAX_PAYLOAD || '65536', 10),
  },
};

export default config;
