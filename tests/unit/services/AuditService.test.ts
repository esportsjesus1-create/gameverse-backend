import { AuditService } from '../../../src/services/AuditService';
import * as pool from '../../../src/db/pool';
import { config } from '../../../src/config';

jest.mock('../../../src/db/pool');
jest.mock('../../../src/config', () => ({
  config: {
    audit: {
      enabled: true,
      retentionDays: 730,
    },
  },
}));

const mockQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('AuditService', () => {
  let auditService: AuditService;

  const mockAuditLogRow = {
    id: 'audit-1',
    entity_type: 'account',
    entity_id: 'acc-1',
    action: 'CREATE',
    old_value: null,
    new_value: { code: 'CASH' },
    user_id: 'user-1',
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    created_at: new Date(),
  };

  beforeEach(() => {
    auditService = new AuditService();
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create an audit log entry', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockAuditLogRow] } as never);

      const result = await auditService.log({
        entityType: 'account',
        entityId: 'acc-1',
        action: 'CREATE',
        oldValue: null,
        newValue: { code: 'CASH' },
        userId: 'user-1',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result.entityType).toBe('account');
      expect(result.action).toBe('CREATE');
    });

    it('should return mock log when audit is disabled', async () => {
      const originalEnabled = (config.audit as { enabled: boolean }).enabled;
      (config.audit as { enabled: boolean }).enabled = false;

      const result = await auditService.log({
        entityType: 'account',
        entityId: 'acc-1',
        action: 'CREATE',
        oldValue: null,
        newValue: { code: 'CASH' },
        userId: 'user-1',
      });

      expect(result.id).toBe('');
      expect(result.entityType).toBe('account');
      
      (config.audit as { enabled: boolean }).enabled = originalEnabled;
    });
  });

  describe('getLogsForEntity', () => {
    it('should return logs for a specific entity', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAuditLogRow] } as never);

      const result = await auditService.getLogsForEntity('account', 'acc-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe('acc-1');
    });

    it('should use default pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAuditLogRow] } as never);

      const result = await auditService.getLogsForEntity('account', 'acc-1');

      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
  });

  describe('getLogsByUser', () => {
    it('should return logs for a specific user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAuditLogRow] } as never);

      const result = await auditService.getLogsByUser('user-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe('user-1');
    });
  });

  describe('getRecentLogs', () => {
    it('should return recent logs', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] } as never);
      mockQuery.mockResolvedValueOnce({ rows: [mockAuditLogRow] } as never);

      const result = await auditService.getRecentLogs();

      expect(result.data).toHaveLength(1);
    });
  });

  describe('cleanupOldLogs', () => {
    it('should delete old logs', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 10 } as never);

      const result = await auditService.cleanupOldLogs();

      expect(result).toBe(10);
    });

    it('should return 0 if no logs deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: null } as never);

      const result = await auditService.cleanupOldLogs();

      expect(result).toBe(0);
    });
  });
});
