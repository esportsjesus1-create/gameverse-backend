import request from 'supertest';
import { createApp } from '../../src/app';

jest.mock('../../src/services/AccountService', () => ({
  accountService: {
    getAllAccounts: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 }),
  },
}));

jest.mock('../../src/services/TransactionService', () => ({
  transactionService: {
    getAllTransactions: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 }),
  },
}));

jest.mock('../../src/services/CurrencyService', () => ({
  currencyService: {
    getAllCurrencies: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/AuditService', () => ({
  auditService: {
    getRecentLogs: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 }),
  },
}));

jest.mock('../../src/services/ReconciliationService', () => ({
  reconciliationService: {
    getLatestReconciliation: jest.fn().mockResolvedValue(null),
  },
}));

describe('Express App', () => {
  const app = createApp();

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('API Routes', () => {
    it('should have accounts route', async () => {
      const response = await request(app).get('/api/v1/accounts');
      expect(response.status).toBe(200);
    });

    it('should have transactions route', async () => {
      const response = await request(app).get('/api/v1/transactions');
      expect(response.status).toBe(200);
    });

    it('should have currencies route', async () => {
      const response = await request(app).get('/api/v1/currencies');
      expect(response.status).toBe(200);
    });

    it('should have audit route', async () => {
      const response = await request(app).get('/api/v1/audit');
      expect(response.status).toBe(200);
    });

    it('should have reconciliation route', async () => {
      const response = await request(app).get('/api/v1/reconciliation/latest');
      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not found');
    });
  });
});
