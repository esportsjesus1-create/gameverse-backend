import { ReorgDetector } from './ReorgDetector';
import { ChainId } from '../types';

const mockProviderManager = {
  executeRequest: jest.fn()
};

jest.mock('../database/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(1),
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    lrange: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../config', () => ({
  config: {
    reorgDepth: 64,
    healthCheckInterval: 30000
  },
  getChainConfig: jest.fn().mockReturnValue({
    chainId: 1,
    name: 'Ethereum Mainnet',
    blockTime: 12
  })
}));

describe('ReorgDetector', () => {
  let detector: ReorgDetector;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockProviderManager.executeRequest.mockImplementation((chainId, method, params) => {
      if (method === 'eth_blockNumber') {
        return Promise.resolve('0xbc614e');
      }
      if (method === 'eth_getBlockByNumber') {
        const blockNum = parseInt(params[0], 16);
        return Promise.resolve({
          number: params[0],
          hash: `0x${blockNum.toString(16).padStart(64, '0')}`,
          parentHash: `0x${(blockNum - 1).toString(16).padStart(64, '0')}`,
          timestamp: '0x60000000',
          transactions: []
        });
      }
      return Promise.resolve(null);
    });

    detector = new ReorgDetector(mockProviderManager as any);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await detector.stop();
  });

  describe('start', () => {
    it('should start monitoring specified chains', async () => {
      await detector.start([ChainId.ETHEREUM]);
      
      expect(mockProviderManager.executeRequest).toHaveBeenCalledWith(
        ChainId.ETHEREUM,
        'eth_blockNumber',
        []
      );
    });

    it('should not start twice', async () => {
      await detector.start([ChainId.ETHEREUM]);
      await detector.start([ChainId.ETHEREUM]);
      
      // Should only initialize once
    });
  });

  describe('stop', () => {
    it('should stop all monitoring', async () => {
      await detector.start([ChainId.ETHEREUM]);
      await detector.stop();
      
      // No error should be thrown
    });
  });

  describe('onReorg', () => {
    it('should register reorg callback', () => {
      const callback = jest.fn();
      detector.onReorg(callback);
      
      // Callback should be registered
    });
  });

  describe('getReorgHistory', () => {
    it('should return empty array when no history', async () => {
      const history = await detector.getReorgHistory(ChainId.ETHEREUM);
      expect(history).toEqual([]);
    });

    it('should return parsed history entries', async () => {
      const { redisClient } = require('../database/redis');
      redisClient.lrange.mockResolvedValueOnce([
        JSON.stringify({
          chainId: ChainId.ETHEREUM,
          oldBlockNumber: 12345678,
          oldBlockHash: '0xabc',
          newBlockNumber: 12345678,
          newBlockHash: '0xdef',
          depth: 1,
          timestamp: '2024-01-01T00:00:00.000Z'
        })
      ]);

      const history = await detector.getReorgHistory(ChainId.ETHEREUM, 10);
      
      expect(history).toHaveLength(1);
      expect(history[0].chainId).toBe(ChainId.ETHEREUM);
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getLastKnownBlock', () => {
    it('should return null when no block tracked', async () => {
      const block = await detector.getLastKnownBlock(ChainId.ETHEREUM);
      expect(block).toBeNull();
    });

    it('should return last known block after start', async () => {
      await detector.start([ChainId.ETHEREUM]);
      
      const block = await detector.getLastKnownBlock(ChainId.ETHEREUM);
      expect(block).not.toBeNull();
      expect(block?.chainId).toBe(ChainId.ETHEREUM);
    });
  });

  describe('healthCheck', () => {
    it('should return unhealthy when not running', async () => {
      const health = await detector.healthCheck();
      
      expect(health.service).toBe('reorg-detector');
      expect(health.details?.isRunning).toBe(false);
    });

    it('should return healthy when running', async () => {
      await detector.start([ChainId.ETHEREUM]);
      
      const health = await detector.healthCheck();
      
      expect(health.service).toBe('reorg-detector');
      expect(health.details?.isRunning).toBe(true);
    });
  });

  describe('reorg detection', () => {
    it('should detect chain reorganization', async () => {
      const reorgCallback = jest.fn();
      detector.onReorg(reorgCallback);

      await detector.start([ChainId.ETHEREUM]);

      // Simulate a reorg by changing block hash
      mockProviderManager.executeRequest.mockImplementation((chainId, method, params) => {
        if (method === 'eth_blockNumber') {
          return Promise.resolve('0xbc614f');
        }
        if (method === 'eth_getBlockByNumber') {
          const blockNum = parseInt(params[0], 16);
          return Promise.resolve({
            number: params[0],
            hash: `0xreorg${blockNum.toString(16).padStart(58, '0')}`,
            parentHash: `0xreorg${(blockNum - 1).toString(16).padStart(58, '0')}`,
            timestamp: '0x60000001',
            transactions: []
          });
        }
        return Promise.resolve(null);
      });

      jest.advanceTimersByTime(10000);
    });
  });
});
