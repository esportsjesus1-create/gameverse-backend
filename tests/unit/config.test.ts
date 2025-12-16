import { config, getConnectionString } from '../../src/config';

describe('Config', () => {
  describe('config object', () => {
    it('should have default values', () => {
      expect(config.env).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.database).toBeDefined();
      expect(config.ledger).toBeDefined();
      expect(config.reconciliation).toBeDefined();
      expect(config.audit).toBeDefined();
    });

    it('should have database configuration', () => {
      expect(config.database.host).toBeDefined();
      expect(config.database.port).toBeDefined();
      expect(config.database.name).toBeDefined();
      expect(config.database.user).toBeDefined();
      expect(config.database.password).toBeDefined();
      expect(config.database.poolMin).toBeDefined();
      expect(config.database.poolMax).toBeDefined();
    });

    it('should have ledger configuration', () => {
      expect(config.ledger.baseCurrency).toBeDefined();
      expect(config.ledger.maxEntriesPerTransaction).toBeGreaterThan(0);
      expect(config.ledger.snapshotRetentionDays).toBeGreaterThan(0);
    });

    it('should have reconciliation configuration', () => {
      expect(config.reconciliation.cronSchedule).toBeDefined();
      expect(typeof config.reconciliation.enabled).toBe('boolean');
    });

    it('should have audit configuration', () => {
      expect(typeof config.audit.enabled).toBe('boolean');
      expect(config.audit.retentionDays).toBeGreaterThan(0);
    });
  });

  describe('getConnectionString', () => {
    it('should return a valid connection string', () => {
      const connectionString = getConnectionString();
      expect(connectionString).toMatch(/^postgresql:\/\/.+:.+@.+:\d+\/.+$/);
    });

    it('should include database credentials', () => {
      const connectionString = getConnectionString();
      expect(connectionString).toContain(config.database.host);
      expect(connectionString).toContain(config.database.port.toString());
      expect(connectionString).toContain(config.database.name);
    });
  });
});
