export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'gameverse_social',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
  },
  gamerstake: {
    apiUrl: process.env.GAMERSTAKE_API_URL || 'https://api.gamerstake.com',
    apiKey: process.env.GAMERSTAKE_API_KEY || '',
    syncIntervalMs: parseInt(process.env.GAMERSTAKE_SYNC_INTERVAL_MS || '300000', 10),
  },
  presence: {
    offlineTimeoutMs: parseInt(process.env.PRESENCE_OFFLINE_TIMEOUT_MS || '300000', 10),
    heartbeatIntervalMs: parseInt(process.env.PRESENCE_HEARTBEAT_INTERVAL_MS || '30000', 10),
  },
});
