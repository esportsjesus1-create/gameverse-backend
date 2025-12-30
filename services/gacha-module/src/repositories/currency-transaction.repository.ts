import { Repository, Between } from 'typeorm';
import { CurrencyTransaction } from '../models';
import { getDataSource } from '../config/database';
import { CurrencyType, TransactionType, TransactionStatus } from '../types';

export interface CreateTransactionRecord {
  playerId: string;
  currencyType: CurrencyType;
  transactionType: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  status?: TransactionStatus;
  externalTransactionId?: string;
  paymentMethod?: string;
  relatedPullId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface TransactionQuery {
  playerId: string;
  currencyType?: CurrencyType;
  transactionType?: TransactionType;
  status?: TransactionStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export class CurrencyTransactionRepository {
  private repository: Repository<CurrencyTransaction>;

  constructor() {
    this.repository = getDataSource().getRepository(CurrencyTransaction);
  }

  async create(data: CreateTransactionRecord): Promise<CurrencyTransaction> {
    const transaction = this.repository.create({
      ...data,
      status: data.status || TransactionStatus.COMPLETED,
    });
    return this.repository.save(transaction);
  }

  async findById(id: string): Promise<CurrencyTransaction | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByExternalId(externalTransactionId: string): Promise<CurrencyTransaction | null> {
    return this.repository.findOne({ where: { externalTransactionId } });
  }

  async getHistory(query: TransactionQuery): Promise<{ transactions: CurrencyTransaction[]; total: number }> {
    const {
      playerId,
      currencyType,
      transactionType,
      status,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
    } = query;

    const whereClause: Record<string, unknown> = { playerId };
    if (currencyType) whereClause.currencyType = currencyType;
    if (transactionType) whereClause.transactionType = transactionType;
    if (status) whereClause.status = status;
    if (startDate && endDate) {
      whereClause.createdAt = Between(startDate, endDate);
    }

    const [transactions, total] = await this.repository.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { transactions, total };
  }

  async getRecentTransactions(playerId: string, limit: number = 10): Promise<CurrencyTransaction[]> {
    return this.repository.find({
      where: { playerId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getTotalSpent(playerId: string, currencyType?: CurrencyType): Promise<number> {
    const whereClause: Record<string, unknown> = {
      playerId,
      transactionType: TransactionType.PULL,
      status: TransactionStatus.COMPLETED,
    };
    if (currencyType) whereClause.currencyType = currencyType;

    const result = await this.repository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where(whereClause)
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  async getTotalPurchased(playerId: string, currencyType?: CurrencyType): Promise<number> {
    const whereClause: Record<string, unknown> = {
      playerId,
      transactionType: TransactionType.PURCHASE,
      status: TransactionStatus.COMPLETED,
    };
    if (currencyType) whereClause.currencyType = currencyType;

    const result = await this.repository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where(whereClause)
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  async getSpentInPeriod(
    playerId: string,
    startDate: Date,
    endDate: Date,
    currencyType?: CurrencyType
  ): Promise<number> {
    const whereClause: Record<string, unknown> = {
      playerId,
      transactionType: TransactionType.PULL,
      status: TransactionStatus.COMPLETED,
      createdAt: Between(startDate, endDate),
    };
    if (currencyType) whereClause.currencyType = currencyType;

    const result = await this.repository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'total')
      .where('transaction.playerId = :playerId', { playerId })
      .andWhere('transaction.transactionType = :type', { type: TransactionType.PULL })
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .andWhere('transaction.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<CurrencyTransaction | null> {
    const transaction = await this.findById(id);
    if (!transaction) return null;

    transaction.status = status;
    return this.repository.save(transaction);
  }

  async countByPlayer(playerId: string): Promise<number> {
    return this.repository.count({ where: { playerId } });
  }

  async countByType(playerId: string, transactionType: TransactionType): Promise<number> {
    return this.repository.count({ where: { playerId, transactionType } });
  }
}
