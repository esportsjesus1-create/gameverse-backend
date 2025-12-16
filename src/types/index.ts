import Decimal from 'decimal.js';

export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export enum EntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  VOIDED = 'VOIDED',
}

export enum ReconciliationStatus {
  BALANCED = 'BALANCED',
  IMBALANCED = 'IMBALANCED',
  PENDING = 'PENDING',
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isBaseCurrency: boolean;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: Decimal;
  effectiveDate: Date;
  createdAt: Date;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  parentId: string | null;
  description: string | null;
  isActive: boolean;
  normalBalance: EntryType;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  idempotencyKey: string;
  reference: string;
  description: string;
  status: TransactionStatus;
  transactionDate: Date;
  postedAt: Date | null;
  voidedAt: Date | null;
  voidReason: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionEntry {
  id: string;
  transactionId: string;
  accountId: string;
  entryType: EntryType;
  amount: Decimal;
  currencyCode: string;
  baseCurrencyAmount: Decimal;
  exchangeRate: Decimal;
  description: string | null;
  createdAt: Date;
}

export interface BalanceSnapshot {
  id: string;
  accountId: string;
  balance: Decimal;
  currencyCode: string;
  snapshotDate: Date;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface ReconciliationResult {
  id: string;
  runDate: Date;
  status: ReconciliationStatus;
  totalAccounts: number;
  balancedAccounts: number;
  imbalancedAccounts: number;
  discrepancies: ReconciliationDiscrepancy[];
  completedAt: Date;
}

export interface ReconciliationDiscrepancy {
  accountId: string;
  accountCode: string;
  accountName: string;
  expectedBalance: Decimal;
  actualBalance: Decimal;
  difference: Decimal;
}

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  parentId?: string | null;
  description?: string | null;
}

export interface CreateTransactionInput {
  idempotencyKey: string;
  reference: string;
  description: string;
  transactionDate: Date;
  entries: CreateEntryInput[];
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface CreateEntryInput {
  accountId: string;
  entryType: EntryType;
  amount: string | number;
  currencyCode: string;
  description?: string | null;
}

export interface StatementOptions {
  accountId: string;
  startDate: Date;
  endDate: Date;
  format: 'CSV' | 'PDF';
  includeRunningBalance?: boolean;
}

export interface StatementEntry {
  date: Date;
  reference: string;
  description: string;
  debit: Decimal | null;
  credit: Decimal | null;
  balance: Decimal;
  currencyCode: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
