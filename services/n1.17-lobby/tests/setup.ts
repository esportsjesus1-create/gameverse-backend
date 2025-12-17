jest.mock('../src/database/pool', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn()
    }),
    end: jest.fn()
  },
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  closeDatabase: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../src/services/redis.service', () => {
  const mockRedisService = {
    cacheLobby: jest.fn().mockResolvedValue(undefined),
    getCachedLobby: jest.fn().mockResolvedValue(null),
    invalidateLobbyCache: jest.fn().mockResolvedValue(undefined),
    setCountdownState: jest.fn().mockResolvedValue(undefined),
    getCountdownState: jest.fn().mockResolvedValue(null),
    deleteCountdownState: jest.fn().mockResolvedValue(undefined),
    setPlayerSession: jest.fn().mockResolvedValue(undefined),
    getPlayerSession: jest.fn().mockResolvedValue(null),
    deletePlayerSession: jest.fn().mockResolvedValue(undefined),
    addToLobbyConnections: jest.fn().mockResolvedValue(undefined),
    removeFromLobbyConnections: jest.fn().mockResolvedValue(undefined),
    getLobbyConnections: jest.fn().mockResolvedValue([]),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue(true)
  };
  
  return {
    RedisService: jest.fn().mockImplementation(() => mockRedisService),
    redisService: mockRedisService
  };
});

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
