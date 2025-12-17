import { ChainId, ProviderType, ProviderStatus, RpcEndpoint, ProviderHealth } from '../types';

export const createMockEndpoint = (overrides: Partial<RpcEndpoint> = {}): RpcEndpoint => ({
  id: 'test-endpoint-1',
  chainId: ChainId.ETHEREUM,
  providerType: ProviderType.INFURA,
  httpUrl: 'https://mainnet.infura.io/v3/',
  wsUrl: 'wss://mainnet.infura.io/ws/v3/',
  apiKey: 'test-api-key',
  priority: 1,
  weight: 100,
  maxRetries: 3,
  timeout: 30000,
  rateLimit: 100,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

export const createMockProviderHealth = (overrides: Partial<ProviderHealth> = {}): ProviderHealth => ({
  endpointId: 'test-endpoint-1',
  status: ProviderStatus.HEALTHY,
  latency: 50,
  lastCheck: new Date(),
  errorCount: 0,
  successCount: 100,
  blockHeight: 12345678,
  ...overrides
});

export const createMockProvider = () => ({
  send: jest.fn().mockResolvedValue('0x1'),
  getBlockNumber: jest.fn().mockResolvedValue(12345678),
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: BigInt('20000000000'),
    maxFeePerGas: BigInt('30000000000'),
    maxPriorityFeePerGas: BigInt('2000000000')
  }),
  destroy: jest.fn()
});

export const createMockWebSocket = () => {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event].push(callback);
    }),
    off: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(cb => cb !== callback);
      }
    }),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
    emit: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        listeners[event].forEach(cb => cb(...args));
      }
    },
    OPEN: 1
  };
};

export const mockRedisOperations = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  ttl: jest.fn().mockResolvedValue(-1),
  exists: jest.fn().mockResolvedValue(0),
  hget: jest.fn().mockResolvedValue(null),
  hset: jest.fn().mockResolvedValue(1),
  hgetall: jest.fn().mockResolvedValue({}),
  hdel: jest.fn().mockResolvedValue(1),
  lpush: jest.fn().mockResolvedValue(1),
  lrange: jest.fn().mockResolvedValue([]),
  ltrim: jest.fn().mockResolvedValue('OK'),
  eval: jest.fn().mockResolvedValue([1, 1, 60000])
};

export const mockPostgresOperations = {
  query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined)
};
