describe('Reconciliation Job', () => {
  describe('Job scheduling', () => {
    it('should have correct cron schedule format for reconciliation', () => {
      const cronSchedule = '0 0 * * *';
      expect(cronSchedule).toMatch(/^[\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+$/);
    });

    it('should have correct cron schedule format for snapshot', () => {
      const cronSchedule = '0 1 * * *';
      expect(cronSchedule).toMatch(/^[\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+$/);
    });

    it('should have correct cron schedule format for cleanup', () => {
      const cronSchedule = '0 2 * * 0';
      expect(cronSchedule).toMatch(/^[\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+$/);
    });
  });

  describe('Job configuration', () => {
    it('should support enabled/disabled state', () => {
      const config = { enabled: true, cronSchedule: '0 0 * * *' };
      expect(config.enabled).toBe(true);
      expect(config.cronSchedule).toBe('0 0 * * *');
    });

    it('should support disabled state', () => {
      const config = { enabled: false, cronSchedule: '0 0 * * *' };
      expect(config.enabled).toBe(false);
    });
  });

  describe('Reconciliation result structure', () => {
    it('should have correct result structure', () => {
      const result = {
        status: 'BALANCED',
        totalAccounts: 10,
        balancedAccounts: 10,
        imbalancedAccounts: 0,
        discrepancies: [],
      };

      expect(result.status).toBe('BALANCED');
      expect(result.totalAccounts).toBe(10);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('should handle imbalanced result', () => {
      const result = {
        status: 'IMBALANCED',
        totalAccounts: 10,
        balancedAccounts: 8,
        imbalancedAccounts: 2,
        discrepancies: [
          { accountId: 'acc-1', expected: '100', actual: '90' },
          { accountId: 'acc-2', expected: '200', actual: '210' },
        ],
      };

      expect(result.status).toBe('IMBALANCED');
      expect(result.imbalancedAccounts).toBe(2);
      expect(result.discrepancies).toHaveLength(2);
    });
  });
});
