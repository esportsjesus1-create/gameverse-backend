import request from 'supertest';
import express from 'express';
import reconciliationRouter from '../../../src/routes/reconciliation';
import { ReconciliationStatus } from '../../../src/types';
import Decimal from 'decimal.js';

jest.mock('../../../src/services/ReconciliationService', () => ({
  reconciliationService: {
    runReconciliation: jest.fn(),
    getLatestReconciliation: jest.fn(),
    getReconciliationHistory: jest.fn(),
    getReconciliation: jest.fn(),
    verifyTransactionBalance: jest.fn(),
  },
}));

const { reconciliationService } = require('../../../src/services/ReconciliationService');

const app = express();
app.use(express.json());
app.use('/reconciliation', reconciliationRouter);

describe('Reconciliation Routes', () => {
  const mockReconciliation = {
    id: 'recon-1',
    runDate: new Date(),
    status: ReconciliationStatus.BALANCED,
    totalAccounts: 10,
    balancedAccounts: 10,
    imbalancedAccounts: 0,
    discrepancies: [],
    completedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reconciliation/run', () => {
    it('should run reconciliation', async () => {
      reconciliationService.runReconciliation.mockResolvedValue(mockReconciliation);

      const response = await request(app).post('/reconciliation/run');

      expect(response.status).toBe(201);
      expect(response.body.status).toBe(ReconciliationStatus.BALANCED);
    });
  });

  describe('GET /reconciliation/latest', () => {
    it('should return latest reconciliation', async () => {
      reconciliationService.getLatestReconciliation.mockResolvedValue(mockReconciliation);

      const response = await request(app).get('/reconciliation/latest');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(ReconciliationStatus.BALANCED);
    });

    it('should return 404 if no reconciliations exist', async () => {
      reconciliationService.getLatestReconciliation.mockResolvedValue(null);

      const response = await request(app).get('/reconciliation/latest');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /reconciliation/history', () => {
    it('should return reconciliation history', async () => {
      reconciliationService.getReconciliationHistory.mockResolvedValue([mockReconciliation]);

      const response = await request(app).get('/reconciliation/history');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /reconciliation/:id', () => {
    it('should return a reconciliation by id', async () => {
      reconciliationService.getReconciliation.mockResolvedValue(mockReconciliation);

      const response = await request(app).get('/reconciliation/recon-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('recon-1');
    });

    it('should return 404 for non-existent reconciliation', async () => {
      reconciliationService.getReconciliation.mockResolvedValue(null);

      const response = await request(app).get('/reconciliation/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /reconciliation/verify/:transactionId', () => {
    it('should verify transaction balance', async () => {
      reconciliationService.verifyTransactionBalance.mockResolvedValue(true);

      const response = await request(app).get('/reconciliation/verify/tx-1');

      expect(response.status).toBe(200);
      expect(response.body.isBalanced).toBe(true);
    });
  });
});
