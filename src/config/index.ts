import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3018', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-game-session',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_session',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: 'session:',
  },
  
  session: {
    maxDuration: parseInt(process.env.MAX_SESSION_DURATION || '3600000', 10),
    reconnectionTimeout: parseInt(process.env.RECONNECTION_TIMEOUT || '120000', 10),
    tokenSecret: process.env.TOKEN_SECRET || 'gameverse-session-secret',
    tokenExpiry: parseInt(process.env.TOKEN_EXPIRY || '300000', 10),
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '60000', 10),
  },
  
  mvp: {
    killWeight: parseInt(process.env.MVP_KILL_WEIGHT || '100', 10),
    assistWeight: parseInt(process.env.MVP_ASSIST_WEIGHT || '50', 10),
    deathWeight: parseInt(process.env.MVP_DEATH_WEIGHT || '-25', 10),
    objectiveWeight: parseInt(process.env.MVP_OBJECTIVE_WEIGHT || '150', 10),
    damageWeight: parseInt(process.env.MVP_DAMAGE_WEIGHT || '10', 10),
    healingWeight: parseInt(process.env.MVP_HEALING_WEIGHT || '15', 10),
    survivalWeight: parseInt(process.env.MVP_SURVIVAL_WEIGHT || '5', 10),
  },
};

export default config;
