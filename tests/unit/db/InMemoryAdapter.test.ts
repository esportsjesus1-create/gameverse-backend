import Decimal from 'decimal.js';
import { InMemoryAdapter } from '../../../src/db/adapters/InMemoryAdapter';
import { AccountType, EntryType, TransactionStatus } from '../../../src/types';

describe('InMemoryAdapter', () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  describe('Account operations', () => {
    it('should create an account', () => {
      const account = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      expect(account.id).toBeDefined();
      expect(account.code).toBe('CASH');
      expect(account.type).toBe(AccountType.ASSET);
      expect(account.normalBalance).toBe(EntryType.DEBIT);
    });

    it('should get account by id', () => {
      const created = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const account = adapter.getAccount(created.id);
      expect(account).not.toBeNull();
      expect(account?.code).toBe('CASH');
    });

    it('should get account by code', () => {
      adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const account = adapter.getAccountByCode('CASH');
      expect(account).not.toBeNull();
      expect(account?.name).toBe('Cash');
    });

    it('should return null for non-existent account', () => {
      const account = adapter.getAccount('non-existent');
      expect(account).toBeNull();
    });

    it('should update an account', () => {
      const created = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const updated = adapter.updateAccount(created.id, { name: 'Petty Cash' });
      expect(updated?.name).toBe('Petty Cash');
    });

    it('should set correct normal balance for liability accounts', () => {
      const account = adapter.createAccount({
        code: 'AP',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
        currencyCode: 'USD',
      });

      expect(account.normalBalance).toBe(EntryType.CREDIT);
    });
  });

  describe('Transaction operations', () => {
    let cashAccount: ReturnType<typeof adapter.createAccount>;
    let revenueAccount: ReturnType<typeof adapter.createAccount>;

    beforeEach(() => {
      cashAccount = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      revenueAccount = adapter.createAccount({
        code: 'REVENUE',
        name: 'Revenue',
        type: AccountType.REVENUE,
        currencyCode: 'USD',
      });
    });

    it('should create a balanced transaction', () => {
      const tx = adapter.createTransaction({
        idempotencyKey: 'tx-1',
        reference: 'REF001',
        description: 'Test transaction',
        transactionDate: new Date(),
        entries: [
          { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      expect(tx.id).toBeDefined();
      expect(tx.status).toBe(TransactionStatus.PENDING);
    });

    it('should reject unbalanced transaction', () => {
      expect(() => {
        adapter.createTransaction({
          idempotencyKey: 'tx-2',
          reference: 'REF002',
          description: 'Unbalanced',
          transactionDate: new Date(),
          entries: [
            { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
            { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 50, currencyCode: 'USD' },
          ],
          createdBy: 'user-1',
        });
      }).toThrow('Transaction is not balanced');
    });

    it('should return existing transaction for duplicate idempotency key', () => {
      const tx1 = adapter.createTransaction({
        idempotencyKey: 'tx-dup',
        reference: 'REF001',
        description: 'First',
        transactionDate: new Date(),
        entries: [
          { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      const tx2 = adapter.createTransaction({
        idempotencyKey: 'tx-dup',
        reference: 'REF002',
        description: 'Second',
        transactionDate: new Date(),
        entries: [
          { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 200, currencyCode: 'USD' },
          { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 200, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      expect(tx2.id).toBe(tx1.id);
      expect(tx2.description).toBe('First');
    });

    it('should post a transaction', () => {
      const tx = adapter.createTransaction({
        idempotencyKey: 'tx-post',
        reference: 'REF001',
        description: 'To post',
        transactionDate: new Date(),
        entries: [
          { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      const posted = adapter.postTransaction(tx.id);
      expect(posted?.status).toBe(TransactionStatus.POSTED);
      expect(posted?.postedAt).not.toBeNull();
    });

    it('should void a transaction', () => {
      const tx = adapter.createTransaction({
        idempotencyKey: 'tx-void',
        reference: 'REF001',
        description: 'To void',
        transactionDate: new Date(),
        entries: [
          { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      const voided = adapter.voidTransaction(tx.id, 'Test reason');
      expect(voided?.status).toBe(TransactionStatus.VOIDED);
      expect(voided?.voidReason).toBe('Test reason');
    });

    it('should get transaction entries', () => {
      const tx = adapter.createTransaction({
        idempotencyKey: 'tx-entries',
        reference: 'REF001',
        description: 'With entries',
        transactionDate: new Date(),
        entries: [
          { accountId: cashAccount.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenueAccount.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      const entries = adapter.getTransactionEntries(tx.id);
      expect(entries).toHaveLength(2);
    });
  });

  describe('Balance calculations', () => {
    it('should calculate account balance correctly', () => {
      const cash = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const revenue = adapter.createAccount({
        code: 'REVENUE',
        name: 'Revenue',
        type: AccountType.REVENUE,
        currencyCode: 'USD',
      });

      const tx = adapter.createTransaction({
        idempotencyKey: 'tx-balance',
        reference: 'REF001',
        description: 'Balance test',
        transactionDate: new Date(),
        entries: [
          { accountId: cash.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenue.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      adapter.postTransaction(tx.id);

      const cashBalance = adapter.getAccountBalance(cash.id);
      const revenueBalance = adapter.getAccountBalance(revenue.id);

      expect(cashBalance.eq(new Decimal(100))).toBe(true);
      expect(revenueBalance.eq(new Decimal(100))).toBe(true);
    });

    it('should not include pending transactions in balance', () => {
      const cash = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const revenue = adapter.createAccount({
        code: 'REVENUE',
        name: 'Revenue',
        type: AccountType.REVENUE,
        currencyCode: 'USD',
      });

      adapter.createTransaction({
        idempotencyKey: 'tx-pending',
        reference: 'REF001',
        description: 'Pending',
        transactionDate: new Date(),
        entries: [
          { accountId: cash.id, entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
          { accountId: revenue.id, entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
        ],
        createdBy: 'user-1',
      });

      const balance = adapter.getAccountBalance(cash.id);
      expect(balance.eq(new Decimal(0))).toBe(true);
    });
  });

  describe('Currency operations', () => {
    it('should have USD as default base currency', () => {
      const baseCurrency = adapter.getBaseCurrency();
      expect(baseCurrency?.code).toBe('USD');
      expect(baseCurrency?.isBaseCurrency).toBe(true);
    });

    it('should create a currency', () => {
      const eur = adapter.createCurrency({
        code: 'EUR',
        name: 'Euro',
        symbol: '€',
        decimalPlaces: 2,
        isBaseCurrency: false,
      });

      expect(eur.code).toBe('EUR');
    });

    it('should set and get exchange rate', () => {
      adapter.setExchangeRate('EUR', 'USD', 1.1);
      const rate = adapter.getExchangeRate('EUR', 'USD');
      expect(rate.eq(new Decimal(1.1))).toBe(true);
    });

    it('should return 1 for same currency exchange rate', () => {
      const rate = adapter.getExchangeRate('USD', 'USD');
      expect(rate.eq(new Decimal(1))).toBe(true);
    });

    it('should calculate inverse exchange rate', () => {
      adapter.setExchangeRate('EUR', 'USD', 1.1);
      const rate = adapter.getExchangeRate('USD', 'EUR');
      expect(rate.toFixed(4)).toBe('0.9091');
    });
  });

  describe('Snapshot operations', () => {
    it('should create a balance snapshot', () => {
      const cash = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const snapshot = adapter.createSnapshot(cash.id);
      expect(snapshot.accountId).toBe(cash.id);
      expect(snapshot.balance.eq(new Decimal(0))).toBe(true);
    });

    it('should get latest snapshot', () => {
      const cash = adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      adapter.createSnapshot(cash.id);
      const latest = adapter.getLatestSnapshot(cash.id);
      expect(latest).not.toBeNull();
    });
  });

  describe('Audit operations', () => {
    it('should log audit entry', () => {
      const log = adapter.logAudit({
        entityType: 'account',
        entityId: 'acc-1',
        action: 'CREATE',
        oldValue: null,
        newValue: { name: 'Cash' },
        userId: 'user-1',
      });

      expect(log.id).toBeDefined();
      expect(log.action).toBe('CREATE');
    });

    it('should filter audit logs', () => {
      adapter.logAudit({
        entityType: 'account',
        entityId: 'acc-1',
        action: 'CREATE',
        oldValue: null,
        newValue: { name: 'Cash' },
        userId: 'user-1',
      });

      adapter.logAudit({
        entityType: 'transaction',
        entityId: 'tx-1',
        action: 'CREATE',
        oldValue: null,
        newValue: { description: 'Test' },
        userId: 'user-2',
      });

      const accountLogs = adapter.getAuditLogs({ entityType: 'account' });
      expect(accountLogs).toHaveLength(1);

      const user1Logs = adapter.getAuditLogs({ userId: 'user-1' });
      expect(user1Logs).toHaveLength(1);
    });
  });

  describe('Reconciliation', () => {
    it('should run reconciliation', () => {
      adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      const result = adapter.runReconciliation();
      expect(result.totalAccounts).toBe(1);
      expect(result.balancedAccounts).toBe(1);
    });
  });

  describe('Reset', () => {
    it('should reset all data', () => {
      adapter.createAccount({
        code: 'CASH',
        name: 'Cash',
        type: AccountType.ASSET,
        currencyCode: 'USD',
      });

      adapter.reset();

      const accounts = adapter.getAllAccounts();
      expect(accounts).toHaveLength(0);

      const baseCurrency = adapter.getBaseCurrency();
      expect(baseCurrency?.code).toBe('USD');
    });
  });
});
