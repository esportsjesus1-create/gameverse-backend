import { EventEmitter } from 'events';

export enum ChainId {
  ETHEREUM = 1,
  POLYGON = 137,
  BSC = 56,
  ARBITRUM = 42161,
  OPTIMISM = 10
}

export enum ProviderType {
  INFURA = 'infura',
  ALCHEMY = 'alchemy',
  QUICKNODE = 'quicknode',
  CUSTOM = 'custom'
}

export enum ProviderStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export interface ChainConfig {
  chainId: ChainId;
  name: string;
  nativeCurrency: string;
  blockTime: number;
  confirmations: number;
  isEIP1559: boolean;
}

export interface RpcEndpoint {
  id: string;
  chainId: ChainId;
  providerType: ProviderType;
  httpUrl: string;
  wsUrl?: string;
  apiKey?: string;
  priority: number;
  weight: number;
  maxRetries: number;
  timeout: number;
  rateLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderHealth {
  endpointId: string;
  status: ProviderStatus;
  latency: number;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  blockHeight: number;
}

export interface GasPrice {
  chainId: ChainId;
  slow: bigint;
  standard: bigint;
  fast: bigint;
  instant: bigint;
  baseFee?: bigint;
  maxPriorityFee?: bigint;
  timestamp: Date;
}

export interface GasPriceCache {
  gasPrice: GasPrice;
  expiresAt: Date;
}

export interface NonceInfo {
  chainId: ChainId;
  address: string;
  nonce: number;
  pendingNonce: number;
  lastUpdated: Date;
}

export interface BlockInfo {
  chainId: ChainId;
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  transactions: string[];
}

export interface ReorgEvent {
  chainId: ChainId;
  oldBlockNumber: number;
  oldBlockHash: string;
  newBlockNumber: number;
  newBlockHash: string;
  depth: number;
  timestamp: Date;
}

export interface SubscriptionConfig {
  id: string;
  chainId: ChainId;
  type: SubscriptionType;
  filter?: SubscriptionFilter;
  callback?: (data: unknown) => void;
}

export enum SubscriptionType {
  NEW_BLOCKS = 'newBlocks',
  NEW_TRANSACTIONS = 'newTransactions',
  PENDING_TRANSACTIONS = 'pendingTransactions',
  LOGS = 'logs'
}

export interface SubscriptionFilter {
  address?: string | string[];
  topics?: (string | string[] | null)[];
  fromBlock?: number | string;
  toBlock?: number | string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitInfo {
  key: string;
  count: number;
  resetAt: Date;
  remaining: number;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface GatewayConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  postgres: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  server: {
    port: number;
    host: string;
  };
  rateLimit: RateLimitConfig;
  gasPriceTtl: number;
  nonceTtl: number;
  healthCheckInterval: number;
  reorgDepth: number;
}

export interface RpcRequest {
  jsonrpc: string;
  method: string;
  params: unknown[];
  id: number | string;
}

export interface RpcResponse {
  jsonrpc: string;
  result?: unknown;
  error?: RpcError;
  id: number | string;
}

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface TransactionRequest {
  from: string;
  to?: string;
  value?: bigint;
  data?: string;
  nonce?: number;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  chainId?: number;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastRequestTime: Date;
}

export abstract class BaseService extends EventEmitter {
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract healthCheck(): Promise<HealthCheckResult>;
}

export interface IProviderManager {
  getProvider(chainId: ChainId): Promise<unknown>;
  executeRequest(chainId: ChainId, method: string, params: unknown[]): Promise<unknown>;
  getHealthyProviders(chainId: ChainId): Promise<RpcEndpoint[]>;
}

export interface IGasPriceOracle {
  getGasPrice(chainId: ChainId): Promise<GasPrice>;
  refreshGasPrice(chainId: ChainId): Promise<GasPrice>;
}

export interface INonceManager {
  getNonce(chainId: ChainId, address: string): Promise<number>;
  incrementNonce(chainId: ChainId, address: string): Promise<number>;
  resetNonce(chainId: ChainId, address: string): Promise<void>;
}

export interface IReorgDetector {
  start(): Promise<void>;
  stop(): Promise<void>;
  onReorg(callback: (event: ReorgEvent) => void): void;
}

export interface ISubscriptionManager {
  subscribe(config: SubscriptionConfig): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<boolean>;
  getActiveSubscriptions(): SubscriptionConfig[];
}

export interface IRateLimiter {
  checkLimit(key: string): Promise<RateLimitInfo>;
  incrementCount(key: string): Promise<RateLimitInfo>;
  resetLimit(key: string): Promise<void>;
}
