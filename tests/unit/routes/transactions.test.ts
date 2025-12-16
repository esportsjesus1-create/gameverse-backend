import request from 'supertest';
import express from 'express';
import transactionsRouter from '../../../src/routes/transactions';
import { TransactionStatus, EntryType } from '../../../src/types';

jest.mock('../../../src/services/TransactionService', () => ({
  transactionService: {
    createTransaction: jest.fn(),
    getTransaction: jest.fn(),
    getTransactionByIdempotencyKey: jest.fn(),
    getTransactionEntries: jest.fn(),
    getAllTransactions: jest.fn(),
    getTransactionsByAccount: jest.fn(),
    postTransaction: jest.fn(),
    voidTransaction: jest.fn(),
  },
}));

const { transactionService } = require('../../../src/services/TransactionService');

const app = express();
app.use(express.json());
app.use('/transactions', transactionsRouter);

describe('Transactions Routes', () => {
  const mockTransaction = {
    id: 'tx-1',
    idempotencyKey: 'idem-1',
    reference: 'REF001',
    description: 'Test transaction',
    status: TransactionStatus.PENDING,
    transactionDate: new Date(),
    postedAt: null,
    voidedAt: null,
    voidReason: null,
    metadata: {},
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /transactions', () => {
    it('should create a transaction', async () => {
      transactionService.createTransaction.mockResolvedValue(mockTransaction);

      const response = await request(app)
        .post('/transactions')
        .send({
          idempotencyKey: 'idem-1',
          reference: 'REF001',
          description: 'Test',
          transactionDate: new Date().toISOString(),
          entries: [
            { accountId: 'acc-1', entryType: EntryType.DEBIT, amount: 100, currencyCode: 'USD' },
            { accountId: 'acc-2', entryType: EntryType.CREDIT, amount: 100, currencyCode: 'USD' },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.idempotencyKey).toBe('idem-1');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({ reference: 'REF001' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });

    it('should return 400 for empty entries', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotencyKey: 'idem-1',
          reference: 'REF001',
          description: 'Test',
          transactionDate: new Date().toISOString(),
          entries: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('non-empty array');
    });

    it('should return 400 for invalid entry', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotencyKey: 'idem-1',
          reference: 'REF001',
          description: 'Test',
          transactionDate: new Date().toISOString(),
          entries: [{ accountId: 'acc-1' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Each entry must have');
    });

    it('should return 400 for invalid entry type', async () => {
      const response = await request(app)
        .post('/transactions')
        .send({
          idempotencyKey: 'idem-1',
          reference: 'REF001',
          description: 'Test',
          transactionDate: new Date().toISOString(),
          entries: [{ accountId: 'acc-1', entryType: 'INVALID', amount: 100, currencyCode: 'USD' }],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid entry type');
    });
  });

  describe('GET /transactions', () => {
    it('should return all transactions', async () => {
      transactionService.getAllTransactions.mockResolvedValue({
        data: [mockTransaction],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/transactions');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /transactions/:id', () => {
    it('should return a transaction by id', async () => {
      transactionService.getTransaction.mockResolvedValue(mockTransaction);

      const response = await request(app).get('/transactions/tx-1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('tx-1');
    });

    it('should return 404 for non-existent transaction', async () => {
      transactionService.getTransaction.mockResolvedValue(null);

      const response = await request(app).get('/transactions/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /transactions/:id/entries', () => {
    it('should return transaction entries', async () => {
      transactionService.getTransactionEntries.mockResolvedValue([]);

      const response = await request(app).get('/transactions/tx-1/entries');

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('GET /transactions/idempotency/:key', () => {
    it('should return a transaction by idempotency key', async () => {
      transactionService.getTransactionByIdempotencyKey.mockResolvedValue(mockTransaction);

      const response = await request(app).get('/transactions/idempotency/idem-1');

      expect(response.status).toBe(200);
      expect(response.body.idempotencyKey).toBe('idem-1');
    });

    it('should return 404 for non-existent key', async () => {
      transactionService.getTransactionByIdempotencyKey.mockResolvedValue(null);

      const response = await request(app).get('/transactions/idempotency/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /transactions/account/:accountId', () => {
    it('should return transactions for an account', async () => {
      transactionService.getTransactionsByAccount.mockResolvedValue({
        data: [mockTransaction],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/transactions/account/acc-1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('POST /transactions/:id/post', () => {
    it('should post a transaction', async () => {
      const postedTransaction = { ...mockTransaction, status: TransactionStatus.POSTED };
      transactionService.postTransaction.mockResolvedValue(postedTransaction);

      const response = await request(app).post('/transactions/tx-1/post');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(TransactionStatus.POSTED);
    });
  });

  describe('POST /transactions/:id/void', () => {
    it('should void a transaction', async () => {
      const voidedTransaction = { ...mockTransaction, status: TransactionStatus.VOIDED, voidReason: 'Test reason' };
      transactionService.voidTransaction.mockResolvedValue(voidedTransaction);

      const response = await request(app)
        .post('/transactions/tx-1/void')
        .send({ reason: 'Test reason' });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(TransactionStatus.VOIDED);
    });

    it('should return 400 for missing reason', async () => {
      const response = await request(app)
        .post('/transactions/tx-1/void')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('reason is required');
    });
  });
});
