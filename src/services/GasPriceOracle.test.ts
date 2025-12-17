import { GasPriceOracle } from './GasPriceOracle';
import { ChainId } from '../types';
import { ProviderError } from '../utils/errors';

const mockProvider = {
  getFeeData: jest.fn().mockResolvedValue({
    gasPrice: BigInt('20000000000'),
    maxFeePerGas: BigInt('30000000000'),
    maxPriorityFeePerGas: BigInt('2000000000')
  })
};

const mockProviderManager = {
  getProvider: jest.fn().mockResolvedValue(mockProvider),
  executeRequest: jest.fn()
};

jest.mock('../database/redis', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    lpush: jest.fn().mockResolvedValue(1),
    ltrim: jest.fn().mockResolvedValue('OK'),
    lrange: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('../config', () => ({
  config: {
    gasPriceTtl: 15000
  },
  getChainConfig: jest.fn().mockReturnValue({
    chainId: 1,
    name: 'Ethereum Mainnet',
    isEIP1559: true
  })
}));

describe('GasPriceOracle', () => {
  let oracle: GasPriceOracle;

  beforeEach(() => {
    jest.clearAllMocks();
    oracle = new GasPriceOracle(mockProviderManager as any);
  });

  afterEach(async () => {
    await oracle.stop();
  });

  describe('getGasPrice', () => {
    it('should fetch gas price for EIP-1559 chain', async () => {
      const gasPrice = await oracle.getGasPrice(ChainId.ETHEREUM);
      
      expect(gasPrice).toHaveProperty('chainId', ChainId.ETHEREUM);
      expect(gasPrice).toHaveProperty('slow');
      expect(gasPrice).toHaveProperty('standard');
      expect(gasPrice).toHaveProperty('fast');
      expect(gasPrice).toHaveProperty('instant');
      expect(gasPrice).toHaveProperty('baseFee');
      expect(gasPrice).toHaveProperty('maxPriorityFee');
      expect(gasPrice).toHaveProperty('timestamp');
    });

    it('should return cached gas price if available', async () => {
      const { redisClient } = require('../database/redis');
      const cachedData = JSON.stringify({
        chainId: ChainId.ETHEREUM,
        slow: '18000000000',
        standard: '20000000000',
        fast: '25000000000',
        instant: '30000000000',
        baseFee: '15000000000',
        maxPriorityFee: '2000000000',
        timestamp: new Date().toISOString()
      });
      redisClient.get.mockResolvedValueOnce(cachedData);

      const gasPrice = await oracle.getGasPrice(ChainId.ETHEREUM);
      
      expect(gasPrice.chainId).toBe(ChainId.ETHEREUM);
      expect(typeof gasPrice.slow).toBe('bigint');
    });
  });

  describe('refreshGasPrice', () => {
    it('should fetch fresh gas price from provider', async () => {
      const gasPrice = await oracle.refreshGasPrice(ChainId.ETHEREUM);
      
      expect(mockProviderManager.getProvider).toHaveBeenCalledWith(ChainId.ETHEREUM);
      expect(gasPrice).toHaveProperty('chainId', ChainId.ETHEREUM);
    });

    it('should emit gasPriceUpdated event', async () => {
      const eventHandler = jest.fn();
      oracle.on('gasPriceUpdated', eventHandler);

      await oracle.refreshGasPrice(ChainId.ETHEREUM);

      expect(eventHandler).toHaveBeenCalled();
    });

    it('should throw ProviderError on failure', async () => {
      mockProviderManager.getProvider.mockRejectedValueOnce(new Error('Provider unavailable'));

      await expect(oracle.refreshGasPrice(ChainId.ETHEREUM)).rejects.toThrow(ProviderError);
    });
  });

  describe('getGasPriceHistory', () => {
    it('should return empty array when no history', async () => {
      const history = await oracle.getGasPriceHistory(ChainId.ETHEREUM);
      expect(history).toEqual([]);
    });

    it('should return parsed history entries', async () => {
      const { redisClient } = require('../database/redis');
      redisClient.lrange.mockResolvedValueOnce([
        JSON.stringify({ standard: '20000000000', timestamp: '2024-01-01T00:00:00.000Z' }),
        JSON.stringify({ standard: '21000000000', timestamp: '2024-01-01T00:01:00.000Z' })
      ]);

      const history = await oracle.getGasPriceHistory(ChainId.ETHEREUM, 10);
      
      expect(history).toHaveLength(2);
      expect(typeof history[0].price).toBe('bigint');
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getAverageGasPrice', () => {
    it('should return null when no recent history', async () => {
      const average = await oracle.getAverageGasPrice(ChainId.ETHEREUM);
      expect(average).toBeNull();
    });

    it('should calculate average from recent prices', async () => {
      const { redisClient } = require('../database/redis');
      const now = new Date();
      redisClient.lrange.mockResolvedValueOnce([
        JSON.stringify({ standard: '20000000000', timestamp: now.toISOString() }),
        JSON.stringify({ standard: '22000000000', timestamp: now.toISOString() })
      ]);

      const average = await oracle.getAverageGasPrice(ChainId.ETHEREUM, 300000);
      
      expect(average).toBe(BigInt('21000000000'));
    });
  });

  describe('start and stop', () => {
    it('should start refresh loops for specified chains', async () => {
      await oracle.start([ChainId.ETHEREUM]);
      
      expect(mockProviderManager.getProvider).toHaveBeenCalled();
    });

    it('should stop all refresh loops', async () => {
      await oracle.start([ChainId.ETHEREUM]);
      await oracle.stop();
      
      // No error should be thrown
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const health = await oracle.healthCheck();
      
      expect(health.service).toBe('gas-price-oracle');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });
});

describe('GasPriceOracle - Legacy Gas Price', () => {
  let oracle: GasPriceOracle;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const { getChainConfig } = require('../config');
    getChainConfig.mockReturnValue({
      chainId: ChainId.BSC,
      name: 'BNB Smart Chain',
      isEIP1559: false
    });

    oracle = new GasPriceOracle(mockProviderManager as any);
  });

  afterEach(async () => {
    await oracle.stop();
  });

  it('should fetch legacy gas price for non-EIP1559 chain', async () => {
    const gasPrice = await oracle.getGasPrice(ChainId.BSC);
    
    expect(gasPrice).toHaveProperty('chainId', ChainId.BSC);
    expect(gasPrice).toHaveProperty('slow');
    expect(gasPrice).toHaveProperty('standard');
    expect(gasPrice).toHaveProperty('fast');
    expect(gasPrice).toHaveProperty('instant');
  });
});
