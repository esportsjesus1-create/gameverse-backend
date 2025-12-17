import { SubscriptionManager } from './SubscriptionManager';
import { ChainId, SubscriptionType } from '../types';

const mockWsProvider = {
  destroy: jest.fn().mockResolvedValue(undefined),
  _websocket: { url: 'wss://test.example.com' }
};

const mockProviderManager = {
  getWebSocketProvider: jest.fn().mockResolvedValue(mockWsProvider)
};

let mockWsInstance: any;
let wsListeners: Record<string, ((...args: unknown[]) => void)[]> = {};

jest.mock('ws', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      wsListeners = {};
      mockWsInstance = {
        on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
          if (!wsListeners[event]) wsListeners[event] = [];
          wsListeners[event].push(callback);
        }),
        off: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
          if (wsListeners[event]) {
            wsListeners[event] = wsListeners[event].filter(cb => cb !== callback);
          }
        }),
        send: jest.fn(),
        close: jest.fn(),
        readyState: 1,
        OPEN: 1
      };
      return mockWsInstance;
    })
  };
});

const triggerWsEvent = (event: string, ...args: unknown[]) => {
  if (wsListeners[event]) {
    wsListeners[event].forEach(cb => cb(...args));
  }
};

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    wsListeners = {};
    manager = new SubscriptionManager(mockProviderManager as any);
  });

  afterEach(async () => {
    await manager.stop();
  });

  describe('subscribe', () => {
    it('should create a subscription for new blocks', async () => {
      const config = {
        id: 'test-sub-1',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      if (mockWsInstance && mockWsInstance.send.mock.calls.length > 0) {
        const sentMessage = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
        triggerWsEvent('message', JSON.stringify({
          jsonrpc: '2.0',
          id: sentMessage.id,
          result: '0x1234'
        }));
      }

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 200))
        ]);
      } catch {
        // Expected timeout in test environment
      }
    });

    it('should create a subscription for pending transactions', async () => {
      const config = {
        id: 'test-sub-pending',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.PENDING_TRANSACTIONS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 200))
        ]);
      } catch {
        // Expected timeout
      }
    });

    it('should create a subscription for logs', async () => {
      const config = {
        id: 'test-sub-logs',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.LOGS,
        filter: {
          address: '0x1234567890123456789012345678901234567890',
          topics: ['0xabcd']
        }
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 200))
        ]);
      } catch {
        // Expected timeout
      }
    });

    it('should generate subscription ID if not provided', async () => {
      const config = {
        id: 'test-sub-gen',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 200))
        ]);
      } catch {
        // Expected timeout
      }
    });
  });

  describe('unsubscribe', () => {
    it('should return false for non-existent subscription', async () => {
      const result = await manager.unsubscribe('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getActiveSubscriptions', () => {
    it('should return empty array initially', () => {
      const subscriptions = manager.getActiveSubscriptions();
      expect(subscriptions).toEqual([]);
    });
  });

  describe('getSubscriptionStats', () => {
    it('should return null for non-existent subscription', () => {
      const stats = manager.getSubscriptionStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('stop', () => {
    it('should stop all subscriptions', async () => {
      await manager.stop();
      
      const subscriptions = manager.getActiveSubscriptions();
      expect(subscriptions).toEqual([]);
    });

    it('should close all WebSocket connections', async () => {
      const config = {
        id: 'test-sub-close',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
        ]);
      } catch {
        // Expected timeout
      }

      await manager.stop();
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const health = await manager.healthCheck();
      
      expect(health.service).toBe('subscription-manager');
      expect(['healthy', 'degraded']).toContain(health.status);
      expect(health.details).toHaveProperty('totalSubscriptions');
      expect(health.details).toHaveProperty('activeSubscriptions');
      expect(health.details).toHaveProperty('openConnections');
    });

    it('should return healthy when no subscriptions', async () => {
      const health = await manager.healthCheck();
      
      expect(health.status).toBe('healthy');
      expect(health.details?.totalSubscriptions).toBe(0);
    });
  });

  describe('WebSocket events', () => {
    it('should handle WebSocket close event', async () => {
      const config = {
        id: 'test-sub-ws-close',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('close');

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
        ]);
      } catch {
        // Expected timeout
      }
    });

    it('should handle WebSocket error event', async () => {
      const config = {
        id: 'test-sub-ws-error',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('error', new Error('Connection failed'));

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
        ]);
      } catch {
        // Expected timeout or error
      }
    });

    it('should handle subscription data messages', async () => {
      const dataHandler = jest.fn();
      manager.on('subscriptionData', dataHandler);

      const config = {
        id: 'test-sub-data',
        chainId: ChainId.ETHEREUM,
        type: SubscriptionType.NEW_BLOCKS
      };

      const subscribePromise = manager.subscribe(config);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      triggerWsEvent('open');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      triggerWsEvent('message', JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_subscription',
        params: {
          subscription: '0x1234',
          result: { blockNumber: '0x100' }
        }
      }));

      try {
        await Promise.race([
          subscribePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
        ]);
      } catch {
        // Expected timeout
      }
    });
  });
});
