import { NonceManager } from './NonceManager';
import { ChainId } from '../types';
import { NonceError } from '../utils/errors';

const mockRedisGet = jest.fn().mockResolvedValue(null);
const mockRedisSet = jest.fn().mockResolvedValue(undefined);
const mockRedisDel = jest.fn().mockResolvedValue(1);

jest.mock('../database/redis', () => ({
  redisClient: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    getClient: jest.fn().mockReturnValue({
      set: jest.fn().mockResolvedValue('OK')
    })
  }
}));

const mockProviderManager = {
  executeRequest: jest.fn().mockResolvedValue('0x5')
};

jest.mock('../config', () => ({
  config: {
    nonceTtl: 300000
  }
}));

describe('NonceManager', () => {
  let nonceManager: NonceManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue(undefined);
    mockRedisDel.mockResolvedValue(1);
    mockProviderManager.executeRequest.mockResolvedValue('0x5');
    nonceManager = new NonceManager(mockProviderManager as any);
  });

  describe('getNonce', () => {
    it('should fetch nonce from chain when not cached', async () => {
      const nonce = await nonceManager.getNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(mockProviderManager.executeRequest).toHaveBeenCalledWith(
        ChainId.ETHEREUM,
        'eth_getTransactionCount',
        ['0x1234567890123456789012345678901234567890', 'pending']
      );
      expect(nonce).toBe(5);
    });

    it('should return cached nonce when available', async () => {
      mockRedisGet.mockResolvedValue('10');

      const nonce = await nonceManager.getNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(nonce).toBe(10);
    });

    it('should normalize address to lowercase', async () => {
      await nonceManager.getNonce(ChainId.ETHEREUM, '0xABCD567890123456789012345678901234567890');
      
      expect(mockProviderManager.executeRequest).toHaveBeenCalledWith(
        ChainId.ETHEREUM,
        'eth_getTransactionCount',
        ['0xabcd567890123456789012345678901234567890', 'pending']
      );
    });

    it('should throw NonceError when provider fails', async () => {
      mockProviderManager.executeRequest.mockRejectedValueOnce(new Error('Provider error'));

      await expect(
        nonceManager.getNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890')
      ).rejects.toThrow(NonceError);
    });
  });

  describe('incrementNonce', () => {
    it('should increment pending nonce', async () => {
      mockRedisGet.mockResolvedValue('5');

      const newNonce = await nonceManager.incrementNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(newNonce).toBe(6);
    });
  });

  describe('resetNonce', () => {
    it('should reset nonce to on-chain value', async () => {
      mockProviderManager.executeRequest.mockResolvedValueOnce('0xa');

      await nonceManager.resetNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(mockProviderManager.executeRequest).toHaveBeenCalled();
    });

    it('should emit nonceReset event', async () => {
      const eventHandler = jest.fn();
      nonceManager.on('nonceReset', eventHandler);

      await nonceManager.resetNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('confirmNonce', () => {
    it('should update cached nonce after confirmation', async () => {
      const eventHandler = jest.fn();
      nonceManager.on('nonceConfirmed', eventHandler);

      await nonceManager.confirmNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890', 5);

      expect(eventHandler).toHaveBeenCalledWith({
        chainId: ChainId.ETHEREUM,
        address: '0x1234567890123456789012345678901234567890',
        nonce: 5
      });
    });
  });

  describe('syncNonce', () => {
    it('should sync nonce with on-chain value', async () => {
      mockProviderManager.executeRequest.mockResolvedValueOnce('0xf');

      const nonce = await nonceManager.syncNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(nonce).toBe(15);
    });

    it('should emit nonceSynced event when on-chain is ahead', async () => {
      mockProviderManager.executeRequest.mockResolvedValueOnce('0x14');
      mockRedisGet.mockResolvedValue('10');

      const eventHandler = jest.fn();
      nonceManager.on('nonceSynced', eventHandler);

      await nonceManager.syncNonce(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('detectNonceGap', () => {
    it('should return empty array when no gap', async () => {
      mockProviderManager.executeRequest.mockResolvedValueOnce('0x5');
      mockRedisGet.mockResolvedValue('5');

      const gaps = await nonceManager.detectNonceGap(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(gaps).toEqual([]);
    });

    it('should detect nonce gaps', async () => {
      mockProviderManager.executeRequest.mockResolvedValueOnce('0x5');
      mockRedisGet.mockResolvedValue('8');

      const eventHandler = jest.fn();
      nonceManager.on('nonceGapDetected', eventHandler);

      const gaps = await nonceManager.detectNonceGap(ChainId.ETHEREUM, '0x1234567890123456789012345678901234567890');
      
      expect(gaps).toEqual([5, 6, 7]);
      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status', async () => {
      const health = await nonceManager.healthCheck();
      
      expect(health.service).toBe('nonce-manager');
      expect(health.status).toBe('healthy');
    });
  });
});
