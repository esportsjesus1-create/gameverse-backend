import { ChainId, SubscriptionType } from '../types';

const mockProviderManager = {
  initialize: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  executeRequest: jest.fn().mockResolvedValue({ result: '0x1' }),
  getProviderHealth: jest.fn().mockReturnValue([]),
  getAllProviderHealth: jest.fn().mockReturnValue(new Map()),
  healthCheck: jest.fn().mockResolvedValue({ service: 'provider-manager', status: 'healthy' }),
  on: jest.fn()
};

const mockGasPriceOracle = {
  start: jest.fn(),
  stop: jest.fn(),
  getGasPrice: jest.fn().mockResolvedValue({
    chainId: 1,
    slow: BigInt('18000000000'),
    standard: BigInt('20000000000'),
    fast: BigInt('25000000000'),
    instant: BigInt('30000000000'),
    timestamp: new Date()
  }),
  refreshGasPrice: jest.fn().mockResolvedValue({
    chainId: 1,
    slow: BigInt('18000000000'),
    standard: BigInt('20000000000'),
    fast: BigInt('25000000000'),
    instant: BigInt('30000000000'),
    timestamp: new Date()
  }),
  getGasPriceHistory: jest.fn().mockResolvedValue([]),
  healthCheck: jest.fn().mockResolvedValue({ service: 'gas-price-oracle', status: 'healthy' }),
  on: jest.fn()
};

const mockNonceManager = {
  start: jest.fn(),
  stop: jest.fn(),
  getNonce: jest.fn().mockResolvedValue(5),
  incrementNonce: jest.fn().mockResolvedValue(6),
  resetNonce: jest.fn().mockResolvedValue(undefined),
  syncNonce: jest.fn().mockResolvedValue(5),
  healthCheck: jest.fn().mockResolvedValue({ service: 'nonce-manager', status: 'healthy' }),
  on: jest.fn()
};

const mockReorgDetector = {
  start: jest.fn(),
  stop: jest.fn(),
  getReorgHistory: jest.fn().mockReturnValue([]),
  onReorg: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ service: 'reorg-detector', status: 'healthy' }),
  on: jest.fn()
};

const mockSubscriptionManager = {
  subscribe: jest.fn().mockResolvedValue('sub-1'),
  unsubscribe: jest.fn().mockResolvedValue(true),
  getActiveSubscriptions: jest.fn().mockReturnValue([]),
  stop: jest.fn().mockResolvedValue(undefined),
  healthCheck: jest.fn().mockResolvedValue({ service: 'subscription-manager', status: 'healthy' }),
  on: jest.fn()
};

const mockRateLimiter = {
  start: jest.fn(),
  stop: jest.fn(),
  isAllowed: jest.fn().mockResolvedValue(true),
  checkLimit: jest.fn().mockResolvedValue({ remaining: 99, resetAt: new Date() }),
  incrementCount: jest.fn().mockResolvedValue({ remaining: 98, resetAt: new Date() }),
  healthCheck: jest.fn().mockResolvedValue({ service: 'rate-limiter', status: 'healthy' }),
  on: jest.fn()
};

const mockHealthChecker = {
  start: jest.fn(),
  stop: jest.fn(),
  registerService: jest.fn(),
  checkAll: jest.fn().mockResolvedValue(new Map()),
  getOverallStatus: jest.fn().mockReturnValue('healthy'),
  toJSON: jest.fn().mockReturnValue({ status: 'healthy', services: {}, timestamp: new Date().toISOString() }),
  on: jest.fn()
};

jest.mock('./GasPriceOracle', () => ({
  GasPriceOracle: jest.fn(() => mockGasPriceOracle)
}));

jest.mock('./NonceManager', () => ({
  NonceManager: jest.fn(() => mockNonceManager)
}));

jest.mock('./ReorgDetector', () => ({
  ReorgDetector: jest.fn(() => mockReorgDetector)
}));

jest.mock('./SubscriptionManager', () => ({
  SubscriptionManager: jest.fn(() => mockSubscriptionManager)
}));

jest.mock('./RateLimiter', () => ({
  RateLimiter: jest.fn(() => mockRateLimiter)
}));

jest.mock('./HealthChecker', () => ({
  HealthChecker: jest.fn(() => mockHealthChecker)
}));

jest.mock('../providers/ProviderManager', () => ({
  ProviderManager: jest.fn(() => mockProviderManager)
}));

jest.mock('../database/postgres', () => ({
  postgresClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    initializeSchema: jest.fn().mockResolvedValue(undefined)
  },
  RpcEndpointRepository: jest.fn(() => ({
    findAll: jest.fn().mockResolvedValue([])
  }))
}));

jest.mock('../database/redis', () => ({
  redisClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined)
  }
}));

import { ChainGateway } from './ChainGateway';

describe('ChainGateway', () => {
  let gateway: ChainGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ChainGateway();
  });

  afterEach(async () => {
    await gateway.shutdown();
  });

  describe('initialize', () => {
    it('should initialize all services', async () => {
      await gateway.initialize();
      
      expect(mockProviderManager.initialize).toHaveBeenCalled();
    });

    it('should not initialize twice', async () => {
      await gateway.initialize();
      await gateway.initialize();
      
      expect(mockProviderManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('shutdown', () => {
    it('should shutdown all services', async () => {
      await gateway.initialize();
      await gateway.shutdown();
      
      expect(mockProviderManager.stop).toHaveBeenCalled();
    });
  });

  describe('executeRpcRequest', () => {
    it('should execute RPC request', async () => {
      await gateway.initialize();
      
      const result = await gateway.executeRpcRequest(ChainId.ETHEREUM, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      });
      
      expect(result).toHaveProperty('result');
    });

    it('should throw for invalid chain', async () => {
      await gateway.initialize();
      
      await expect(
        gateway.executeRpcRequest(999 as ChainId, {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        })
      ).rejects.toThrow();
    });
  });

  describe('getGasPrice', () => {
    it('should get gas price', async () => {
      await gateway.initialize();
      
      const result = await gateway.getGasPrice(ChainId.ETHEREUM);
      
      expect(result).toHaveProperty('chainId');
    });

    it('should throw for invalid chain', async () => {
      await expect(gateway.getGasPrice(999 as ChainId)).rejects.toThrow();
    });
  });

  describe('refreshGasPrice', () => {
    it('should refresh gas price', async () => {
      await gateway.initialize();
      
      const result = await gateway.refreshGasPrice(ChainId.ETHEREUM);
      
      expect(result).toHaveProperty('chainId');
    });
  });

  describe('getGasPriceHistory', () => {
    it('should get gas price history', async () => {
      await gateway.initialize();
      
      const result = await gateway.getGasPriceHistory(ChainId.ETHEREUM);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getNonce', () => {
    it('should get nonce', async () => {
      await gateway.initialize();
      
      const result = await gateway.getNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(result).toBe(5);
    });

    it('should throw for invalid address', async () => {
      await gateway.initialize();
      
      await expect(
        gateway.getNonce(ChainId.ETHEREUM, 'invalid-address')
      ).rejects.toThrow();
    });
  });

  describe('incrementNonce', () => {
    it('should increment nonce', async () => {
      await gateway.initialize();
      
      const result = await gateway.incrementNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(result).toBe(6);
    });
  });

  describe('resetNonce', () => {
    it('should reset nonce', async () => {
      await gateway.initialize();
      
      await gateway.resetNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(mockNonceManager.resetNonce).toHaveBeenCalled();
    });
  });

  describe('syncNonce', () => {
    it('should sync nonce', async () => {
      await gateway.initialize();
      
      const result = await gateway.syncNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(result).toBe(5);
    });
  });

  describe('subscribe', () => {
    it('should create subscription', async () => {
      await gateway.initialize();
      
      const result = await gateway.subscribe({
        id: 'test-sub',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      });
      
      expect(result).toBe('sub-1');
    });

    it('should throw for invalid chain', async () => {
      await gateway.initialize();
      
      await expect(
        gateway.subscribe({ id: 'test-sub', chainId: 999 as ChainId, type: SubscriptionType.NEW_BLOCKS })
      ).rejects.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe', async () => {
      await gateway.initialize();
      
      const result = await gateway.unsubscribe('sub-1');
      
      expect(result).toBe(true);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should get active subscriptions', async () => {
      await gateway.initialize();
      
      const result = gateway.getActiveSubscriptions();
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getReorgHistory', () => {
    it('should get reorg history', async () => {
      await gateway.initialize();
      
      const result = await gateway.getReorgHistory(ChainId.ETHEREUM);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getProviderHealth', () => {
    it('should get provider health', async () => {
      await gateway.initialize();
      
      const result = gateway.getProviderHealth(ChainId.ETHEREUM);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getAllProviderHealth', () => {
    it('should get all provider health', async () => {
      await gateway.initialize();
      
      const result = gateway.getAllProviderHealth();
      
      expect(result instanceof Map).toBe(true);
    });
  });

  describe('getHealth', () => {
    it('should get health status', async () => {
      await gateway.initialize();
      
      const result = await gateway.getHealth();
      
      expect(result).toHaveProperty('status');
    });
  });

  describe('checkRateLimit', () => {
    it('should check rate limit', async () => {
      await gateway.initialize();
      
      const result = await gateway.checkRateLimit('test-client');
      
      expect(result).toHaveProperty('allowed');
      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('resetAt');
    });
  });

  describe('onReorg', () => {
    it('should register reorg callback', async () => {
      await gateway.initialize();
      
      const callback = jest.fn();
      gateway.onReorg(callback);
      
      expect(mockReorgDetector.onReorg).toHaveBeenCalledWith(callback);
    });
  });
});
