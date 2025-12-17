export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type Currency = 'ETH' | 'MATIC' | 'USDC' | 'USDT' | 'DAI';

export interface RoyaltyConfig {
  id: string;
  nftContractAddress: string;
  tokenId?: string;
  collectionId?: string;
  totalRoyaltyBps: number;
  recipients: RoyaltyRecipient[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoyaltyRecipient {
  id: string;
  configId: string;
  address: string;
  name?: string;
  shareBps: number;
  minPayout?: string;
  payoutSchedule: 'immediate' | 'daily' | 'weekly' | 'monthly';
  createdAt: Date;
}

export interface RoyaltyPayment {
  id: string;
  configId: string;
  saleId: string;
  saleAmount: string;
  saleCurrency: Currency;
  totalRoyaltyAmount: string;
  chainId: number;
  transactionHash?: string;
  status: PaymentStatus;
  distributions: RoyaltyDistribution[];
  createdAt: Date;
  processedAt?: Date;
  failedAt?: Date;
  failureReason?: string;
}

export interface RoyaltyDistribution {
  id: string;
  paymentId: string;
  recipientId: string;
  recipientAddress: string;
  amount: string;
  currency: Currency;
  status: PaymentStatus;
  transactionHash?: string;
  processedAt?: Date;
}

export interface RoyaltyHistory {
  id: string;
  recipientAddress: string;
  configId: string;
  paymentId: string;
  amount: string;
  currency: Currency;
  nftContractAddress: string;
  tokenId?: string;
  saleAmount: string;
  chainId: number;
  transactionHash?: string;
  createdAt: Date;
}

export interface RoyaltySummary {
  recipientAddress: string;
  totalEarned: Record<Currency, string>;
  totalPending: Record<Currency, string>;
  paymentCount: number;
  lastPaymentAt?: Date;
  configCount: number;
}

export interface CreateRoyaltyConfigInput {
  nftContractAddress: string;
  tokenId?: string;
  collectionId?: string;
  totalRoyaltyBps: number;
  recipients: {
    address: string;
    name?: string;
    shareBps: number;
    minPayout?: string;
    payoutSchedule?: 'immediate' | 'daily' | 'weekly' | 'monthly';
  }[];
  createdBy: string;
}

export interface RecordSaleInput {
  configId: string;
  saleId: string;
  saleAmount: string;
  saleCurrency: Currency;
  chainId: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const BPS_DENOMINATOR = 10000;

export const MAX_ROYALTY_BPS = 2500;

export const SUPPORTED_CURRENCIES: Currency[] = ['ETH', 'MATIC', 'USDC', 'USDT', 'DAI'];

export class RoyaltyError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'ROYALTY_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, RoyaltyError.prototype);
  }
}

export class InvalidConfigError extends RoyaltyError {
  constructor(message: string = 'Invalid royalty configuration') {
    super(message, 400, 'INVALID_CONFIG');
  }
}

export class PaymentFailedError extends RoyaltyError {
  constructor(message: string = 'Payment processing failed') {
    super(message, 500, 'PAYMENT_FAILED');
  }
}
