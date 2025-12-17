import { ChainId } from '../types';
import {
  CHAIN_CONFIGS,
  DEFAULT_RPC_URLS,
  DEFAULT_WS_URLS,
  getChainConfig,
  isValidChainId,
  getChainName
} from './chains';

describe('Chain Configuration', () => {
  describe('CHAIN_CONFIGS', () => {
    it('should have configuration for all supported chains', () => {
      expect(CHAIN_CONFIGS[ChainId.ETHEREUM]).toBeDefined();
      expect(CHAIN_CONFIGS[ChainId.POLYGON]).toBeDefined();
      expect(CHAIN_CONFIGS[ChainId.BSC]).toBeDefined();
      expect(CHAIN_CONFIGS[ChainId.ARBITRUM]).toBeDefined();
      expect(CHAIN_CONFIGS[ChainId.OPTIMISM]).toBeDefined();
    });

    it('should have correct Ethereum configuration', () => {
      const ethConfig = CHAIN_CONFIGS[ChainId.ETHEREUM];
      expect(ethConfig.chainId).toBe(ChainId.ETHEREUM);
      expect(ethConfig.name).toBe('Ethereum Mainnet');
      expect(ethConfig.nativeCurrency).toBe('ETH');
      expect(ethConfig.blockTime).toBe(12);
      expect(ethConfig.confirmations).toBe(12);
      expect(ethConfig.isEIP1559).toBe(true);
    });

    it('should have correct Polygon configuration', () => {
      const polygonConfig = CHAIN_CONFIGS[ChainId.POLYGON];
      expect(polygonConfig.chainId).toBe(ChainId.POLYGON);
      expect(polygonConfig.name).toBe('Polygon');
      expect(polygonConfig.nativeCurrency).toBe('MATIC');
      expect(polygonConfig.isEIP1559).toBe(true);
    });

    it('should have correct BSC configuration', () => {
      const bscConfig = CHAIN_CONFIGS[ChainId.BSC];
      expect(bscConfig.chainId).toBe(ChainId.BSC);
      expect(bscConfig.name).toBe('BNB Smart Chain');
      expect(bscConfig.nativeCurrency).toBe('BNB');
      expect(bscConfig.isEIP1559).toBe(false);
    });

    it('should have correct Arbitrum configuration', () => {
      const arbConfig = CHAIN_CONFIGS[ChainId.ARBITRUM];
      expect(arbConfig.chainId).toBe(ChainId.ARBITRUM);
      expect(arbConfig.name).toBe('Arbitrum One');
      expect(arbConfig.nativeCurrency).toBe('ETH');
      expect(arbConfig.isEIP1559).toBe(true);
    });

    it('should have correct Optimism configuration', () => {
      const opConfig = CHAIN_CONFIGS[ChainId.OPTIMISM];
      expect(opConfig.chainId).toBe(ChainId.OPTIMISM);
      expect(opConfig.name).toBe('Optimism');
      expect(opConfig.nativeCurrency).toBe('ETH');
      expect(opConfig.isEIP1559).toBe(true);
    });
  });

  describe('DEFAULT_RPC_URLS', () => {
    it('should have RPC URLs for all supported chains', () => {
      expect(DEFAULT_RPC_URLS[ChainId.ETHEREUM]).toBeDefined();
      expect(DEFAULT_RPC_URLS[ChainId.POLYGON]).toBeDefined();
      expect(DEFAULT_RPC_URLS[ChainId.BSC]).toBeDefined();
      expect(DEFAULT_RPC_URLS[ChainId.ARBITRUM]).toBeDefined();
      expect(DEFAULT_RPC_URLS[ChainId.OPTIMISM]).toBeDefined();
    });

    it('should have Infura URLs for supported chains', () => {
      expect(DEFAULT_RPC_URLS[ChainId.ETHEREUM].infura).toContain('infura.io');
      expect(DEFAULT_RPC_URLS[ChainId.POLYGON].infura).toContain('infura.io');
      expect(DEFAULT_RPC_URLS[ChainId.ARBITRUM].infura).toContain('infura.io');
      expect(DEFAULT_RPC_URLS[ChainId.OPTIMISM].infura).toContain('infura.io');
    });

    it('should have Alchemy URLs for supported chains', () => {
      expect(DEFAULT_RPC_URLS[ChainId.ETHEREUM].alchemy).toContain('alchemy.com');
      expect(DEFAULT_RPC_URLS[ChainId.POLYGON].alchemy).toContain('alchemy.com');
      expect(DEFAULT_RPC_URLS[ChainId.ARBITRUM].alchemy).toContain('alchemy.com');
      expect(DEFAULT_RPC_URLS[ChainId.OPTIMISM].alchemy).toContain('alchemy.com');
    });
  });

  describe('DEFAULT_WS_URLS', () => {
    it('should have WebSocket URLs for all supported chains', () => {
      expect(DEFAULT_WS_URLS[ChainId.ETHEREUM]).toBeDefined();
      expect(DEFAULT_WS_URLS[ChainId.POLYGON]).toBeDefined();
      expect(DEFAULT_WS_URLS[ChainId.BSC]).toBeDefined();
      expect(DEFAULT_WS_URLS[ChainId.ARBITRUM]).toBeDefined();
      expect(DEFAULT_WS_URLS[ChainId.OPTIMISM]).toBeDefined();
    });

    it('should have wss:// protocol for WebSocket URLs', () => {
      expect(DEFAULT_WS_URLS[ChainId.ETHEREUM].infura).toMatch(/^wss:\/\//);
      expect(DEFAULT_WS_URLS[ChainId.POLYGON].infura).toMatch(/^wss:\/\//);
    });
  });

  describe('getChainConfig', () => {
    it('should return correct config for valid chain ID', () => {
      const config = getChainConfig(ChainId.ETHEREUM);
      expect(config).toEqual(CHAIN_CONFIGS[ChainId.ETHEREUM]);
    });

    it('should throw error for invalid chain ID', () => {
      expect(() => getChainConfig(999 as ChainId)).toThrow('Unsupported chain ID: 999');
    });
  });

  describe('isValidChainId', () => {
    it('should return true for valid chain IDs', () => {
      expect(isValidChainId(1)).toBe(true);
      expect(isValidChainId(137)).toBe(true);
      expect(isValidChainId(56)).toBe(true);
      expect(isValidChainId(42161)).toBe(true);
      expect(isValidChainId(10)).toBe(true);
    });

    it('should return false for invalid chain IDs', () => {
      expect(isValidChainId(0)).toBe(false);
      expect(isValidChainId(999)).toBe(false);
      expect(isValidChainId(-1)).toBe(false);
    });
  });

  describe('getChainName', () => {
    it('should return correct name for valid chain ID', () => {
      expect(getChainName(ChainId.ETHEREUM)).toBe('Ethereum Mainnet');
      expect(getChainName(ChainId.POLYGON)).toBe('Polygon');
      expect(getChainName(ChainId.BSC)).toBe('BNB Smart Chain');
      expect(getChainName(ChainId.ARBITRUM)).toBe('Arbitrum One');
      expect(getChainName(ChainId.OPTIMISM)).toBe('Optimism');
    });

    it('should return fallback name for invalid chain ID', () => {
      expect(getChainName(999 as ChainId)).toBe('Unknown Chain (999)');
    });
  });
});
