import Decimal from 'decimal.js';
import { query, withTransaction } from '../db/pool';
import {
  Transaction,
  TransactionEntry,
  TransactionStatus,
  EntryType,
  CreateTransactionInput,
  PaginationOptions,
  PaginatedResult,
} from '../types';
import { currencyService } from './CurrencyService';
import { accountService } from './AccountService';
import { auditService } from './AuditService';
import { config } from '../config';

function mapRowToTransaction(row: {
  id: string;
  idempotency_key: string;
  reference: string;
  description: string;
  status: string;
  transaction_date: Date;
  posted_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}): Transaction {
  return {
    id: row.id,
    idempotencyKey: row.idempotency_key,
    reference: row.reference,
    description: row.description,
    status: row.status as TransactionStatus,
    transactionDate: row.transaction_date,
    postedAt: row.posted_at,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToEntry(row: {
  id: string;
  transaction_id: string;
  account_id: string;
  entry_type: string;
  amount: string;
  currency_code: string;
  base_currency_amount: string;
  exchange_rate: string;
  description: string | null;
  created_at: Date;
}): TransactionEntry {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    entryType: row.entry_type as EntryType,
    amount: new Decimal(row.amount),
    currencyCode: row.currency_code,
    baseCurrencyAmount: new Decimal(row.base_currency_amount),
    exchangeRate: new Decimal(row.exchange_rate),
    description: row.description,
    createdAt: row.created_at,
  };
}

export class TransactionService {
  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    if (input.entries.length === 0) {
      throw new Error('Transaction must have at least one entry');
    }
    
    if (input.entries.length > config.ledger.maxEntriesPerTransaction) {
      throw new Error(`Transaction cannot have more than ${config.ledger.maxEntriesPerTransaction} entries`);
    }
    
    const existingTx = await this.getTransactionByIdempotencyKey(input.idempotencyKey);
    if (existingTx) {
      return existingTx;
    }
    
    return withTransaction(async (client) => {
      const baseCurrency = await currencyService.getBaseCurrency();
      
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);
      
      const processedEntries: Array<{
        accountId: string;
        entryType: EntryType;
        amount: Decimal;
        currencyCode: string;
        baseCurrencyAmount: Decimal;
        exchangeRate: Decimal;
        description: string | null;
      }> = [];
      
      for (const entry of input.entries) {
        const account = await accountService.getAccount(entry.accountId);
        if (!account) {
          throw new Error(`Account not found: ${entry.accountId}`);
        }
        
        if (!account.isActive) {
          throw new Error(`Account is inactive: ${entry.accountId}`);
        }
        
        const amount = new Decimal(entry.amount);
        if (amount.lte(0)) {
          throw new Error('Entry amount must be positive');
        }
        
        let baseCurrencyAmount: Decimal;
        let exchangeRate: Decimal;
        
        if (entry.currencyCode === baseCurrency.code) {
          baseCurrencyAmount = amount;
          exchangeRate = new Decimal(1);
        } else {
          const conversion = await currencyService.convertToBaseCurrency(
            amount,
            entry.currencyCode,
            input.transactionDate
          );
          baseCurrencyAmount = conversion.amount;
          exchangeRate = conversion.rate;
        }
        
        if (entry.entryType === EntryType.DEBIT) {
          totalDebits = totalDebits.plus(baseCurrencyAmount);
        } else {
          totalCredits = totalCredits.plus(baseCurrencyAmount);
        }
        
        processedEntries.push({
          accountId: entry.accountId,
          entryType: entry.entryType,
          amount,
          currencyCode: entry.currencyCode,
          baseCurrencyAmount,
          exchangeRate,
          description: entry.description || null,
        });
      }
      
      if (!totalDebits.eq(totalCredits)) {
        throw new Error(
          `Transaction is not balanced: debits (${totalDebits.toString()}) != credits (${totalCredits.toString()})`
        );
      }
      
      const txResult = await client.query<{
        id: string;
        idempotency_key: string;
        reference: string;
        description: string;
        status: string;
        transaction_date: Date;
        posted_at: Date | null;
        voided_at: Date | null;
        void_reason: string | null;
        metadata: Record<string, unknown>;
        created_by: string;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO transactions (idempotency_key, reference, description, transaction_date, metadata, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          input.idempotencyKey,
          input.reference,
          input.description,
          input.transactionDate,
          JSON.stringify(input.metadata || {}),
          input.createdBy,
        ]
      );
      
      const transaction = mapRowToTransaction(txResult.rows[0]);
      
      for (const entry of processedEntries) {
        await client.query(
          `INSERT INTO transaction_entries 
           (transaction_id, account_id, entry_type, amount, currency_code, base_currency_amount, exchange_rate, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            transaction.id,
            entry.accountId,
            entry.entryType,
            entry.amount.toString(),
            entry.currencyCode,
            entry.baseCurrencyAmount.toString(),
            entry.exchangeRate.toString(),
            entry.description,
          ]
        );
      }
      
      await auditService.log({
        entityType: 'transaction',
        entityId: transaction.id,
        action: 'CREATE',
        oldValue: null,
        newValue: transaction as unknown as Record<string, unknown>,
        userId: input.createdBy,
      });
      
      return transaction;
    });
  }

  async getTransaction(id: string): Promise<Transaction | null> {
    const result = await query<{
      id: string;
      idempotency_key: string;
      reference: string;
      description: string;
      status: string;
      transaction_date: Date;
      posted_at: Date | null;
      voided_at: Date | null;
      void_reason: string | null;
      metadata: Record<string, unknown>;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM transactions WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToTransaction(result.rows[0]);
  }

  async getTransactionByIdempotencyKey(key: string): Promise<Transaction | null> {
    const result = await query<{
      id: string;
      idempotency_key: string;
      reference: string;
      description: string;
      status: string;
      transaction_date: Date;
      posted_at: Date | null;
      voided_at: Date | null;
      void_reason: string | null;
      metadata: Record<string, unknown>;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM transactions WHERE idempotency_key = $1', [key]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToTransaction(result.rows[0]);
  }

  async getTransactionEntries(transactionId: string): Promise<TransactionEntry[]> {
    const result = await query<{
      id: string;
      transaction_id: string;
      account_id: string;
      entry_type: string;
      amount: string;
      currency_code: string;
      base_currency_amount: string;
      exchange_rate: string;
      description: string | null;
      created_at: Date;
    }>('SELECT * FROM transaction_entries WHERE transaction_id = $1 ORDER BY created_at', [transactionId]);
    
    return result.rows.map(mapRowToEntry);
  }

  async getAllTransactions(options?: PaginationOptions & { status?: TransactionStatus }): Promise<PaginatedResult<Transaction>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const params: unknown[] = [];
    
    if (options?.status) {
      whereClause = 'WHERE status = $1';
      params.push(options.status);
    }
    
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM transactions ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    const queryParams = [...params, limit, offset];
    const result = await query<{
      id: string;
      idempotency_key: string;
      reference: string;
      description: string;
      status: string;
      transaction_date: Date;
      posted_at: Date | null;
      voided_at: Date | null;
      void_reason: string | null;
      metadata: Record<string, unknown>;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM transactions ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );
    
    return {
      data: result.rows.map(mapRowToTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async postTransaction(id: string, userId: string): Promise<Transaction> {
    const transaction = await this.getTransaction(id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }
    
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new Error(`Transaction is not pending: ${id}`);
    }
    
    const result = await query<{
      id: string;
      idempotency_key: string;
      reference: string;
      description: string;
      status: string;
      transaction_date: Date;
      posted_at: Date | null;
      voided_at: Date | null;
      void_reason: string | null;
      metadata: Record<string, unknown>;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>(
      'UPDATE transactions SET status = \'POSTED\', posted_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    
    const updatedTransaction = mapRowToTransaction(result.rows[0]);
    
    await auditService.log({
      entityType: 'transaction',
      entityId: id,
      action: 'POST',
      oldValue: transaction as unknown as Record<string, unknown>,
      newValue: updatedTransaction as unknown as Record<string, unknown>,
      userId,
    });
    
    return updatedTransaction;
  }

  async voidTransaction(id: string, reason: string, userId: string): Promise<Transaction> {
    const transaction = await this.getTransaction(id);
    if (!transaction) {
      throw new Error(`Transaction not found: ${id}`);
    }
    
    if (transaction.status === TransactionStatus.VOIDED) {
      throw new Error(`Transaction is already voided: ${id}`);
    }
    
    const result = await query<{
      id: string;
      idempotency_key: string;
      reference: string;
      description: string;
      status: string;
      transaction_date: Date;
      posted_at: Date | null;
      voided_at: Date | null;
      void_reason: string | null;
      metadata: Record<string, unknown>;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>(
      'UPDATE transactions SET status = \'VOIDED\', voided_at = NOW(), void_reason = $2 WHERE id = $1 RETURNING *',
      [id, reason]
    );
    
    const updatedTransaction = mapRowToTransaction(result.rows[0]);
    
    await auditService.log({
      entityType: 'transaction',
      entityId: id,
      action: 'VOID',
      oldValue: transaction as unknown as Record<string, unknown>,
      newValue: updatedTransaction as unknown as Record<string, unknown>,
      userId,
    });
    
    return updatedTransaction;
  }

  async getTransactionsByAccount(
    accountId: string,
    options?: PaginationOptions & { startDate?: Date; endDate?: Date }
  ): Promise<PaginatedResult<Transaction>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE te.account_id = $1';
    const params: unknown[] = [accountId];
    let paramIndex = 2;
    
    if (options?.startDate) {
      whereClause += ` AND t.transaction_date >= $${paramIndex++}`;
      params.push(options.startDate);
    }
    
    if (options?.endDate) {
      whereClause += ` AND t.transaction_date <= $${paramIndex++}`;
      params.push(options.endDate);
    }
    
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT t.id) FROM transactions t
       JOIN transaction_entries te ON t.id = te.transaction_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    const queryParams = [...params, limit, offset];
    const result = await query<{
      id: string;
      idempotency_key: string;
      reference: string;
      description: string;
      status: string;
      transaction_date: Date;
      posted_at: Date | null;
      voided_at: Date | null;
      void_reason: string | null;
      metadata: Record<string, unknown>;
      created_by: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT DISTINCT t.* FROM transactions t
       JOIN transaction_entries te ON t.id = te.transaction_id
       ${whereClause}
       ORDER BY t.transaction_date DESC, t.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      queryParams
    );
    
    return {
      data: result.rows.map(mapRowToTransaction),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEntriesByAccount(
    accountId: string,
    options?: { startDate?: Date; endDate?: Date; status?: TransactionStatus }
  ): Promise<TransactionEntry[]> {
    let whereClause = 'WHERE te.account_id = $1';
    const params: unknown[] = [accountId];
    let paramIndex = 2;
    
    if (options?.startDate) {
      whereClause += ` AND t.transaction_date >= $${paramIndex++}`;
      params.push(options.startDate);
    }
    
    if (options?.endDate) {
      whereClause += ` AND t.transaction_date <= $${paramIndex++}`;
      params.push(options.endDate);
    }
    
    if (options?.status) {
      whereClause += ` AND t.status = $${paramIndex++}`;
      params.push(options.status);
    }
    
    const result = await query<{
      id: string;
      transaction_id: string;
      account_id: string;
      entry_type: string;
      amount: string;
      currency_code: string;
      base_currency_amount: string;
      exchange_rate: string;
      description: string | null;
      created_at: Date;
    }>(
      `SELECT te.* FROM transaction_entries te
       JOIN transactions t ON te.transaction_id = t.id
       ${whereClause}
       ORDER BY t.transaction_date, te.created_at`,
      params
    );
    
    return result.rows.map(mapRowToEntry);
  }
}

export const transactionService = new TransactionService();
