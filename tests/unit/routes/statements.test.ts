import request from 'supertest';
import express from 'express';
import statementsRouter from '../../../src/routes/statements';
import Decimal from 'decimal.js';

jest.mock('../../../src/services/StatementService', () => ({
  statementService: {
    generateStatement: jest.fn(),
    getAccountSummary: jest.fn(),
  },
}));

const { statementService } = require('../../../src/services/StatementService');

const app = express();
app.use(express.json());
app.use('/statements', statementsRouter);

describe('Statements Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /statements/generate', () => {
    it('should generate CSV statement', async () => {
      statementService.generateStatement.mockResolvedValue({
        data: Buffer.from('test,data'),
        mimeType: 'text/csv',
        filename: 'statement.csv',
      });

      const response = await request(app)
        .post('/statements/generate')
        .send({
          accountId: 'acc-1',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          format: 'CSV',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/csv');
    });

    it('should generate PDF statement', async () => {
      statementService.generateStatement.mockResolvedValue({
        data: Buffer.from('pdf content'),
        mimeType: 'application/pdf',
        filename: 'statement.pdf',
      });

      const response = await request(app)
        .post('/statements/generate')
        .send({
          accountId: 'acc-1',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          format: 'PDF',
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/statements/generate')
        .send({ accountId: 'acc-1' });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid format', async () => {
      const response = await request(app)
        .post('/statements/generate')
        .send({
          accountId: 'acc-1',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          format: 'INVALID',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /statements/summary/:accountId', () => {
    it('should return account summary', async () => {
      statementService.getAccountSummary.mockResolvedValue({
        openingBalance: new Decimal(1000),
        closingBalance: new Decimal(1500),
        totalDebits: new Decimal(800),
        totalCredits: new Decimal(300),
        netChange: new Decimal(500),
        transactionCount: 10,
      });

      const response = await request(app)
        .get('/statements/summary/acc-1')
        .query({ startDate: '2024-01-01', endDate: '2024-12-31' });

      expect(response.status).toBe(200);
      expect(response.body.openingBalance).toBe('1000');
      expect(response.body.closingBalance).toBe('1500');
    });

    it('should return 400 for missing date params', async () => {
      const response = await request(app).get('/statements/summary/acc-1');

      expect(response.status).toBe(400);
    });
  });
});
