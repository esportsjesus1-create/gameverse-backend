import Decimal from 'decimal.js';
import { AccountService } from '../../../src/services/AccountService';
import { AccountType, EntryType } from '../../../src/types';
import * as pool from '../../../src/db/pool';

jest.mock('../../../src/db/pool');
jest.mock('../../../src/services/AuditService', () => ({
  auditService: {
    log: jest.fn().mockResolvedValue({}),
  },
}));

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('AccountService', () => {
  let accountService: AccountService;

  const mockAccountRow = {
    id: 'acc-1',
    code: 'CASH',
    name: 'Cash Account',
    type: 'ASSET',
    currency_code: 'USD',
    parent_id: null,
    description: 'Main cash account',
    is_active: true,
    normal_balance: 'DEBIT',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    accountService = new AccountService();
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create an asset account with debit normal balance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);

      const result = await accountService.createAccount({
        code: 'CASH',
        name: 'Cash Account',
        type: AccountType.ASSET,
        currencyCode: 'USD',
        description: 'Main cash account',
      }, 'user-1');

      expect(result.code).toBe('CASH');
      expect(result.type).toBe(AccountType.ASSET);
      expect(result.normalBalance).toBe(EntryType.DEBIT);
    });

    it('should create a liability account with credit normal balance', async () => {
      const liabilityRow = { ...mockAccountRow, type: 'LIABILITY', normal_balance: 'CREDIT' };
      mockQuery.mockResolvedValueOnce({ rows: [liabilityRow] } as never);

      const result = await accountService.createAccount({
        code: 'AP',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
        currencyCode: 'USD',
      }, 'user-1');

      expect(result.type).toBe(AccountType.LIABILITY);
      expect(result.normalBalance).toBe(EntryType.CREDIT);
    });

    it('should create an equity account with credit normal balance', async () => {
      const equityRow = { ...mockAccountRow, type: 'EQUITY', normal_balance: 'CREDIT' };
      mockQuery.mockResolvedValueOnce({ rows: [equityRow] } as never);

      const result = await accountService.createAccount({
        code: 'EQUITY',
        name: 'Owner Equity',
        type: AccountType.EQUITY,
        currencyCode: 'USD',
      }, 'user-1');

      expect(result.type).toBe(AccountType.EQUITY);
      expect(result.normalBalance).toBe(EntryType.CREDIT);
    });

    it('should create a revenue account with credit normal balance', async () => {
      const revenueRow = { ...mockAccountRow, type: 'REVENUE', normal_balance: 'CREDIT' };
      mockQuery.mockResolvedValueOnce({ rows: [revenueRow] } as never);

      const result = await accountService.createAccount({
        code: 'SALES',
        name: 'Sales Revenue',
        type: AccountType.REVENUE,
        currencyCode: 'USD',
      }, 'user-1');

      expect(result.type).toBe(AccountType.REVENUE);
      expect(result.normalBalance).toBe(EntryType.CREDIT);
    });

    it('should create an expense account with debit normal balance', async () => {
      const expenseRow = { ...mockAccountRow, type: 'EXPENSE', normal_balance: 'DEBIT' };
      mockQuery.mockResolvedValueOnce({ rows: [expenseRow] } as never);

      const result = await accountService.createAccount({
        code: 'RENT',
        name: 'Rent Expense',
        type: AccountType.EXPENSE,
        currencyCode: 'USD',
      }, 'user-1');

      expect(result.type).toBe(AccountType.EXPENSE);
      expect(result.normalBalance).toBe(EntryType.DEBIT);
    });
  });

  describe('getAccount', () => {
    it('should return an account by id', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);

      const result = await accountService.getAccount('acc-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('acc-1');
      expect(result?.code).toBe('CASH');
    });

    it('should return null for non-existent account', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await accountService.getAccount('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAccountByCode', () => {
    it('should return an account by code', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);

      const result = await accountService.getAccountByCode('CASH');

      expect(result).not.toBeNull();
      expect(result?.code).toBe('CASH');
    });

    it('should return null for non-existent code', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      const result = await accountService.getAccountByCode('NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('getAllAccounts', () => {
    it('should return paginated accounts', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow, { ...mockAccountRow, id: 'acc-2', code: 'BANK' }] } as never);

      const result = await accountService.getAllAccounts({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should use default pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);

      const result = await accountService.getAllAccounts();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
  });

  describe('getAccountsByType', () => {
    it('should return accounts by type', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);

      const result = await accountService.getAccountsByType(AccountType.ASSET);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(AccountType.ASSET);
    });
  });

  describe('getChildAccounts', () => {
    it('should return child accounts', async () => {
      const childRow = { ...mockAccountRow, id: 'acc-2', code: 'PETTY_CASH', parent_id: 'acc-1' };
      mockQuery.mockResolvedValueOnce({ rows: [childRow] } as never);

      const result = await accountService.getChildAccounts('acc-1');

      expect(result).toHaveLength(1);
      expect(result[0].parentId).toBe('acc-1');
    });
  });

  describe('updateAccount', () => {
    it('should update account fields', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      const updatedRow = { ...mockAccountRow, name: 'Updated Cash Account' };
      mockQuery.mockResolvedValueOnce({ rows: [updatedRow] } as never);

      const result = await accountService.updateAccount('acc-1', { name: 'Updated Cash Account' }, 'user-1');

      expect(result.name).toBe('Updated Cash Account');
    });

    it('should throw error for non-existent account', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(accountService.updateAccount('non-existent', { name: 'Test' }, 'user-1'))
        .rejects.toThrow('Account not found');
    });

    it('should return unchanged account if no updates provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);

      const result = await accountService.updateAccount('acc-1', {}, 'user-1');

      expect(result.id).toBe('acc-1');
    });
  });

  describe('getAccountBalance', () => {
    it('should calculate balance for debit-normal account', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '1000', total_credits: '300' }] } as never);

      const result = await accountService.getAccountBalance('acc-1');

      expect(result.toString()).toBe('700');
    });

    it('should calculate balance for credit-normal account', async () => {
      const liabilityRow = { ...mockAccountRow, type: 'LIABILITY', normal_balance: 'CREDIT' };
      mockQuery.mockResolvedValueOnce({ rows: [liabilityRow] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '300', total_credits: '1000' }] } as never);

      const result = await accountService.getAccountBalance('acc-1');

      expect(result.toString()).toBe('700');
    });

    it('should throw error for non-existent account', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(accountService.getAccountBalance('non-existent')).rejects.toThrow('Account not found');
    });

    it('should calculate balance as of a specific date', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '500', total_credits: '200' }] } as never);

      const result = await accountService.getAccountBalance('acc-1', new Date('2024-01-15'));

      expect(result.toString()).toBe('300');
    });
  });

  describe('getAccountBalanceInBaseCurrency', () => {
    it('should calculate balance in base currency', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '1000', total_credits: '300' }] } as never);

      const result = await accountService.getAccountBalanceInBaseCurrency('acc-1');

      expect(result.toString()).toBe('700');
    });

    it('should throw error for non-existent account', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] } as never);

      await expect(accountService.getAccountBalanceInBaseCurrency('non-existent')).rejects.toThrow('Account not found');
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account with zero balance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '100', total_credits: '100' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      const deactivatedRow = { ...mockAccountRow, is_active: false };
      mockQuery.mockResolvedValueOnce({ rows: [deactivatedRow] } as never);

      const result = await accountService.deactivateAccount('acc-1', 'user-1');

      expect(result.isActive).toBe(false);
    });

    it('should throw error for account with non-zero balance', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAccountRow] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [{ total_debits: '1000', total_credits: '300' }] } as never);

      await expect(accountService.deactivateAccount('acc-1', 'user-1'))
        .rejects.toThrow('Cannot deactivate account with non-zero balance');
    });
  });
});
