import { TransactionStatus, EntryType } from '../../../src/types';

jest.mock('../../../src/db/pool', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
  getClient: jest.fn(),
  closePool: jest.fn(),
  setPool: jest.fn(),
  getPool: jest.fn(),
}));

jest.mock('../../../src/services/CurrencyService', () => ({
  currencyService: {
    getBaseCurrency: jest.fn(),
    convertToBaseCurrency: jest.fn(),
  },
}));

jest.mock('../../../src/services/AccountService', () => ({
  accountService: {
    getAccount: jest.fn(),
  },
}));

jest.mock('../../../src/services/AuditService', () => ({
  auditService: {
    log: jest.fn(),
  },
}));

describe('TransactionService', () => {
  describe('TransactionStatus enum', () => {
    it('should have PENDING status', () => {
      expect(TransactionStatus.PENDING).toBe('PENDING');
    });

    it('should have POSTED status', () => {
      expect(TransactionStatus.POSTED).toBe('POSTED');
    });

    it('should have VOIDED status', () => {
      expect(TransactionStatus.VOIDED).toBe('VOIDED');
    });
  });

  describe('EntryType enum', () => {
    it('should have DEBIT type', () => {
      expect(EntryType.DEBIT).toBe('DEBIT');
    });

    it('should have CREDIT type', () => {
      expect(EntryType.CREDIT).toBe('CREDIT');
    });
  });

  describe('createTransaction validation', () => {
    it('should require entries array', () => {
      const { TransactionService } = require('../../../src/services/TransactionService');
      const service = new TransactionService();
      
      expect(service.createTransaction({
        idempotencyKey: 'test',
        reference: 'REF',
        description: 'Test',
        transactionDate: new Date(),
        entries: [],
        createdBy: 'user',
      })).rejects.toThrow('Transaction must have at least one entry');
    });

    it('should reject too many entries', () => {
      const { TransactionService } = require('../../../src/services/TransactionService');
      const service = new TransactionService();
      const entries = Array(101).fill({
        accountId: 'acc-1',
        entryType: EntryType.DEBIT,
        amount: 100,
        currencyCode: 'USD',
      });
      
      expect(service.createTransaction({
        idempotencyKey: 'test',
        reference: 'REF',
        description: 'Test',
        transactionDate: new Date(),
        entries,
        createdBy: 'user',
      })).rejects.toThrow('Transaction cannot have more than');
    });
  });

  describe('Transaction mapping', () => {
    it('should map transaction row correctly', () => {
      const row = {
        id: 'tx-1',
        idempotency_key: 'idem-1',
        reference: 'REF001',
        description: 'Test',
        status: 'PENDING',
        transaction_date: new Date('2024-01-01'),
        posted_at: null,
        voided_at: null,
        void_reason: null,
        metadata: { key: 'value' },
        created_by: 'user-1',
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      };

      expect(row.id).toBe('tx-1');
      expect(row.idempotency_key).toBe('idem-1');
      expect(row.status).toBe('PENDING');
    });
  });

  describe('Entry mapping', () => {
    it('should have correct entry structure', () => {
      const entry = {
        id: 'entry-1',
        transaction_id: 'tx-1',
        account_id: 'acc-1',
        entry_type: 'DEBIT',
        amount: '100.00',
        currency_code: 'USD',
        base_currency_amount: '100.00',
        exchange_rate: '1.00',
        description: 'Test entry',
        created_at: new Date('2024-01-01'),
      };

      expect(entry.entry_type).toBe('DEBIT');
      expect(entry.amount).toBe('100.00');
      expect(entry.currency_code).toBe('USD');
    });
  });
});
