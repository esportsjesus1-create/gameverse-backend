import Decimal from 'decimal.js';
import { SnapshotService } from '../../../src/services/SnapshotService';
import * as pool from '../../../src/db/pool';

jest.mock('../../../src/db/pool');
jest.mock('../../../src/services/AccountService', () => ({
  accountService: {
    getAccount: jest.fn().mockResolvedValue({
      id: 'acc-1',
      code: 'CASH',
      name: 'Cash',
      type: 'ASSET',
      currencyCode: 'USD',
      isActive: true,
      normalBalance: 'DEBIT',
    }),
    getAccountBalance: jest.fn().mockResolvedValue(new (require('decimal.js').default)(1000)),
    getAllAccounts: jest.fn().mockResolvedValue({
      data: [
        { id: 'acc-1', code: 'CASH', isActive: true },
        { id: 'acc-2', code: 'BANK', isActive: true },
        { id: 'acc-3', code: 'INACTIVE', isActive: false },
      ],
      total: 3,
    }),
  },
}));

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('SnapshotService', () => {
  let snapshotService: SnapshotService;

  const mockSnapshotRow = {
    id: 'snap-1',
    account_id: 'acc-1',
    balance: '1000',
    currency_code: 'USD',
    snapshot_date: new Date(),
    created_at: new Date(),
  };

  beforeEach(() => {
    snapshotService = new SnapshotService();
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('should create a balance snapshot', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.createSnapshot('acc-1');

      expect(result.accountId).toBe('acc-1');
      expect(result.balance.toString()).toBe('1000');
    });

    it('should throw error for non-existent account', async () => {
      const { accountService } = require('../../../src/services/AccountService');
      accountService.getAccount.mockResolvedValueOnce(null);

      await expect(snapshotService.createSnapshot('non-existent')).rejects.toThrow('Account not found');
    });
  });

  describe('createSnapshotsForAllAccounts', () => {
    it('should create snapshots for all active accounts', async () => {
      mockQuery.mockResolvedValue({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.createSnapshotsForAllAccounts();

      expect(result.length).toBe(2);
    });
  });

  describe('getSnapshot', () => {
    it('should return a snapshot for account and date', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.getSnapshot('acc-1', new Date());

      expect(result).not.toBeNull();
      expect(result?.accountId).toBe('acc-1');
    });

    it('should return null if no snapshot found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await snapshotService.getSnapshot('acc-1', new Date());

      expect(result).toBeNull();
    });
  });

  describe('getLatestSnapshot', () => {
    it('should return the latest snapshot', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.getLatestSnapshot('acc-1');

      expect(result).not.toBeNull();
    });

    it('should return null if no snapshots exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await snapshotService.getLatestSnapshot('acc-1');

      expect(result).toBeNull();
    });
  });

  describe('getSnapshotHistory', () => {
    it('should return snapshot history', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.getSnapshotHistory('acc-1', new Date('2024-01-01'), new Date('2024-12-31'));

      expect(result).toHaveLength(1);
    });
  });

  describe('getAllSnapshotsForDate', () => {
    it('should return all snapshots for a date', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.getAllSnapshotsForDate(new Date());

      expect(result).toHaveLength(1);
    });
  });

  describe('getBalanceAtDate', () => {
    it('should return snapshot balance if exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.getBalanceAtDate('acc-1', new Date());

      expect(result.toString()).toBe('1000');
    });

    it('should calculate balance if no snapshot exists', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await snapshotService.getBalanceAtDate('acc-1', new Date());

      expect(result.toString()).toBe('1000');
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should delete old snapshots', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 5 } as never);

      const result = await snapshotService.cleanupOldSnapshots();

      expect(result).toBe(5);
    });

    it('should return 0 if no snapshots deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: null } as never);

      const result = await snapshotService.cleanupOldSnapshots();

      expect(result).toBe(0);
    });
  });

  describe('getSnapshotsByAccount', () => {
    it('should return paginated snapshots', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockSnapshotRow] } as never);

      const result = await snapshotService.getSnapshotsByAccount('acc-1');

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
