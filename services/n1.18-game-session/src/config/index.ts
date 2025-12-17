import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  postgres: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'gameverse',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  
  reconnectionToken: {
    ttlSeconds: parseInt(process.env.RECONNECT_TOKEN_TTL || '300', 10),
    tokenLength: 32,
  },
  
  mvp: {
    weights: {
      kill: parseFloat(process.env.MVP_KILL_WEIGHT || '10'),
      death: parseFloat(process.env.MVP_DEATH_WEIGHT || '-5'),
      assist: parseFloat(process.env.MVP_ASSIST_WEIGHT || '5'),
      damageDealt: parseFloat(process.env.MVP_DAMAGE_DEALT_WEIGHT || '0.01'),
      damageReceived: parseFloat(process.env.MVP_DAMAGE_RECEIVED_WEIGHT || '-0.005'),
      objective: parseFloat(process.env.MVP_OBJECTIVE_WEIGHT || '15'),
    },
  },
};
