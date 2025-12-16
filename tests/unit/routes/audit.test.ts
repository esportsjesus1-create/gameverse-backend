import request from 'supertest';
import express from 'express';
import auditRouter from '../../../src/routes/audit';

jest.mock('../../../src/services/AuditService', () => ({
  auditService: {
    getRecentLogs: jest.fn(),
    getLogsForEntity: jest.fn(),
    getLogsByUser: jest.fn(),
  },
}));

const { auditService } = require('../../../src/services/AuditService');

const app = express();
app.use(express.json());
app.use('/audit', auditRouter);

describe('Audit Routes', () => {
  const mockAuditLog = {
    id: 'audit-1',
    entityType: 'account',
    entityId: 'acc-1',
    action: 'CREATE',
    oldValue: null,
    newValue: { code: 'CASH' },
    userId: 'user-1',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /audit', () => {
    it('should return recent audit logs', async () => {
      auditService.getRecentLogs.mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/audit');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /audit/entity/:entityType/:entityId', () => {
    it('should return logs for an entity', async () => {
      auditService.getLogsForEntity.mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/audit/entity/account/acc-1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /audit/user/:userId', () => {
    it('should return logs for a user', async () => {
      auditService.getLogsByUser.mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      });

      const response = await request(app).get('/audit/user/user-1');

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });
});
