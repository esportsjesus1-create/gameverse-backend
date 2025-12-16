import Decimal from 'decimal.js';
import { query } from '../db/pool';
import {
  ReconciliationResult,
  ReconciliationStatus,
  ReconciliationDiscrepancy,
  EntryType,
} from '../types';
import { accountService } from './AccountService';

function mapRowToReconciliationResult(row: {
  id: string;
  run_date: Date;
  status: string;
  total_accounts: number;
  balanced_accounts: number;
  imbalanced_accounts: number;
  discrepancies: ReconciliationDiscrepancy[];
  completed_at: Date;
  created_at: Date;
}): ReconciliationResult {
  return {
    id: row.id,
    runDate: row.run_date,
    status: row.status as ReconciliationStatus,
    totalAccounts: row.total_accounts,
    balancedAccounts: row.balanced_accounts,
    imbalancedAccounts: row.imbalanced_accounts,
    discrepancies: row.discrepancies || [],
    completedAt: row.completed_at,
  };
}

export class ReconciliationService {
  async runReconciliation(): Promise<ReconciliationResult> {
    const runResult = await query<{
      id: string;
      run_date: Date;
      status: string;
      total_accounts: number;
      balanced_accounts: number;
      imbalanced_accounts: number;
      discrepancies: ReconciliationDiscrepancy[];
      completed_at: Date;
      created_at: Date;
    }>(
      'INSERT INTO reconciliation_runs (status) VALUES (\'PENDING\') RETURNING *'
    );
    
    const runId = runResult.rows[0].id;
    
    try {
      const discrepancies: ReconciliationDiscrepancy[] = [];
      
      const globalBalanceResult = await query<{
        total_debits: string;
        total_credits: string;
      }>(
        `SELECT 
          COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN base_currency_amount ELSE 0 END), 0) as total_debits,
          COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN base_currency_amount ELSE 0 END), 0) as total_credits
         FROM transaction_entries te
         JOIN transactions t ON te.transaction_id = t.id
         WHERE t.status = 'POSTED'`
      );
      
      const globalDebits = new Decimal(globalBalanceResult.rows[0].total_debits);
      const globalCredits = new Decimal(globalBalanceResult.rows[0].total_credits);
      
      if (!globalDebits.eq(globalCredits)) {
        discrepancies.push({
          accountId: 'GLOBAL',
          accountCode: 'GLOBAL',
          accountName: 'Global Balance Check',
          expectedBalance: globalDebits,
          actualBalance: globalCredits,
          difference: globalDebits.minus(globalCredits),
        });
      }
      
      const accountsResult = await accountService.getAllAccounts({ page: 1, limit: 10000 });
      const accounts = accountsResult.data.filter(a => a.isActive);
      
      let balancedAccounts = 0;
      let imbalancedAccounts = 0;
      
      for (const account of accounts) {
        const calculatedBalance = await accountService.getAccountBalance(account.id);
        
        const snapshotResult = await query<{ balance: string }>(
          `SELECT balance FROM balance_snapshots 
           WHERE account_id = $1 
           ORDER BY snapshot_date DESC 
           LIMIT 1`,
          [account.id]
        );
        
        if (snapshotResult.rows.length > 0) {
          const snapshotBalance = new Decimal(snapshotResult.rows[0].balance);
          
          const entriesAfterSnapshot = await query<{
            total_debits: string;
            total_credits: string;
          }>(
            `SELECT 
              COALESCE(SUM(CASE WHEN te.entry_type = 'DEBIT' THEN te.amount ELSE 0 END), 0) as total_debits,
              COALESCE(SUM(CASE WHEN te.entry_type = 'CREDIT' THEN te.amount ELSE 0 END), 0) as total_credits
             FROM transaction_entries te
             JOIN transactions t ON te.transaction_id = t.id
             WHERE te.account_id = $1 
             AND t.status = 'POSTED'
             AND t.transaction_date > (
               SELECT snapshot_date FROM balance_snapshots 
               WHERE account_id = $1 
               ORDER BY snapshot_date DESC 
               LIMIT 1
             )`,
            [account.id]
          );
          
          const debitsAfter = new Decimal(entriesAfterSnapshot.rows[0].total_debits);
          const creditsAfter = new Decimal(entriesAfterSnapshot.rows[0].total_credits);
          
          let expectedBalance: Decimal;
          if (account.normalBalance === EntryType.DEBIT) {
            expectedBalance = snapshotBalance.plus(debitsAfter).minus(creditsAfter);
          } else {
            expectedBalance = snapshotBalance.plus(creditsAfter).minus(debitsAfter);
          }
          
          if (!expectedBalance.eq(calculatedBalance)) {
            imbalancedAccounts++;
            discrepancies.push({
              accountId: account.id,
              accountCode: account.code,
              accountName: account.name,
              expectedBalance,
              actualBalance: calculatedBalance,
              difference: expectedBalance.minus(calculatedBalance),
            });
          } else {
            balancedAccounts++;
          }
        } else {
          balancedAccounts++;
        }
      }
      
      const status = discrepancies.length === 0 
        ? ReconciliationStatus.BALANCED 
        : ReconciliationStatus.IMBALANCED;
      
      const updateResult = await query<{
        id: string;
        run_date: Date;
        status: string;
        total_accounts: number;
        balanced_accounts: number;
        imbalanced_accounts: number;
        discrepancies: ReconciliationDiscrepancy[];
        completed_at: Date;
        created_at: Date;
      }>(
        `UPDATE reconciliation_runs 
         SET status = $1, 
             total_accounts = $2, 
             balanced_accounts = $3, 
             imbalanced_accounts = $4, 
             discrepancies = $5,
             completed_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [
          status,
          accounts.length,
          balancedAccounts,
          imbalancedAccounts,
          JSON.stringify(discrepancies.map(d => ({
            ...d,
            expectedBalance: d.expectedBalance.toString(),
            actualBalance: d.actualBalance.toString(),
            difference: d.difference.toString(),
          }))),
          runId,
        ]
      );
      
      return mapRowToReconciliationResult(updateResult.rows[0]);
    } catch (error) {
      await query(
        `UPDATE reconciliation_runs 
         SET status = 'IMBALANCED', 
             discrepancies = $1,
             completed_at = NOW()
         WHERE id = $2`,
        [JSON.stringify([{ error: error instanceof Error ? error.message : 'Unknown error' }]), runId]
      );
      throw error;
    }
  }

  async getLatestReconciliation(): Promise<ReconciliationResult | null> {
    const result = await query<{
      id: string;
      run_date: Date;
      status: string;
      total_accounts: number;
      balanced_accounts: number;
      imbalanced_accounts: number;
      discrepancies: ReconciliationDiscrepancy[];
      completed_at: Date;
      created_at: Date;
    }>(
      'SELECT * FROM reconciliation_runs ORDER BY run_date DESC LIMIT 1'
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToReconciliationResult(result.rows[0]);
  }

  async getReconciliationHistory(limit: number = 10): Promise<ReconciliationResult[]> {
    const result = await query<{
      id: string;
      run_date: Date;
      status: string;
      total_accounts: number;
      balanced_accounts: number;
      imbalanced_accounts: number;
      discrepancies: ReconciliationDiscrepancy[];
      completed_at: Date;
      created_at: Date;
    }>(
      'SELECT * FROM reconciliation_runs ORDER BY run_date DESC LIMIT $1',
      [limit]
    );
    
    return result.rows.map(mapRowToReconciliationResult);
  }

  async getReconciliation(id: string): Promise<ReconciliationResult | null> {
    const result = await query<{
      id: string;
      run_date: Date;
      status: string;
      total_accounts: number;
      balanced_accounts: number;
      imbalanced_accounts: number;
      discrepancies: ReconciliationDiscrepancy[];
      completed_at: Date;
      created_at: Date;
    }>(
      'SELECT * FROM reconciliation_runs WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return mapRowToReconciliationResult(result.rows[0]);
  }

  async verifyTransactionBalance(transactionId: string): Promise<boolean> {
    const result = await query<{
      total_debits: string;
      total_credits: string;
    }>(
      `SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'DEBIT' THEN base_currency_amount ELSE 0 END), 0) as total_debits,
        COALESCE(SUM(CASE WHEN entry_type = 'CREDIT' THEN base_currency_amount ELSE 0 END), 0) as total_credits
       FROM transaction_entries
       WHERE transaction_id = $1`,
      [transactionId]
    );
    
    const debits = new Decimal(result.rows[0].total_debits);
    const credits = new Decimal(result.rows[0].total_credits);
    
    return debits.eq(credits);
  }
}

export const reconciliationService = new ReconciliationService();
