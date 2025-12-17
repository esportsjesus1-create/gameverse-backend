import Decimal from 'decimal.js';
import {
  Account,
  AccountType,
  Transaction,
  TransactionEntry,
  TransactionStatus,
  EntryType,
  Currency,
  ExchangeRate,
  BalanceSnapshot,
  AuditLog,
  ReconciliationResult,
  ReconciliationStatus,
} from '../../types';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export interface InMemoryStore {
  accounts: Map<string, Account>;
  transactions: Map<string, Transaction>;
  transactionEntries: Map<string, TransactionEntry[]>;
  currencies: Map<string, Currency>;
  exchangeRates: ExchangeRate[];
  balanceSnapshots: BalanceSnapshot[];
  auditLogs: AuditLog[];
  reconciliationRuns: ReconciliationResult[];
}

export class InMemoryAdapter {
  private store: InMemoryStore;

  constructor() {
    this.store = {
      accounts: new Map(),
      transactions: new Map(),
      transactionEntries: new Map(),
      currencies: new Map(),
      exchangeRates: [],
      balanceSnapshots: [],
      auditLogs: [],
      reconciliationRuns: [],
    };
    this.initializeDefaultCurrencies();
  }

  private initializeDefaultCurrencies(): void {
    const usd: Currency = {
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      isBaseCurrency: true,
    };
    this.store.currencies.set('USD', usd);
  }

  reset(): void {
    this.store = {
      accounts: new Map(),
      transactions: new Map(),
      transactionEntries: new Map(),
      currencies: new Map(),
      exchangeRates: [],
      balanceSnapshots: [],
      auditLogs: [],
      reconciliationRuns: [],
    };
    this.initializeDefaultCurrencies();
  }

  createAccount(input: {
    code: string;
    name: string;
    type: AccountType;
    currencyCode: string;
    parentId?: string;
    description?: string;
  }): Account {
    const normalBalance = [AccountType.ASSET, AccountType.EXPENSE].includes(input.type)
      ? EntryType.DEBIT
      : EntryType.CREDIT;

    const account: Account = {
      id: generateId(),
      code: input.code,
      name: input.name,
      type: input.type,
      currencyCode: input.currencyCode,
      parentId: input.parentId || null,
      description: input.description || null,
      isActive: true,
      normalBalance,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.store.accounts.set(account.id, account);
    return account;
  }

  getAccount(id: string): Account | null {
    return this.store.accounts.get(id) || null;
  }

  getAccountByCode(code: string): Account | null {
    for (const account of this.store.accounts.values()) {
      if (account.code === code) {
        return account;
      }
    }
    return null;
  }

  getAllAccounts(): Account[] {
    return Array.from(this.store.accounts.values());
  }

  updateAccount(id: string, updates: Partial<Account>): Account | null {
    const account = this.store.accounts.get(id);
    if (!account) return null;

    const updated = { ...account, ...updates, updatedAt: new Date() };
    this.store.accounts.set(id, updated);
    return updated;
  }

  createTransaction(input: {
    idempotencyKey: string;
    reference: string;
    description: string;
    transactionDate: Date;
    entries: Array<{
      accountId: string;
      entryType: EntryType;
      amount: number | string | Decimal;
      currencyCode: string;
      description?: string;
    }>;
    metadata?: Record<string, unknown>;
    createdBy: string;
  }): Transaction {
    const existing = this.getTransactionByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const entry of input.entries) {
      const amount = new Decimal(entry.amount);
      if (entry.entryType === EntryType.DEBIT) {
        totalDebits = totalDebits.plus(amount);
      } else {
        totalCredits = totalCredits.plus(amount);
      }
    }

    if (!totalDebits.eq(totalCredits)) {
      throw new Error(
        `Transaction is not balanced: debits (${totalDebits}) != credits (${totalCredits})`
      );
    }

    const transaction: Transaction = {
      id: generateId(),
      idempotencyKey: input.idempotencyKey,
      reference: input.reference,
      description: input.description,
      status: TransactionStatus.PENDING,
      transactionDate: input.transactionDate,
      postedAt: null,
      voidedAt: null,
      voidReason: null,
      metadata: input.metadata || {},
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const entries: TransactionEntry[] = input.entries.map((entry) => ({
      id: generateId(),
      transactionId: transaction.id,
      accountId: entry.accountId,
      entryType: entry.entryType,
      amount: new Decimal(entry.amount),
      currencyCode: entry.currencyCode,
      baseCurrencyAmount: new Decimal(entry.amount),
      exchangeRate: new Decimal(1),
      description: entry.description || null,
      createdAt: new Date(),
    }));

    this.store.transactions.set(transaction.id, transaction);
    this.store.transactionEntries.set(transaction.id, entries);

    return transaction;
  }

  getTransaction(id: string): Transaction | null {
    return this.store.transactions.get(id) || null;
  }

  getTransactionByIdempotencyKey(key: string): Transaction | null {
    for (const tx of this.store.transactions.values()) {
      if (tx.idempotencyKey === key) {
        return tx;
      }
    }
    return null;
  }

  getTransactionEntries(transactionId: string): TransactionEntry[] {
    return this.store.transactionEntries.get(transactionId) || [];
  }

  getAllTransactions(): Transaction[] {
    return Array.from(this.store.transactions.values());
  }

  postTransaction(id: string): Transaction | null {
    const tx = this.store.transactions.get(id);
    if (!tx) return null;
    if (tx.status !== TransactionStatus.PENDING) {
      throw new Error(`Transaction is not pending: ${id}`);
    }

    const updated: Transaction = {
      ...tx,
      status: TransactionStatus.POSTED,
      postedAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.transactions.set(id, updated);
    return updated;
  }

  voidTransaction(id: string, reason: string): Transaction | null {
    const tx = this.store.transactions.get(id);
    if (!tx) return null;
    if (tx.status === TransactionStatus.VOIDED) {
      throw new Error(`Transaction is already voided: ${id}`);
    }

    const updated: Transaction = {
      ...tx,
      status: TransactionStatus.VOIDED,
      voidedAt: new Date(),
      voidReason: reason,
      updatedAt: new Date(),
    };
    this.store.transactions.set(id, updated);
    return updated;
  }

  getAccountBalance(accountId: string, asOfDate?: Date): Decimal {
    const account = this.store.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const tx of this.store.transactions.values()) {
      if (tx.status !== TransactionStatus.POSTED) continue;
      if (asOfDate && tx.transactionDate > asOfDate) continue;

      const entries = this.store.transactionEntries.get(tx.id) || [];
      for (const entry of entries) {
        if (entry.accountId !== accountId) continue;
        if (entry.entryType === EntryType.DEBIT) {
          totalDebits = totalDebits.plus(entry.amount);
        } else {
          totalCredits = totalCredits.plus(entry.amount);
        }
      }
    }

    if (account.normalBalance === EntryType.DEBIT) {
      return totalDebits.minus(totalCredits);
    }
    return totalCredits.minus(totalDebits);
  }

  createCurrency(currency: Currency): Currency {
    this.store.currencies.set(currency.code, currency);
    return currency;
  }

  getCurrency(code: string): Currency | null {
    return this.store.currencies.get(code) || null;
  }

  getBaseCurrency(): Currency | null {
    for (const currency of this.store.currencies.values()) {
      if (currency.isBaseCurrency) {
        return currency;
      }
    }
    return null;
  }

  getAllCurrencies(): Currency[] {
    return Array.from(this.store.currencies.values());
  }

  setExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    rate: Decimal | number | string,
    effectiveDate: Date = new Date()
  ): ExchangeRate {
    const exchangeRate: ExchangeRate = {
      id: generateId(),
      fromCurrency,
      toCurrency,
      rate: new Decimal(rate),
      effectiveDate,
      createdAt: new Date(),
    };
    this.store.exchangeRates.push(exchangeRate);
    return exchangeRate;
  }

  getExchangeRate(fromCurrency: string, toCurrency: string, date: Date = new Date()): Decimal {
    if (fromCurrency === toCurrency) {
      return new Decimal(1);
    }

    const rates = this.store.exchangeRates
      .filter(
        (r) =>
          r.fromCurrency === fromCurrency &&
          r.toCurrency === toCurrency &&
          r.effectiveDate <= date
      )
      .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());

    if (rates.length > 0) {
      return rates[0].rate;
    }

    const inverseRates = this.store.exchangeRates
      .filter(
        (r) =>
          r.fromCurrency === toCurrency &&
          r.toCurrency === fromCurrency &&
          r.effectiveDate <= date
      )
      .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());

    if (inverseRates.length > 0) {
      return new Decimal(1).div(inverseRates[0].rate);
    }

    throw new Error(`No exchange rate found for ${fromCurrency} to ${toCurrency}`);
  }

  createSnapshot(accountId: string, date: Date = new Date()): BalanceSnapshot {
    const account = this.store.accounts.get(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    const balance = this.getAccountBalance(accountId, date);
    const snapshot: BalanceSnapshot = {
      id: generateId(),
      accountId,
      balance,
      currencyCode: account.currencyCode,
      snapshotDate: date,
      createdAt: new Date(),
    };

    this.store.balanceSnapshots.push(snapshot);
    return snapshot;
  }

  getLatestSnapshot(accountId: string): BalanceSnapshot | null {
    const snapshots = this.store.balanceSnapshots
      .filter((s) => s.accountId === accountId)
      .sort((a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime());

    return snapshots[0] || null;
  }

  logAudit(input: {
    entityType: string;
    entityId: string;
    action: string;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    userId: string;
  }): AuditLog {
    const log: AuditLog = {
      id: generateId(),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldValue: input.oldValue,
      newValue: input.newValue,
      userId: input.userId,
      ipAddress: null,
      userAgent: null,
      createdAt: new Date(),
    };

    this.store.auditLogs.push(log);
    return log;
  }

  getAuditLogs(options?: { entityType?: string; entityId?: string; userId?: string }): AuditLog[] {
    let logs = [...this.store.auditLogs];

    if (options?.entityType) {
      logs = logs.filter((l) => l.entityType === options.entityType);
    }
    if (options?.entityId) {
      logs = logs.filter((l) => l.entityId === options.entityId);
    }
    if (options?.userId) {
      logs = logs.filter((l) => l.userId === options.userId);
    }

    return logs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  runReconciliation(): ReconciliationResult {
    const accounts = this.getAllAccounts().filter((a) => a.isActive);
    let balancedAccounts = 0;
    let imbalancedAccounts = 0;

    for (const account of accounts) {
      const latestSnapshot = this.getLatestSnapshot(account.id);
      const currentBalance = this.getAccountBalance(account.id);

      if (latestSnapshot && !latestSnapshot.balance.eq(currentBalance)) {
        imbalancedAccounts++;
      } else {
        balancedAccounts++;
      }
    }

    const result: ReconciliationResult = {
      id: generateId(),
      runDate: new Date(),
      status: imbalancedAccounts === 0 ? ReconciliationStatus.BALANCED : ReconciliationStatus.IMBALANCED,
      totalAccounts: accounts.length,
      balancedAccounts,
      imbalancedAccounts,
      discrepancies: [],
      completedAt: new Date(),
    };

    this.store.reconciliationRuns.push(result);
    return result;
  }

  getStore(): InMemoryStore {
    return this.store;
  }
}

export const inMemoryAdapter = new InMemoryAdapter();
