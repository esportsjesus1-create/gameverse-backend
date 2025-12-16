import {
  AccountType,
  EntryType,
  TransactionStatus,
  ReconciliationStatus,
} from '../../src/types';

describe('Types', () => {
  describe('AccountType', () => {
    it('should have all account types defined', () => {
      expect(AccountType.ASSET).toBe('ASSET');
      expect(AccountType.LIABILITY).toBe('LIABILITY');
      expect(AccountType.EQUITY).toBe('EQUITY');
      expect(AccountType.REVENUE).toBe('REVENUE');
      expect(AccountType.EXPENSE).toBe('EXPENSE');
    });

    it('should have exactly 5 account types', () => {
      const types = Object.values(AccountType);
      expect(types).toHaveLength(5);
    });
  });

  describe('EntryType', () => {
    it('should have debit and credit types', () => {
      expect(EntryType.DEBIT).toBe('DEBIT');
      expect(EntryType.CREDIT).toBe('CREDIT');
    });

    it('should have exactly 2 entry types', () => {
      const types = Object.values(EntryType);
      expect(types).toHaveLength(2);
    });
  });

  describe('TransactionStatus', () => {
    it('should have all transaction statuses', () => {
      expect(TransactionStatus.PENDING).toBe('PENDING');
      expect(TransactionStatus.POSTED).toBe('POSTED');
      expect(TransactionStatus.VOIDED).toBe('VOIDED');
    });

    it('should have exactly 3 statuses', () => {
      const statuses = Object.values(TransactionStatus);
      expect(statuses).toHaveLength(3);
    });
  });

  describe('ReconciliationStatus', () => {
    it('should have all reconciliation statuses', () => {
      expect(ReconciliationStatus.BALANCED).toBe('BALANCED');
      expect(ReconciliationStatus.IMBALANCED).toBe('IMBALANCED');
      expect(ReconciliationStatus.PENDING).toBe('PENDING');
    });

    it('should have exactly 3 statuses', () => {
      const statuses = Object.values(ReconciliationStatus);
      expect(statuses).toHaveLength(3);
    });
  });
});
