import Decimal from 'decimal.js';
import { ReconciliationService } from '../../../src/services/ReconciliationService';
import { ReconciliationStatus } from '../../../src/types';
import * as pool from '../../../src/db/pool';

jest.mock('../../../src/db/pool');
jest.mock('../../../src/services/AccountService', () => ({
  accountService: {
    getAllAccounts: jest.fn().mockResolvedValue({
      data: [
        { id: 'acc-1', code: 'CASH', name: 'Cash', isActive: true, normalBalance: 'DEBIT' },
      ],
      total: 1,
    }),
    getAccountBalance: jest.fn().mockResolvedValue(new (require('decimal.js').default)(1000)),
  },
}));

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('ReconciliationService', () => {
  let reconciliationService: ReconciliationService;

  const mockReconciliationRow = {
    id: 'recon-1',
    run_date: new Date(),
    status: 'BALANCED',
    total_accounts: 1,
    balanced_accounts: 1,
    imbalanced_accounts: 0,
    discrepancies: [],
    completed_at: new Date(),
    created_at: new Date(),
  };

  beforeEach(() => {
    reconciliationService = new ReconciliationService();
    jest.clearAllMocks();
  });

  describe('runReconciliation', () => {
    it('should run reconciliation and return balanced result', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...mockReconciliationRow, status: 'PENDING' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '1000', total_credits: '1000' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockReconciliationRow] } as never);

      const result = await reconciliationService.runReconciliation();

      expect(result.status).toBe(ReconciliationStatus.BALANCED);
    });

    it('should detect global imbalance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...mockReconciliationRow, status: 'PENDING' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '1000', total_credits: '900' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);
      const imbalancedRow = { ...mockReconciliationRow, status: 'IMBALANCED', imbalanced_accounts: 1 };
      mockQuery.mockResolvedValueOnce({ rows: [imbalancedRow] } as never);

      const result = await reconciliationService.runReconciliation();

      expect(result.status).toBe(ReconciliationStatus.IMBALANCED);
    });

    it('should handle reconciliation errors', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...mockReconciliationRow, status: 'PENDING' }] } as never);
      mockQuery.mockRejectedValueOnce(new Error('Database error'));
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(reconciliationService.runReconciliation()).rejects.toThrow('Database error');
    });
  });

  describe('getLatestReconciliation', () => {
    it('should return the latest reconciliation', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockReconciliationRow] } as never);

      const result = await reconciliationService.getLatestReconciliation();

      expect(result).not.toBeNull();
      expect(result?.status).toBe(ReconciliationStatus.BALANCED);
    });

    it('should return null if no reconciliations exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await reconciliationService.getLatestReconciliation();

      expect(result).toBeNull();
    });
  });

  describe('getReconciliationHistory', () => {
    it('should return reconciliation history', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockReconciliationRow] } as never);

      const result = await reconciliationService.getReconciliationHistory(10);

      expect(result).toHaveLength(1);
    });
  });

  describe('getReconciliation', () => {
    it('should return a reconciliation by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockReconciliationRow] } as never);

      const result = await reconciliationService.getReconciliation('recon-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('recon-1');
    });

    it('should return null for non-existent reconciliation', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await reconciliationService.getReconciliation('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('verifyTransactionBalance', () => {
    it('should return true for balanced transaction', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '100', total_credits: '100' }] } as never);

      const result = await reconciliationService.verifyTransactionBalance('tx-1');

      expect(result).toBe(true);
    });

    it('should return false for imbalanced transaction', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '100', total_credits: '90' }] } as never);

      const result = await reconciliationService.verifyTransactionBalance('tx-1');

      expect(result).toBe(false);
    });
  });
});
