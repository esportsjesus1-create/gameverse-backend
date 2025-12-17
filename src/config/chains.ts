import { ChainId, ChainConfig } from '../types';

export const CHAIN_CONFIGS: Record<ChainId, ChainConfig> = {
  [ChainId.ETHEREUM]: {
    chainId: ChainId.ETHEREUM,
    name: 'Ethereum Mainnet',
    nativeCurrency: 'ETH',
    blockTime: 12,
    confirmations: 12,
    isEIP1559: true
  },
  [ChainId.POLYGON]: {
    chainId: ChainId.POLYGON,
    name: 'Polygon',
    nativeCurrency: 'MATIC',
    blockTime: 2,
    confirmations: 128,
    isEIP1559: true
  },
  [ChainId.BSC]: {
    chainId: ChainId.BSC,
    name: 'BNB Smart Chain',
    nativeCurrency: 'BNB',
    blockTime: 3,
    confirmations: 15,
    isEIP1559: false
  },
  [ChainId.ARBITRUM]: {
    chainId: ChainId.ARBITRUM,
    name: 'Arbitrum One',
    nativeCurrency: 'ETH',
    blockTime: 0.25,
    confirmations: 64,
    isEIP1559: true
  },
  [ChainId.OPTIMISM]: {
    chainId: ChainId.OPTIMISM,
    name: 'Optimism',
    nativeCurrency: 'ETH',
    blockTime: 2,
    confirmations: 64,
    isEIP1559: true
  }
};

export const DEFAULT_RPC_URLS: Record<ChainId, Record<string, string>> = {
  [ChainId.ETHEREUM]: {
    infura: 'https://mainnet.infura.io/v3/',
    alchemy: 'https://eth-mainnet.g.alchemy.com/v2/',
    quicknode: 'https://eth-mainnet.quiknode.pro/'
  },
  [ChainId.POLYGON]: {
    infura: 'https://polygon-mainnet.infura.io/v3/',
    alchemy: 'https://polygon-mainnet.g.alchemy.com/v2/',
    quicknode: 'https://polygon-mainnet.quiknode.pro/'
  },
  [ChainId.BSC]: {
    quicknode: 'https://bsc-mainnet.quiknode.pro/',
    public: 'https://bsc-dataseed.binance.org/'
  },
  [ChainId.ARBITRUM]: {
    infura: 'https://arbitrum-mainnet.infura.io/v3/',
    alchemy: 'https://arb-mainnet.g.alchemy.com/v2/',
    quicknode: 'https://arb-mainnet.quiknode.pro/'
  },
  [ChainId.OPTIMISM]: {
    infura: 'https://optimism-mainnet.infura.io/v3/',
    alchemy: 'https://opt-mainnet.g.alchemy.com/v2/',
    quicknode: 'https://opt-mainnet.quiknode.pro/'
  }
};

export const DEFAULT_WS_URLS: Record<ChainId, Record<string, string>> = {
  [ChainId.ETHEREUM]: {
    infura: 'wss://mainnet.infura.io/ws/v3/',
    alchemy: 'wss://eth-mainnet.g.alchemy.com/v2/',
    quicknode: 'wss://eth-mainnet.quiknode.pro/'
  },
  [ChainId.POLYGON]: {
    infura: 'wss://polygon-mainnet.infura.io/ws/v3/',
    alchemy: 'wss://polygon-mainnet.g.alchemy.com/v2/',
    quicknode: 'wss://polygon-mainnet.quiknode.pro/'
  },
  [ChainId.BSC]: {
    quicknode: 'wss://bsc-mainnet.quiknode.pro/',
    public: 'wss://bsc-ws-node.nariox.org:443'
  },
  [ChainId.ARBITRUM]: {
    infura: 'wss://arbitrum-mainnet.infura.io/ws/v3/',
    alchemy: 'wss://arb-mainnet.g.alchemy.com/v2/',
    quicknode: 'wss://arb-mainnet.quiknode.pro/'
  },
  [ChainId.OPTIMISM]: {
    infura: 'wss://optimism-mainnet.infura.io/ws/v3/',
    alchemy: 'wss://opt-mainnet.g.alchemy.com/v2/',
    quicknode: 'wss://opt-mainnet.quiknode.pro/'
  }
};

export function getChainConfig(chainId: ChainId): ChainConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  return config;
}

export function isValidChainId(chainId: number): chainId is ChainId {
  return Object.values(ChainId).includes(chainId as ChainId);
}

export function getChainName(chainId: ChainId): string {
  return CHAIN_CONFIGS[chainId]?.name || `Unknown Chain (${chainId})`;
}
