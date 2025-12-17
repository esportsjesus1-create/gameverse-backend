import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3026', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: 'gameverse-tournament',
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'gameverse_tournament',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
  },
  
  tournament: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
    maxParticipants: parseInt(process.env.MAX_PARTICIPANTS || '256', 10),
    checkInReminderMinutes: parseInt(process.env.CHECK_IN_REMINDER || '15', 10),
  },
};

export default config;
