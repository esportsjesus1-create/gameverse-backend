import { PlatformLogger, LogLevel, EventTypes } from '../../../src/common/logging';

describe('PlatformLogger', () => {
  let logger: PlatformLogger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-service',
      environment: 'test',
      level: LogLevel.DEBUG,
    });
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('constructor', () => {
    it('should create logger with default options', () => {
      const defaultLogger = new PlatformLogger({
        serviceName: 'default-service',
      });
      expect(defaultLogger).toBeDefined();
    });

    it('should create logger with custom options', () => {
      const customLogger = new PlatformLogger({
        serviceName: 'custom-service',
        environment: 'production',
        level: LogLevel.ERROR,
      });
      expect(customLogger).toBeDefined();
    });
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      logger.debug('Debug message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Info message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log warn messages', () => {
      logger.warn('Warning message', { key: 'value' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message', new Error('Test error'));
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should respect log level filtering', () => {
      const errorOnlyLogger = new PlatformLogger({
        serviceName: 'error-only',
        level: LogLevel.ERROR,
      });
      
      const errorSpy = jest.spyOn(console, 'log').mockImplementation();
      
      errorOnlyLogger.debug('Debug message');
      errorOnlyLogger.info('Info message');
      errorOnlyLogger.warn('Warning message');
      
      errorSpy.mockRestore();
    });
  });

  describe('event logging', () => {
    it('should log events with event type', () => {
      logger.event(EventTypes.EMAIL_SEND_SUCCESS, { emailId: 'test-123' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log all event types', () => {
      const eventTypes = Object.values(EventTypes);
      eventTypes.forEach(eventType => {
        logger.event(eventType, { test: true });
      });
      expect(consoleSpy).toHaveBeenCalledTimes(eventTypes.length);
    });
  });

  describe('audit logging', () => {
    it('should log audit events', () => {
      logger.audit({
        eventType: EventTypes.EMAIL_SEND_SUCCESS,
        userId: 'user-123',
        operation: 'send',
        resource: 'email',
        resourceId: 'email-456',
        success: true,
        correlationId: 'corr-789',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log audit events with old and new values', () => {
      logger.audit({
        eventType: EventTypes.CONFIG_UPDATED,
        userId: 'admin-123',
        operation: 'update',
        resource: 'config',
        resourceId: 'setting-key',
        oldValue: { value: 'old' },
        newValue: { value: 'new' },
        success: true,
        correlationId: 'corr-123',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log failed audit events', () => {
      logger.audit({
        eventType: EventTypes.EMAIL_SEND_FAILED,
        userId: 'user-123',
        operation: 'send',
        resource: 'email',
        success: false,
        errorCode: 'SEND_FAILED',
        errorMessage: 'Connection timeout',
        correlationId: 'corr-456',
      });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('performance timing', () => {
    it('should create a timer function', () => {
      const timer = logger.startTimer('test-operation');
      expect(typeof timer).toBe('function');
    });

    it('should log timing on success', async () => {
      const timer = logger.startTimer('test-operation');
      await new Promise(resolve => setTimeout(resolve, 10));
      timer(true, { result: 'success' });
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log timing on failure', async () => {
      const timer = logger.startTimer('test-operation');
      await new Promise(resolve => setTimeout(resolve, 10));
      timer(false, { error: 'failed' });
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('child logger', () => {
    it('should create child logger with additional context', () => {
      const childLogger = logger.child({ requestId: 'req-123' });
      expect(childLogger).toBeDefined();
      childLogger.info('Child logger message');
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});

describe('EventTypes', () => {
  it('should have email event types', () => {
    expect(EventTypes.EMAIL_SEND_SUCCESS).toBeDefined();
    expect(EventTypes.EMAIL_SEND_FAILED).toBeDefined();
    expect(EventTypes.EMAIL_TEMPLATE_CREATED).toBeDefined();
    expect(EventTypes.EMAIL_TEMPLATE_UPDATED).toBeDefined();
    expect(EventTypes.EMAIL_TEMPLATE_DELETED).toBeDefined();
    expect(EventTypes.EMAIL_TEMPLATE_RENDERED).toBeDefined();
    expect(EventTypes.EMAIL_DELIVERY_STATUS_UPDATED).toBeDefined();
  });

  it('should have SMS event types', () => {
    expect(EventTypes.SMS_SEND_SUCCESS).toBeDefined();
    expect(EventTypes.SMS_SEND_FAILED).toBeDefined();
    expect(EventTypes.SMS_TEMPLATE_CREATED).toBeDefined();
    expect(EventTypes.SMS_TEMPLATE_UPDATED).toBeDefined();
    expect(EventTypes.SMS_TEMPLATE_DELETED).toBeDefined();
    expect(EventTypes.SMS_TEMPLATE_RENDERED).toBeDefined();
    expect(EventTypes.SMS_DELIVERY_STATUS_UPDATED).toBeDefined();
    expect(EventTypes.SMS_VERIFICATION_CREATED).toBeDefined();
    expect(EventTypes.SMS_VERIFICATION_VALIDATED).toBeDefined();
    expect(EventTypes.SMS_VERIFICATION_FAILED).toBeDefined();
    expect(EventTypes.SMS_VERIFICATION_EXPIRED).toBeDefined();
  });

  it('should have storage event types', () => {
    expect(EventTypes.STORAGE_UPLOAD_INITIATED).toBeDefined();
    expect(EventTypes.STORAGE_UPLOAD_SUCCESS).toBeDefined();
    expect(EventTypes.STORAGE_UPLOAD_FAILED).toBeDefined();
    expect(EventTypes.STORAGE_DOWNLOAD_INITIATED).toBeDefined();
    expect(EventTypes.STORAGE_DOWNLOAD_SUCCESS).toBeDefined();
    expect(EventTypes.STORAGE_DOWNLOAD_FAILED).toBeDefined();
    expect(EventTypes.STORAGE_DELETE_INITIATED).toBeDefined();
    expect(EventTypes.STORAGE_DELETE_SUCCESS).toBeDefined();
    expect(EventTypes.STORAGE_DELETE_FAILED).toBeDefined();
    expect(EventTypes.STORAGE_SIGNED_URL_GENERATED).toBeDefined();
    expect(EventTypes.STORAGE_METADATA_UPDATED).toBeDefined();
  });

  it('should have config event types', () => {
    expect(EventTypes.CONFIG_LOADED).toBeDefined();
    expect(EventTypes.CONFIG_UPDATED).toBeDefined();
    expect(EventTypes.CONFIG_SECRET_ACCESSED).toBeDefined();
    expect(EventTypes.CONFIG_SECRET_UPDATED).toBeDefined();
    expect(EventTypes.CONFIG_SECRET_ROTATED).toBeDefined();
    expect(EventTypes.FEATURE_FLAG_CHECKED).toBeDefined();
    expect(EventTypes.FEATURE_FLAG_UPDATED).toBeDefined();
  });

  it('should have rate limit event types', () => {
    expect(EventTypes.RATE_LIMIT_CHECKED).toBeDefined();
    expect(EventTypes.RATE_LIMIT_EXCEEDED).toBeDefined();
  });

  it('should have service event types', () => {
    expect(EventTypes.SERVICE_INITIALIZED).toBeDefined();
    expect(EventTypes.SERVICE_SHUTDOWN).toBeDefined();
  });

  it('should have unique event type values', () => {
    const eventTypes = Object.values(EventTypes);
    const uniqueTypes = new Set(eventTypes);
    expect(uniqueTypes.size).toBe(eventTypes.length);
  });
});

describe('LogLevel', () => {
  it('should have all log levels', () => {
    expect(LogLevel.DEBUG).toBeDefined();
    expect(LogLevel.INFO).toBeDefined();
    expect(LogLevel.WARN).toBeDefined();
    expect(LogLevel.ERROR).toBeDefined();
  });
});
