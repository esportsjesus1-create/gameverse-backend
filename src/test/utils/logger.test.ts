describe('Logger', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should create logger with correct configuration', async () => {
    process.env.NODE_ENV = 'test';
    const { logger } = await import('../../utils/logger');

    expect(logger).toBeDefined();
    expect(logger.info).toBeDefined();
    expect(logger.error).toBeDefined();
    expect(logger.warn).toBeDefined();
    expect(logger.debug).toBeDefined();
  });

  it('should create child logger', async () => {
    process.env.NODE_ENV = 'test';
    const { createChildLogger } = await import('../../utils/logger');

    const childLogger = createChildLogger({ requestId: '123' });

    expect(childLogger).toBeDefined();
    expect(childLogger.info).toBeDefined();
  });

  it('should log messages', async () => {
    process.env.NODE_ENV = 'test';
    const { logger } = await import('../../utils/logger');

    expect(() => logger.info('Test message')).not.toThrow();
    expect(() => logger.error('Error message')).not.toThrow();
    expect(() => logger.warn('Warning message')).not.toThrow();
    expect(() => logger.debug('Debug message')).not.toThrow();
  });

  it('should log with metadata', async () => {
    process.env.NODE_ENV = 'test';
    const { logger } = await import('../../utils/logger');

    expect(() => logger.info('Test message', { userId: '123' })).not.toThrow();
  });
});
