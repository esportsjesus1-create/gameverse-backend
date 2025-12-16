import Decimal from 'decimal.js';
import { query } from '../db/pool';
import { BalanceSnapshot, PaginationOptions, PaginatedResult } from '../types';
import { accountService } from './AccountService';
import { config } from '../config';

function mapRowToSnapshot(row: {
  id: string;
  account_id: string;
  balance: string;
  currency_code: string;
  snapshot_date: Date;
  created_at: Date;
}): BalanceSnapshot {
  return {
    id: row.id,
    accountId: row.account_id,
    balance: new Decimal(row.balance),
    currencyCode: row.currency_code,
    snapshotDate: row.snapshot_date,
    createdAt: row.created_at,
  };
}

export class SnapshotService {
  async createSnapshot(accountId: string, date: Date = new Date()): Promise<BalanceSnapshot> {
    const account = await accountService.getAccount(accountId);
    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }
    
    const balance = await accountService.getAccountBalance(accountId, date);
    const dateStr = date.toISOString().split('T')[0];
    
    const result = await query<{
      id: string;
      account_id: string;
      balance: string;
      currency_code: string;
      snapshot_date: Date;
      created_at: Date;
    }>(
      `INSERT INTO balance_snapshots (account_id, balance, currency_code, snapshot_date)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (account_id, snapshot_date)
       DO UPDATE SET balance = EXCLUDED.balance
       RETURNING *`,
      [accountId, balance.toString(), account.currencyCode, dateStr]
    );
    
    return mapRowToSnapshot(result.rows[0]);
  }

  async createSnapshotsForAllAccounts(date: Date = new Date()): Promise<BalanceSnapshot[]> {
    const accountsResult = await accountService.getAllAccounts({ page: 1, limit: 10000 });
    const snapshots: BalanceSnapshot[] = [];
    
    for (const account of accountsResult.data) {
      if (account.isActive) {
        const snapshot = await this.createSnapshot(account.id, date);
        snapshots.push(snapshot);
      }
    }
    
    return snapshots;
  }

  async getSnapshot(accountId: string, date: Date): Promise<BalanceSnapshot | null> {
    const dateStr = date.toISOString().split('T')[0];
    
    const result = await query<{
      id: string;
      account_id: string;
      balance: string;
      currency_code: string;
      snapshot_date: Date;
      created_at: Date;
    }>(
      'SELECT * FROM balance_snapshots WHERE account_id = $1 AND snapshot_date = $2',
      [accountId, dateStr]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToSnapshot(result.rows[0]);
  }

  async getLatestSnapshot(accountId: string): Promise<BalanceSnapshot | null> {
    const result = await query<{
      id: string;
      account_id: string;
      balance: string;
      currency_code: string;
      snapshot_date: Date;
      created_at: Date;
    }>(
      'SELECT * FROM balance_snapshots WHERE account_id = $1 ORDER BY snapshot_date DESC LIMIT 1',
      [accountId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToSnapshot(result.rows[0]);
  }

  async getSnapshotHistory(
    accountId: string,
    startDate: Date,
    endDate: Date
  ): Promise<BalanceSnapshot[]> {
    const result = await query<{
      id: string;
      account_id: string;
      balance: string;
      currency_code: string;
      snapshot_date: Date;
      created_at: Date;
    }>(
      `SELECT * FROM balance_snapshots 
       WHERE account_id = $1 AND snapshot_date BETWEEN $2 AND $3
       ORDER BY snapshot_date`,
      [accountId, startDate, endDate]
    );
    
    return result.rows.map(mapRowToSnapshot);
  }

  async getAllSnapshotsForDate(date: Date): Promise<BalanceSnapshot[]> {
    const dateStr = date.toISOString().split('T')[0];
    
    const result = await query<{
      id: string;
      account_id: string;
      balance: string;
      currency_code: string;
      snapshot_date: Date;
      created_at: Date;
    }>(
      'SELECT * FROM balance_snapshots WHERE snapshot_date = $1 ORDER BY account_id',
      [dateStr]
    );
    
    return result.rows.map(mapRowToSnapshot);
  }

  async getBalanceAtDate(accountId: string, date: Date): Promise<Decimal> {
    const snapshot = await this.getSnapshot(accountId, date);
    
    if (snapshot) {
      return snapshot.balance;
    }
    
    return accountService.getAccountBalance(accountId, date);
  }

  async cleanupOldSnapshots(): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - config.ledger.snapshotRetentionDays);
    
    const result = await query(
      'DELETE FROM balance_snapshots WHERE snapshot_date < $1',
      [retentionDate]
    );
    
    return result.rowCount || 0;
  }

  async getSnapshotsByAccount(
    accountId: string,
    options?: PaginationOptions
  ): Promise<PaginatedResult<BalanceSnapshot>> {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;
    
    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) FROM balance_snapshots WHERE account_id = $1',
      [accountId]
    );
    const total = parseInt(countResult.rows[0].count, 10);
    
    const result = await query<{
      id: string;
      account_id: string;
      balance: string;
      currency_code: string;
      snapshot_date: Date;
      created_at: Date;
    }>(
      `SELECT * FROM balance_snapshots 
       WHERE account_id = $1 
       ORDER BY snapshot_date DESC 
       LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );
    
    return {
      data: result.rows.map(mapRowToSnapshot),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const snapshotService = new SnapshotService();
