import Decimal from 'decimal.js';
import { StatementService } from '../../../src/services/StatementService';
import { EntryType, TransactionStatus } from '../../../src/types';

jest.mock('../../../src/services/AccountService', () => ({
  accountService: {
    getAccount: jest.fn().mockResolvedValue({
      id: 'acc-1',
      code: 'CASH',
      name: 'Cash Account',
      type: 'ASSET',
      currencyCode: 'USD',
      isActive: true,
      normalBalance: 'DEBIT',
    }),
    getAccountBalance: jest.fn().mockResolvedValue(new (require('decimal.js').default)(500)),
  },
}));

jest.mock('../../../src/services/TransactionService', () => ({
  transactionService: {
    getEntriesByAccount: jest.fn().mockResolvedValue([
      {
        id: 'entry-1',
        transactionId: 'tx-1',
        accountId: 'acc-1',
        entryType: 'DEBIT',
        amount: new (require('decimal.js').default)(100),
        currencyCode: 'USD',
        baseCurrencyAmount: new (require('decimal.js').default)(100),
        exchangeRate: new (require('decimal.js').default)(1),
        description: 'Test debit',
        createdAt: new Date(),
      },
      {
        id: 'entry-2',
        transactionId: 'tx-2',
        accountId: 'acc-1',
        entryType: 'CREDIT',
        amount: new (require('decimal.js').default)(50),
        currencyCode: 'USD',
        baseCurrencyAmount: new (require('decimal.js').default)(50),
        exchangeRate: new (require('decimal.js').default)(1),
        description: 'Test credit',
        createdAt: new Date(),
      },
    ]),
    getTransaction: jest.fn().mockResolvedValue({
      id: 'tx-1',
      reference: 'REF001',
      description: 'Test transaction',
      transactionDate: new Date('2024-06-15'),
      status: 'POSTED',
    }),
  },
}));

describe('StatementService', () => {
  let statementService: StatementService;

  beforeEach(() => {
    statementService = new StatementService();
    jest.clearAllMocks();
  });

  describe('generateStatement', () => {
    it('should generate CSV statement', async () => {
      const result = await statementService.generateStatement({
        accountId: 'acc-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'CSV',
      });

      expect(result.mimeType).toBe('text/csv');
      expect(result.filename).toContain('.csv');
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should generate PDF statement', async () => {
      const result = await statementService.generateStatement({
        accountId: 'acc-1',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'PDF',
      });

      expect(result.mimeType).toBe('application/pdf');
      expect(result.filename).toContain('.pdf');
      expect(result.data).toBeInstanceOf(Buffer);
    });

    it('should throw error for non-existent account', async () => {
      const { accountService } = require('../../../src/services/AccountService');
      accountService.getAccount.mockResolvedValueOnce(null);

      await expect(statementService.generateStatement({
        accountId: 'non-existent',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        format: 'CSV',
      })).rejects.toThrow('Account not found');
    });
  });

  describe('getAccountSummary', () => {
    it('should return account summary', async () => {
      const result = await statementService.getAccountSummary(
        'acc-1',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      );

      expect(result.openingBalance).toBeDefined();
      expect(result.closingBalance).toBeDefined();
      expect(result.totalDebits).toBeDefined();
      expect(result.totalCredits).toBeDefined();
      expect(result.netChange).toBeDefined();
      expect(result.transactionCount).toBeGreaterThanOrEqual(0);
    });

    it('should throw error for non-existent account', async () => {
      const { accountService } = require('../../../src/services/AccountService');
      accountService.getAccount.mockResolvedValueOnce(null);

      await expect(statementService.getAccountSummary(
        'non-existent',
        new Date('2024-01-01'),
        new Date('2024-12-31')
      )).rejects.toThrow('Account not found');
    });
  });
});
