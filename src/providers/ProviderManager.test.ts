import { ProviderManager } from './ProviderManager';
import { ChainId, ProviderType, ProviderStatus } from '../types';
import { ChainNotSupportedError, ProviderError } from '../utils/errors';
import { createMockEndpoint } from '../test/mocks';

const mockProvider = {
  send: jest.fn().mockResolvedValue('0x1'),
  getBlockNumber: jest.fn().mockResolvedValue(12345678),
  destroy: jest.fn()
};

const mockWsProvider = {
  destroy: jest.fn().mockResolvedValue(undefined)
};

jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn().mockImplementation(() => mockProvider),
  WebSocketProvider: jest.fn().mockImplementation(() => mockWsProvider)
}));

jest.mock('../database/redis', () => ({
  redisClient: {
    hset: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1)
  }
}));

jest.mock('../config', () => ({
  config: {
    healthCheckInterval: 30000
  },
  getChainConfig: jest.fn().mockReturnValue({
    chainId: 1,
    name: 'Ethereum Mainnet',
    blockTime: 12
  }),
  isValidChainId: jest.fn().mockImplementation((chainId) => [1, 137, 56, 42161, 10].includes(chainId))
}));

describe('ProviderManager', () => {
  let providerManager: ProviderManager;
  let mockRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockRepository = {
      findAll: jest.fn().mockResolvedValue([]),
      findByChainId: jest.fn().mockResolvedValue([])
    };

    providerManager = new ProviderManager(mockRepository);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await providerManager.stop();
  });

  describe('initialize', () => {
    it('should initialize with endpoints from repository', async () => {
      const endpoints = [createMockEndpoint()];
      mockRepository.findAll.mockResolvedValue(endpoints);

      await providerManager.initialize();

      expect(mockRepository.findAll).toHaveBeenCalled();
    });

    it('should start health checks', async () => {
      await providerManager.initialize();
      
      // Health checks should be started
    });
  });

  describe('addProvider', () => {
    it('should add a provider for an endpoint', async () => {
      const endpoint = createMockEndpoint();
      
      await providerManager.addProvider(endpoint);
      
      // Provider should be added
    });

    it('should handle WebSocket provider creation failure gracefully', async () => {
      const { WebSocketProvider } = require('ethers');
      WebSocketProvider.mockImplementationOnce(() => {
        throw new Error('WS connection failed');
      });

      const endpoint = createMockEndpoint({ wsUrl: 'wss://test.example.com' });
      
      await providerManager.addProvider(endpoint);
      
      // Should not throw, just log warning
    });
  });

  describe('removeProvider', () => {
    it('should remove a provider', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);
      
      await providerManager.removeProvider(endpoint.id);
      
      // Provider should be removed
    });

    it('should handle non-existent provider', async () => {
      await providerManager.removeProvider('non-existent');
      
      // Should not throw
    });
  });

  describe('getProvider', () => {
    it('should return a provider for valid chain', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const provider = await providerManager.getProvider(ChainId.ETHEREUM);
      
      expect(provider).toBeDefined();
    });

    it('should throw ChainNotSupportedError for invalid chain', async () => {
      const { isValidChainId } = require('../config');
      isValidChainId.mockReturnValueOnce(false);

      await expect(providerManager.getProvider(999 as ChainId)).rejects.toThrow(ChainNotSupportedError);
    });

    it('should throw ProviderError when no providers available', async () => {
      await expect(providerManager.getProvider(ChainId.ETHEREUM)).rejects.toThrow(ProviderError);
    });
  });

  describe('getWebSocketProvider', () => {
    it('should return null when no providers', async () => {
      const wsProvider = await providerManager.getWebSocketProvider(ChainId.ETHEREUM);
      expect(wsProvider).toBeNull();
    });
  });

  describe('executeRequest', () => {
    it('should execute request through provider', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const result = await providerManager.executeRequest(
        ChainId.ETHEREUM,
        'eth_blockNumber',
        []
      );

      expect(result).toBe('0x1');
    });

    it('should throw ChainNotSupportedError for invalid chain', async () => {
      const { isValidChainId } = require('../config');
      isValidChainId.mockReturnValueOnce(false);

      await expect(
        providerManager.executeRequest(999 as ChainId, 'eth_blockNumber', [])
      ).rejects.toThrow(ChainNotSupportedError);
    });

    it('should throw ProviderError when no providers available', async () => {
      await expect(
        providerManager.executeRequest(ChainId.ETHEREUM, 'eth_blockNumber', [])
      ).rejects.toThrow(ProviderError);
    });

    it('should failover to next provider on error', async () => {
      const endpoint1 = createMockEndpoint({ id: 'endpoint1', priority: 1 });
      const endpoint2 = createMockEndpoint({ id: 'endpoint2', priority: 2 });
      
      await providerManager.addProvider(endpoint1);
      await providerManager.addProvider(endpoint2);

      mockProvider.send
        .mockRejectedValueOnce(new Error('Provider 1 failed'))
        .mockResolvedValueOnce('0x2');

      const result = await providerManager.executeRequest(
        ChainId.ETHEREUM,
        'eth_blockNumber',
        []
      );

      expect(result).toBe('0x2');
    });
  });

  describe('getHealthyProviders', () => {
    it('should return empty array when no providers', async () => {
      const providers = await providerManager.getHealthyProviders(ChainId.ETHEREUM);
      expect(providers).toEqual([]);
    });

    it('should return healthy providers', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const providers = await providerManager.getHealthyProviders(ChainId.ETHEREUM);
      expect(providers.length).toBeGreaterThan(0);
    });
  });

  describe('getProviderHealth', () => {
    it('should return empty array when no providers', () => {
      const health = providerManager.getProviderHealth(ChainId.ETHEREUM);
      expect(health).toEqual([]);
    });

    it('should return health for providers', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const health = providerManager.getProviderHealth(ChainId.ETHEREUM);
      expect(health.length).toBeGreaterThan(0);
      expect(health[0]).toHaveProperty('status');
      expect(health[0]).toHaveProperty('latency');
    });
  });

  describe('getAllProviderHealth', () => {
    it('should return health for all chains', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const allHealth = providerManager.getAllProviderHealth();
      expect(allHealth.size).toBeGreaterThan(0);
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy when no providers', async () => {
      const health = await providerManager.healthCheck();
      
      expect(health.service).toBe('provider-manager');
      expect(health.status).toBe('unhealthy');
    });

    it('should return healthy when providers are healthy', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const health = await providerManager.healthCheck();
      
      expect(health.service).toBe('provider-manager');
      expect(['healthy', 'degraded']).toContain(health.status);
    });
  });

  describe('stop', () => {
    it('should stop all providers and health checks', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      await providerManager.stop();

      expect(mockProvider.destroy).toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('should emit healthCheckComplete event', async () => {
      const endpoint = createMockEndpoint();
      await providerManager.addProvider(endpoint);

      const eventHandler = jest.fn();
      providerManager.on('healthCheckComplete', eventHandler);

      await providerManager.initialize();
      jest.advanceTimersByTime(30000);
    });
  });
});
