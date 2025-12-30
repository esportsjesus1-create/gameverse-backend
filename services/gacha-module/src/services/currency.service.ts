import {
  PlayerCurrencyRepository,
  CurrencyTransactionRepository,
  PlayerSpendingRepository,
  PlayerAgeVerificationRepository,
} from '../repositories';
import {
  CurrencyType,
  TransactionType,
  TransactionStatus,
  PlayerCurrency,
  CurrencyPurchaseRequest,
  CurrencyPurchaseResponse,
  SpendingLimitStatus,
} from '../types';

export class CurrencyService {
  private currencyRepository: PlayerCurrencyRepository;
  private transactionRepository: CurrencyTransactionRepository;
  private spendingRepository: PlayerSpendingRepository;
  private ageVerificationRepository: PlayerAgeVerificationRepository;

  constructor() {
    this.currencyRepository = new PlayerCurrencyRepository();
    this.transactionRepository = new CurrencyTransactionRepository();
    this.spendingRepository = new PlayerSpendingRepository();
    this.ageVerificationRepository = new PlayerAgeVerificationRepository();
  }

  async getBalance(playerId: string, currencyType: CurrencyType): Promise<PlayerCurrency> {
    return this.currencyRepository.getBalance(playerId, currencyType);
  }

  async getAllBalances(playerId: string): Promise<PlayerCurrency[]> {
    return this.currencyRepository.getAllBalances(playerId);
  }

  async addCurrency(
    playerId: string,
    currencyType: CurrencyType,
    amount: number,
    transactionType: TransactionType,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ currency: PlayerCurrency; transactionId: string }> {
    const balanceBefore = await this.currencyRepository.getBalance(playerId, currencyType);
    const currency = await this.currencyRepository.addBalance(playerId, currencyType, amount);

    const transaction = await this.transactionRepository.create({
      playerId,
      currencyType,
      transactionType,
      amount,
      balanceBefore: Number(balanceBefore.balance),
      balanceAfter: Number(currency.balance),
      status: TransactionStatus.COMPLETED,
      description: description || `Added ${amount} ${currencyType}`,
      metadata,
    });

    return { currency, transactionId: transaction.id };
  }

  async deductCurrency(
    playerId: string,
    currencyType: CurrencyType,
    amount: number,
    transactionType: TransactionType,
    relatedPullId?: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; currency?: PlayerCurrency; transactionId?: string; error?: string }> {
    const balanceBefore = await this.currencyRepository.getBalance(playerId, currencyType);
    const result = await this.currencyRepository.deductBalance(playerId, currencyType, amount);

    if (!result.success) {
      await this.transactionRepository.create({
        playerId,
        currencyType,
        transactionType,
        amount,
        balanceBefore: Number(balanceBefore.balance),
        balanceAfter: Number(balanceBefore.balance),
        status: TransactionStatus.FAILED,
        description: result.error || 'Insufficient balance',
        metadata,
      });

      return { success: false, error: result.error };
    }

    const transaction = await this.transactionRepository.create({
      playerId,
      currencyType,
      transactionType,
      amount,
      balanceBefore: Number(balanceBefore.balance),
      balanceAfter: Number(result.currency.balance),
      status: TransactionStatus.COMPLETED,
      relatedPullId,
      description: description || `Deducted ${amount} ${currencyType}`,
      metadata,
    });

    return { success: true, currency: result.currency, transactionId: transaction.id };
  }

  async purchaseCurrency(request: CurrencyPurchaseRequest): Promise<CurrencyPurchaseResponse> {
    const { playerId, currencyType, amount, paymentMethod, paymentToken } = request;

    const ageCheck = await this.ageVerificationRepository.canPurchase(playerId);
    if (!ageCheck.canPurchase) {
      return {
        success: false,
        transactionId: '',
        currencyType,
        amount: 0,
        newBalance: 0,
        status: TransactionStatus.FAILED,
      };
    }

    const spendingCheck = await this.spendingRepository.checkSpendingLimit(playerId, amount);
    if (!spendingCheck.canSpend) {
      return {
        success: false,
        transactionId: '',
        currencyType,
        amount: 0,
        newBalance: 0,
        status: TransactionStatus.FAILED,
      };
    }

    const balanceBefore = await this.currencyRepository.getBalance(playerId, currencyType);

    const transaction = await this.transactionRepository.create({
      playerId,
      currencyType,
      transactionType: TransactionType.PURCHASE,
      amount,
      balanceBefore: Number(balanceBefore.balance),
      balanceAfter: Number(balanceBefore.balance),
      status: TransactionStatus.PENDING,
      paymentMethod,
      externalTransactionId: paymentToken,
      description: `Purchase of ${amount} ${currencyType}`,
    });

    try {
      const currency = await this.currencyRepository.addBalance(playerId, currencyType, amount);

      await this.transactionRepository.updateStatus(transaction.id, TransactionStatus.COMPLETED);

      await this.spendingRepository.recordSpending(playerId, amount, 0);

      return {
        success: true,
        transactionId: transaction.id,
        currencyType,
        amount,
        newBalance: Number(currency.balance),
        status: TransactionStatus.COMPLETED,
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, TransactionStatus.FAILED);

      return {
        success: false,
        transactionId: transaction.id,
        currencyType,
        amount: 0,
        newBalance: Number(balanceBefore.balance),
        status: TransactionStatus.FAILED,
      };
    }
  }

  async refundCurrency(
    playerId: string,
    transactionId: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const originalTransaction = await this.transactionRepository.findById(transactionId);
    if (!originalTransaction) {
      return { success: false, error: 'Transaction not found' };
    }

    if (originalTransaction.status === TransactionStatus.REFUNDED) {
      return { success: false, error: 'Transaction already refunded' };
    }

    const balanceBefore = await this.currencyRepository.getBalance(
      playerId,
      originalTransaction.currencyType
    );

    const currency = await this.currencyRepository.addBalance(
      playerId,
      originalTransaction.currencyType,
      Number(originalTransaction.amount)
    );

    await this.transactionRepository.create({
      playerId,
      currencyType: originalTransaction.currencyType,
      transactionType: TransactionType.REFUND,
      amount: Number(originalTransaction.amount),
      balanceBefore: Number(balanceBefore.balance),
      balanceAfter: Number(currency.balance),
      status: TransactionStatus.COMPLETED,
      description: reason || `Refund for transaction ${transactionId}`,
      metadata: { originalTransactionId: transactionId },
    });

    await this.transactionRepository.updateStatus(transactionId, TransactionStatus.REFUNDED);

    return { success: true };
  }

  async getSpendingLimitStatus(playerId: string): Promise<SpendingLimitStatus> {
    const status = await this.spendingRepository.getSpendingStatus(playerId);

    return {
      playerId,
      dailyLimit: status.dailyLimit,
      dailySpent: status.dailySpent,
      dailyRemaining: status.dailyRemaining,
      weeklyLimit: status.weeklyLimit,
      weeklySpent: status.weeklySpent,
      weeklyRemaining: status.weeklyRemaining,
      monthlyLimit: status.monthlyLimit,
      monthlySpent: status.monthlySpent,
      monthlyRemaining: status.monthlyRemaining,
      isLimitReached: status.isLimitReached,
      nextResetTime: status.nextResetTime,
    };
  }

  async setCustomSpendingLimits(
    playerId: string,
    dailyLimit?: number,
    weeklyLimit?: number,
    monthlyLimit?: number
  ): Promise<SpendingLimitStatus> {
    await this.spendingRepository.setCustomLimits(playerId, dailyLimit, weeklyLimit, monthlyLimit);
    return this.getSpendingLimitStatus(playerId);
  }

  async checkCanSpend(
    playerId: string,
    amount: number
  ): Promise<{ canSpend: boolean; limitType?: string; remaining: number }> {
    return this.spendingRepository.checkSpendingLimit(playerId, amount);
  }

  async recordPullSpending(
    playerId: string,
    amount: number,
    pullCount: number
  ): Promise<{ limitReached: boolean; limitType?: string }> {
    const result = await this.spendingRepository.recordSpending(playerId, amount, pullCount);
    return { limitReached: result.limitReached, limitType: result.limitType };
  }

  async getTransactionHistory(
    playerId: string,
    currencyType?: CurrencyType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ transactions: unknown[]; total: number }> {
    return this.transactionRepository.getHistory({
      playerId,
      currencyType,
      page,
      pageSize,
    });
  }

  async hasEnoughBalance(
    playerId: string,
    currencyType: CurrencyType,
    amount: number
  ): Promise<boolean> {
    return this.currencyRepository.hasEnoughBalance(playerId, currencyType, amount);
  }
}
