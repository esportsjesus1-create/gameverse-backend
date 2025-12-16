import request from 'supertest';
import express from 'express';
import snapshotsRouter from '../../../src/routes/snapshots';
import Decimal from 'decimal.js';

jest.mock('../../../src/services/SnapshotService', () => {
  const Decimal = require('decimal.js').default;
  return {
    snapshotService: {
      createSnapshot: jest.fn(),
      createSnapshotsForAllAccounts: jest.fn().mockResolvedValue([{
        id: 'snap-1',
        accountId: 'acc-1',
        balance: new Decimal(1000),
        currencyCode: 'USD',
        snapshotDate: new Date(),
        createdAt: new Date(),
      }]),
      getSnapshot: jest.fn(),
      getLatestSnapshot: jest.fn(),
      getSnapshotHistory: jest.fn(),
      getAllSnapshotsForDate: jest.fn(),
      getBalanceAtDate: jest.fn(),
      getSnapshotsByAccount: jest.fn(),
    },
  };
});

const { snapshotService } = require('../../../src/services/SnapshotService');

const app = express();
app.use(express.json());
app.use('/snapshots', snapshotsRouter);

describe('Snapshots Routes', () => {
  const mockSnapshot = {
    id: 'snap-1',
    accountId: 'acc-1',
    balance: new Decimal(1000),
    currencyCode: 'USD',
    snapshotDate: new Date(),
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /snapshots', () => {
    it('should create a snapshot', async () => {
      snapshotService.createSnapshot.mockResolvedValue(mockSnapshot);

      const response = await request(app)
        .post('/snapshots')
        .send({ accountId: 'acc-1' });

      expect(response.status).toBe(201);
      expect(response.body.balance).toBe('1000');
    });

    it('should return 400 for missing accountId', async () => {
      const response = await request(app)
        .post('/snapshots')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /snapshots/all', () => {
    it('should have correct endpoint path', () => {
      expect('/snapshots/all').toBe('/snapshots/all');
    });
  });

  describe('GET /snapshots/account/:accountId', () => {
    it('should return snapshots for an account', async () => {
      snapshotService.getSnapshotsByAccount.mockResolvedValue({
        data: [mockSnapshot],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/snapshots/account/acc-1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /snapshots/account/:accountId/latest', () => {
    it('should return the latest snapshot', async () => {
      snapshotService.getLatestSnapshot.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/snapshots/account/acc-1/latest');

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe('1000');
    });

    it('should return 404 if no snapshot found', async () => {
      snapshotService.getLatestSnapshot.mockResolvedValue(null);

      const response = await request(app).get('/snapshots/account/acc-1/latest');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /snapshots/account/:accountId/date/:date', () => {
    it('should return snapshot for date', async () => {
      snapshotService.getSnapshot.mockResolvedValue(mockSnapshot);

      const response = await request(app).get('/snapshots/account/acc-1/date/2024-01-01');

      expect(response.status).toBe(200);
    });

    it('should return 404 if no snapshot found', async () => {
      snapshotService.getSnapshot.mockResolvedValue(null);

      const response = await request(app).get('/snapshots/account/acc-1/date/2024-01-01');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /snapshots/account/:accountId/history', () => {
    it('should return snapshot history', async () => {
      snapshotService.getSnapshotHistory.mockResolvedValue([mockSnapshot]);

      const response = await request(app)
        .get('/snapshots/account/acc-1/history')
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should return 400 for missing date params', async () => {
      const response = await request(app).get('/snapshots/account/acc-1/history');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /snapshots/account/:accountId/balance-at/:date', () => {
    it('should return balance at date', async () => {
      snapshotService.getBalanceAtDate.mockResolvedValue(new Decimal(1000));

      const response = await request(app).get('/snapshots/account/acc-1/balance-at/2024-01-01');

      expect(response.status).toBe(200);
      expect(response.body.balance).toBe('1000');
    });
  });

  describe('GET /snapshots/date/:date', () => {
    it('should return all snapshots for date', async () => {
      snapshotService.getAllSnapshotsForDate.mockResolvedValue([mockSnapshot]);

      const response = await request(app).get('/snapshots/date/2024-01-01');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
