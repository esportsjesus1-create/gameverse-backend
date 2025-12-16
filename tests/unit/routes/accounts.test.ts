import request from 'supertest';
import express from 'express';
import accountsRouter from '../../../src/routes/accounts';
import { AccountType } from '../../../src/types';
import Decimal from 'decimal.js';

jest.mock('../../../src/services/AccountService', () => ({
  accountService: {
    createAccount: jest.fn(),
    getAccount: jest.fn(),
    getAccountByCode: jest.fn(),
    getAllAccounts: jest.fn(),
    getAccountsByType: jest.fn(),
    getChildAccounts: jest.fn(),
    updateAccount: jest.fn(),
    getAccountBalance: jest.fn(),
    getAccountBalanceInBaseCurrency: jest.fn(),
    deactivateAccount: jest.fn(),
  },
}));

const { accountService } = require('../../../src/services/AccountService');

const app = express();
app.use(express.json());
app.use('/accounts', accountsRouter);

describe('Accounts Routes', () => {
  const mockAccount = {
    id: 'acc-1',
    code: 'CASH',
    name: 'Cash Account',
    type: AccountType.ASSET,
    currencyCode: 'USD',
    parentId: null,
    description: 'Main cash account',
    isActive: true,
    normalBalance: 'DEBIT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /accounts', () => {
    it('should create an account', async () => {
      accountService.createAccount.mockResolvedValue(mockAccount);

      const response = await request(app)
        .post('/accounts')
        .send({
          code: 'CASH',
          name: 'Cash Account',
          type: AccountType.ASSET,
          currencyCode: 'USD',
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toBe('CASH');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/accounts')
        .send({ code: 'CASH' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid account type', async () => {
      const response = await request(app)
        .post('/accounts')
        .send({
          code: 'CASH',
          name: 'Cash',
          type: 'INVALID',
          currencyCode: 'USD',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid account type');
    });
  });

  describe('GET /accounts', () => {
    it('should return all accounts', async () => {
      accountService.getAllAccounts.mockResolvedValue({
        data: [mockAccount],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/accounts');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should filter by type', async () => {
      accountService.getAccountsByType.mockResolvedValue([mockAccount]);

      const response = await request(app).get('/accounts?type=ASSET');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /accounts/:id', () => {
    it('should return an account by id', async () => {
      accountService.getAccount.mockResolvedValue(mockAccount);

      const response = await request(app).get('/accounts/acc-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('acc-1');
    });

    it('should return 404 for non-existent account', async () => {
      accountService.getAccount.mockResolvedValue(null);

      const response = await request(app).get('/accounts/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /accounts/code/:code', () => {
    it('should return an account by code', async () => {
      accountService.getAccountByCode.mockResolvedValue(mockAccount);

      const response = await request(app).get('/accounts/code/CASH');

      expect(response.status).toBe(200);
      expect(response.body.code).toBe('CASH');
    });

    it('should return 404 for non-existent code', async () => {
      accountService.getAccountByCode.mockResolvedValue(null);

      const response = await request(app).get('/accounts/code/NONEXISTENT');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /accounts/:id/balance', () => {
    it('should return account balance', async () => {
      accountService.getAccountBalance.mockResolvedValue(new Decimal(1000));

      const response = await request(app).get('/accounts/acc-1/balance');

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe('1000');
    });

    it('should return balance in base currency', async () => {
      accountService.getAccountBalanceInBaseCurrency.mockResolvedValue(new Decimal(1000));

      const response = await request(app).get('/accounts/acc-1/balance?baseCurrency=true');

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe('1000');
    });
  });

  describe('GET /accounts/:id/children', () => {
    it('should return child accounts', async () => {
      accountService.getChildAccounts.mockResolvedValue([mockAccount]);

      const response = await request(app).get('/accounts/acc-1/children');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('PATCH /accounts/:id', () => {
    it('should update an account', async () => {
      const updatedAccount = { ...mockAccount, name: 'Updated Name' };
      accountService.updateAccount.mockResolvedValue(updatedAccount);

      const response = await request(app)
        .patch('/accounts/acc-1')
        .send({ name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });
  });

  describe('POST /accounts/:id/deactivate', () => {
    it('should deactivate an account', async () => {
      const deactivatedAccount = { ...mockAccount, isActive: false };
      accountService.deactivateAccount.mockResolvedValue(deactivatedAccount);

      const response = await request(app).post('/accounts/acc-1/deactivate');

      expect(response.status).toBe(200);
      expect(response.body.isActive).toBe(false);
    });
  });
});
