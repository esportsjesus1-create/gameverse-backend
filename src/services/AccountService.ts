import Decimal from 'decimal.js';
import { query } from '../db/pool';
import {
  Account,
  AccountType,
  EntryType,
  CreateAccountInput,
  PaginationOptions,
  PaginatedResult,
} from '../types';
import { auditService } from './AuditService';

function getNormalBalance(type: AccountType): EntryType {
  switch (type) {
    case AccountType.ASSET:
    case AccountType.EXPENSE:
      return EntryType.DEBIT;
    case AccountType.LIABILITY:
    case AccountType.EQUITY:
    case AccountType.REVENUE:
      return EntryType.CREDIT;
  }
}

function mapRowToAccount(row: {
  id: string;
  code: string;
  name: string;
  type: string;
  currency_code: string;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
  normal_balance: string;
  created_at: Date;
  updated_at: Date;
}): Account {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as AccountType,
    currencyCode: row.currency_code,
    parentId: row.parent_id,
    description: row.description,
    isActive: row.is_active,
    normalBalance: row.normal_balance as EntryType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AccountService {
  async createAccount(input: CreateAccountInput, userId: string): Promise<Account> {
    const normalBalance = getNormalBalance(input.type);
    
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO accounts (code, name, type, currency_code, parent_id, description, normal_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [input.code, input.name, input.type, input.currencyCode, input.parentId || null, input.description || null, normalBalance]
    );
    
    const account = mapRowToAccount(result.rows[0]);
    
    await auditService.log({
      entityType: 'account',
      entityId: account.id,
      action: 'CREATE',
      oldValue: null,
      newValue: account as unknown as Record<string, unknown>,
      userId,
    });
    
    return account;
  }

  async getAccount(id: string): Promise<Account | null> {
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM accounts WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToAccount(result.rows[0]);
  }

  async getAccountByCode(code: string): Promise<Account | null> {
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM accounts WHERE code = $1', [code]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToAccount(result.rows[0]);
  }

  async getAllAccounts(options?: PaginationOptions): Promise<PaginatedResult<Account>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await query<{ count: string }>('SELECT COUNT(*) FROM accounts');
    const total = parseInt(countResult.rows[0].count, 10);
    
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM accounts ORDER BY code LIMIT $1 OFFSET $2', [limit, offset]);
    
    return {
      data: result.rows.map(mapRowToAccount),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAccountsByType(type: AccountType): Promise<Account[]> {
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM accounts WHERE type = $1 ORDER BY code', [type]);
    
    return result.rows.map(mapRowToAccount);
  }

  async getChildAccounts(parentId: string): Promise<Account[]> {
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM accounts WHERE parent_id = $1 ORDER BY code', [parentId]);
    
    return result.rows.map(mapRowToAccount);
  }

  async updateAccount(
    id: string,
    updates: Partial<Pick<Account, 'name' | 'description' | 'isActive'>>,
    userId: string
  ): Promise<Account> {
    const oldAccount = await this.getAccount(id);
    if (!oldAccount) {
      throw new Error(`Account not found: ${id}`);
    }
    
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    
    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(updates.isActive);
    }
    
    if (setClauses.length === 0) {
      return oldAccount;
    }
    
    values.push(id);
    
    const result = await query<{
      id: string;
      code: string;
      name: string;
      type: string;
      currency_code: string;
      parent_id: string | null;
      description: string | null;
      is_active: boolean;
      normal_balance: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE accounts SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    const newAccount = mapRowToAccount(result.rows[0]);
    
    await auditService.log({
      entityType: 'account',
      entityId: id,
      action: 'UPDATE',
      oldValue: oldAccount as unknown as Record<string, unknown>,
      newValue: newAccount as unknown as Record<string, unknown>,
      userId,
    });
    
    return newAccount;
  }

  async getAccountBalance(accountId: string, asOfDate?: Date): Promise<Decimal> {
    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    
    let dateCondition = '';
    const params: unknown[] = [accountId];
    
    if (asOfDate) {
      dateCondition = 'AND t.transaction_date <= $2';
      params.push(asOfDate);
    }
    
    const result = await query<{
      total_debits: string | null;
      total_credits: string | null;
    }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN te.entry_type = 'DEBIT' THEN te.amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN te.entry_type = 'CREDIT' THEN te.amount ELSE 0 END), 0) as total_credits
       FROM transaction_entries te
       JOIN transactions t ON te.transaction_id = t.id
       WHERE te.account_id = $1 AND t.status = 'POSTED' ${dateCondition}`,
      params
    );
    
    const totalDebits = new Decimal(result.rows[0].total_debits || '0');
    const totalCredits = new Decimal(result.rows[0].total_credits || '0');
    
    if (account.normalBalance === EntryType.DEBIT) {
      return totalDebits.minus(totalCredits);
    } else {
      return totalCredits.minus(totalDebits);
    }
  }

  async getAccountBalanceInBaseCurrency(accountId: string, asOfDate?: Date): Promise<Decimal> {
    const account = await this.getAccount(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    
    let dateCondition = '';
    const params: unknown[] = [accountId];
    
    if (asOfDate) {
      dateCondition = 'AND t.transaction_date <= $2';
      params.push(asOfDate);
    }
    
    const result = await query<{
      total_debits: string | null;
      total_credits: string | null;
    }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN te.entry_type = 'DEBIT' THEN te.base_currency_amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN te.entry_type = 'CREDIT' THEN te.base_currency_amount ELSE 0 END), 0) as total_credits
       FROM transaction_entries te
       JOIN transactions t ON te.transaction_id = t.id
       WHERE te.account_id = $1 AND t.status = 'POSTED' ${dateCondition}`,
      params
    );
    
    const totalDebits = new Decimal(result.rows[0].total_debits || '0');
    const totalCredits = new Decimal(result.rows[0].total_credits || '0');
    
    if (account.normalBalance === EntryType.DEBIT) {
      return totalDebits.minus(totalCredits);
    } else {
      return totalCredits.minus(totalDebits);
    }
  }

  async deactivateAccount(id: string, userId: string): Promise<Account> {
    const balance = await this.getAccountBalance(id);
    if (!balance.isZero()) {
      throw new Error('Cannot deactivate account with non-zero balance');
    }
    
    return this.updateAccount(id, { isActive: false }, userId);
  }
}

export const accountService = new AccountService();
