import { v4 as uuidv4 } from 'uuid';
import BigNumber from 'bignumber.js';
import {
  RoyaltyConfig,
  RoyaltyRecipient,
  RoyaltyPayment,
  RoyaltyDistribution,
  RoyaltyHistory,
  RoyaltySummary,
  CreateRoyaltyConfigInput,
  RecordSaleInput,
  PaginatedResult,
  Currency,
  BPS_DENOMINATOR,
  MAX_ROYALTY_BPS,
  InvalidConfigError,
  PaymentFailedError,
} from '../types';

const configs: Map<string, RoyaltyConfig> = new Map();
const recipients: Map<string, RoyaltyRecipient> = new Map();
const payments: Map<string, RoyaltyPayment> = new Map();
const distributions: Map<string, RoyaltyDistribution> = new Map();
const history: RoyaltyHistory[] = [];

export class RoyaltyService {
  async createConfig(input: CreateRoyaltyConfigInput): Promise<RoyaltyConfig> {
    if (input.totalRoyaltyBps > MAX_ROYALTY_BPS) {
      throw new InvalidConfigError(`Total royalty cannot exceed ${MAX_ROYALTY_BPS / 100}%`);
    }

    if (input.totalRoyaltyBps <= 0) {
      throw new InvalidConfigError('Total royalty must be greater than 0');
    }

    const totalShareBps = input.recipients.reduce((sum, r) => sum + r.shareBps, 0);
    if (totalShareBps !== BPS_DENOMINATOR) {
      throw new InvalidConfigError('Recipient shares must total 100% (10000 bps)');
    }

    const configId = uuidv4();
    const now = new Date();

    const recipientEntities: RoyaltyRecipient[] = input.recipients.map(r => ({
      id: uuidv4(),
      configId,
      address: r.address.toLowerCase(),
      name: r.name,
      shareBps: r.shareBps,
      minPayout: r.minPayout,
      payoutSchedule: r.payoutSchedule || 'immediate',
      createdAt: now,
    }));

    const config: RoyaltyConfig = {
      id: configId,
      nftContractAddress: input.nftContractAddress.toLowerCase(),
      tokenId: input.tokenId,
      collectionId: input.collectionId,
      totalRoyaltyBps: input.totalRoyaltyBps,
      recipients: recipientEntities,
      isActive: true,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    configs.set(configId, config);
    recipientEntities.forEach(r => recipients.set(r.id, r));

    return config;
  }

  async getConfigById(id: string): Promise<RoyaltyConfig | null> {
    return configs.get(id) || null;
  }

  async getConfigByContract(contractAddress: string, tokenId?: string): Promise<RoyaltyConfig | null> {
    const normalizedAddress = contractAddress.toLowerCase();
    
    if (tokenId) {
      const tokenConfig = Array.from(configs.values()).find(
        c => c.nftContractAddress === normalizedAddress && c.tokenId === tokenId && c.isActive
      );
      if (tokenConfig) return tokenConfig;
    }

    return Array.from(configs.values()).find(
      c => c.nftContractAddress === normalizedAddress && !c.tokenId && c.isActive
    ) || null;
  }

  async updateConfig(id: string, updates: Partial<CreateRoyaltyConfigInput>): Promise<RoyaltyConfig | null> {
    const config = configs.get(id);
    if (!config) return null;

    if (updates.totalRoyaltyBps !== undefined) {
      if (updates.totalRoyaltyBps > MAX_ROYALTY_BPS) {
        throw new InvalidConfigError(`Total royalty cannot exceed ${MAX_ROYALTY_BPS / 100}%`);
      }
      config.totalRoyaltyBps = updates.totalRoyaltyBps;
    }

    if (updates.recipients) {
      const totalShareBps = updates.recipients.reduce((sum, r) => sum + r.shareBps, 0);
      if (totalShareBps !== BPS_DENOMINATOR) {
        throw new InvalidConfigError('Recipient shares must total 100% (10000 bps)');
      }

      config.recipients.forEach(r => recipients.delete(r.id));

      const newRecipients: RoyaltyRecipient[] = updates.recipients.map(r => ({
        id: uuidv4(),
        configId: id,
        address: r.address.toLowerCase(),
        name: r.name,
        shareBps: r.shareBps,
        minPayout: r.minPayout,
        payoutSchedule: r.payoutSchedule || 'immediate',
        createdAt: new Date(),
      }));

      config.recipients = newRecipients;
      newRecipients.forEach(r => recipients.set(r.id, r));
    }

    config.updatedAt = new Date();
    return config;
  }

  async deactivateConfig(id: string): Promise<boolean> {
    const config = configs.get(id);
    if (!config) return false;

    config.isActive = false;
    config.updatedAt = new Date();
    return true;
  }

  async recordSale(input: RecordSaleInput): Promise<RoyaltyPayment> {
    const config = configs.get(input.configId);
    if (!config) {
      throw new InvalidConfigError('Royalty configuration not found');
    }

    if (!config.isActive) {
      throw new InvalidConfigError('Royalty configuration is not active');
    }

    const saleAmount = new BigNumber(input.saleAmount);
    const totalRoyalty = saleAmount.multipliedBy(config.totalRoyaltyBps).dividedBy(BPS_DENOMINATOR);

    const paymentId = uuidv4();
    const now = new Date();

    const paymentDistributions: RoyaltyDistribution[] = config.recipients.map(recipient => {
      const recipientAmount = totalRoyalty.multipliedBy(recipient.shareBps).dividedBy(BPS_DENOMINATOR);
      
      const distribution: RoyaltyDistribution = {
        id: uuidv4(),
        paymentId,
        recipientId: recipient.id,
        recipientAddress: recipient.address,
        amount: recipientAmount.toFixed(),
        currency: input.saleCurrency,
        status: 'pending',
      };

      distributions.set(distribution.id, distribution);
      return distribution;
    });

    const payment: RoyaltyPayment = {
      id: paymentId,
      configId: input.configId,
      saleId: input.saleId,
      saleAmount: input.saleAmount,
      saleCurrency: input.saleCurrency,
      totalRoyaltyAmount: totalRoyalty.toFixed(),
      chainId: input.chainId,
      status: 'pending',
      distributions: paymentDistributions,
      createdAt: now,
    };

    payments.set(paymentId, payment);

    return payment;
  }

  async processPayment(paymentId: string): Promise<RoyaltyPayment> {
    const payment = payments.get(paymentId);
    if (!payment) {
      throw new PaymentFailedError('Payment not found');
    }

    if (payment.status !== 'pending') {
      throw new PaymentFailedError(`Payment is already ${payment.status}`);
    }

    payment.status = 'processing';

    try {
      for (const distribution of payment.distributions) {
        distribution.status = 'completed';
        distribution.processedAt = new Date();
        distribution.transactionHash = `0x${uuidv4().replace(/-/g, '')}`;

        const historyEntry: RoyaltyHistory = {
          id: uuidv4(),
          recipientAddress: distribution.recipientAddress,
          configId: payment.configId,
          paymentId: payment.id,
          amount: distribution.amount,
          currency: distribution.currency,
          nftContractAddress: configs.get(payment.configId)?.nftContractAddress || '',
          tokenId: configs.get(payment.configId)?.tokenId,
          saleAmount: payment.saleAmount,
          chainId: payment.chainId,
          transactionHash: distribution.transactionHash,
          createdAt: new Date(),
        };

        history.push(historyEntry);
      }

      payment.status = 'completed';
      payment.processedAt = new Date();
      payment.transactionHash = `0x${uuidv4().replace(/-/g, '')}`;

      return payment;
    } catch (error) {
      payment.status = 'failed';
      payment.failedAt = new Date();
      payment.failureReason = error instanceof Error ? error.message : 'Unknown error';
      throw new PaymentFailedError(payment.failureReason);
    }
  }

  async getPaymentById(id: string): Promise<RoyaltyPayment | null> {
    return payments.get(id) || null;
  }

  async getPaymentsByConfig(configId: string, page = 1, limit = 50): Promise<PaginatedResult<RoyaltyPayment>> {
    const filtered = Array.from(payments.values())
      .filter(p => p.configId === configId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  async getRecipientHistory(
    recipientAddress: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResult<RoyaltyHistory>> {
    const normalizedAddress = recipientAddress.toLowerCase();
    const filtered = history
      .filter(h => h.recipientAddress === normalizedAddress)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return { data, total, page, limit, totalPages };
  }

  async getRecipientSummary(recipientAddress: string): Promise<RoyaltySummary> {
    const normalizedAddress = recipientAddress.toLowerCase();
    
    const recipientHistory = history.filter(h => h.recipientAddress === normalizedAddress);
    const recipientConfigs = Array.from(configs.values()).filter(
      c => c.recipients.some(r => r.address === normalizedAddress)
    );

    const totalEarned: Record<Currency, string> = {
      ETH: '0', MATIC: '0', USDC: '0', USDT: '0', DAI: '0',
    };
    const totalPending: Record<Currency, string> = {
      ETH: '0', MATIC: '0', USDC: '0', USDT: '0', DAI: '0',
    };

    for (const entry of recipientHistory) {
      const current = new BigNumber(totalEarned[entry.currency]);
      totalEarned[entry.currency] = current.plus(entry.amount).toFixed();
    }

    const pendingDistributions = Array.from(distributions.values()).filter(
      d => d.recipientAddress === normalizedAddress && d.status === 'pending'
    );

    for (const dist of pendingDistributions) {
      const current = new BigNumber(totalPending[dist.currency]);
      totalPending[dist.currency] = current.plus(dist.amount).toFixed();
    }

    const lastPayment = recipientHistory.length > 0
      ? recipientHistory.reduce((latest, h) => 
          h.createdAt > latest.createdAt ? h : latest
        ).createdAt
      : undefined;

    return {
      recipientAddress: normalizedAddress,
      totalEarned,
      totalPending,
      paymentCount: recipientHistory.length,
      lastPaymentAt: lastPayment,
      configCount: recipientConfigs.length,
    };
  }

  calculateRoyalty(saleAmount: string, royaltyBps: number): string {
    return new BigNumber(saleAmount)
      .multipliedBy(royaltyBps)
      .dividedBy(BPS_DENOMINATOR)
      .toFixed();
  }

  calculateSplit(amount: string, shareBps: number): string {
    return new BigNumber(amount)
      .multipliedBy(shareBps)
      .dividedBy(BPS_DENOMINATOR)
      .toFixed();
  }
}

export const royaltyService = new RoyaltyService();
