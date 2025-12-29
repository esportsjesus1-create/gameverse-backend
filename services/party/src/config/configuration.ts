export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'gameverse_party',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  gamerstake: {
    apiUrl: process.env.GAMERSTAKE_API_URL || 'https://api.gamerstake.com/v1',
    apiKey: process.env.GAMERSTAKE_API_KEY || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  party: {
    maxSize: parseInt(process.env.PARTY_MAX_SIZE || '100', 10),
    defaultMaxSize: parseInt(process.env.PARTY_DEFAULT_MAX_SIZE || '4', 10),
    inviteExpiryHours: parseInt(process.env.PARTY_INVITE_EXPIRY_HOURS || '24', 10),
    cacheTtlSeconds: parseInt(process.env.PARTY_CACHE_TTL_SECONDS || '900', 10),
    readyCheckTimeoutSeconds: parseInt(process.env.PARTY_READY_CHECK_TIMEOUT || '30', 10),
    maxMatchmakingWaitSeconds: parseInt(process.env.PARTY_MAX_MATCHMAKING_WAIT || '600', 10),
  },
});
