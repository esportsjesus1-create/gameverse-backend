import { SmsService } from '../../../src/sms/services/sms.service';
import { SmsTemplateService } from '../../../src/sms/services/template.service';
import { VerificationService } from '../../../src/sms/services/verification.service';
import { MockSmsProvider } from '../../../src/sms/providers/mock.provider';
import { PlatformLogger, LogLevel } from '../../../src/common/logging';
import { ThreeTierRateLimiter } from '../../../src/common/security/rate-limiter';
import { SmsServiceConfig } from '../../../src/sms/interfaces';
import { SmsInvalidPhoneError, ValidationError } from '../../../src/common/errors';

describe('SmsService', () => {
  let smsService: SmsService;
  let mockProvider: MockSmsProvider;
  let templateService: SmsTemplateService;
  let verificationService: VerificationService;
  let logger: PlatformLogger;
  let rateLimiter: ThreeTierRateLimiter;
  let config: SmsServiceConfig;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-sms-service',
      level: LogLevel.ERROR,
    });

    mockProvider = new MockSmsProvider(logger);
    templateService = new SmsTemplateService(logger);

    rateLimiter = new ThreeTierRateLimiter(
      {
        global: { maxRequests: 1000, windowMs: 60000 },
        service: { maxRequests: 100, windowMs: 60000 },
        user: { maxRequests: 10, windowMs: 60000 },
      },
      logger
    );

    verificationService = new VerificationService(mockProvider, logger, rateLimiter, {
      codeLength: 6,
      expiresInMinutes: 10,
      maxAttempts: 3,
    });

    config = {
      provider: { provider: 'mock' },
      defaultFrom: '+14155559999',
      maxMessageLength: 1600,
      rateLimitPerMinute: 60,
      verificationCodeLength: 6,
      verificationExpiresMinutes: 10,
      verificationMaxAttempts: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
    };

    smsService = new SmsService(
      mockProvider,
      templateService,
      verificationService,
      logger,
      rateLimiter,
      config
    );
  });

  afterEach(() => {
    mockProvider.clearSentMessages();
    rateLimiter.reset();
  });

  describe('send', () => {
    it('should send a simple SMS', async () => {
      const result = await smsService.send({
        to: '+14155551234',
        body: 'Test message',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
      expect(mockProvider.getSentMessageCount()).toBe(1);
    });

    it('should send SMS with all fields', async () => {
      const result = await smsService.send({
        to: '+14155551234',
        from: '+14155559999',
        body: 'Test message',
        priority: 'high',
        metadata: { campaign: 'test' },
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('should send SMS with template', async () => {
      await templateService.create({
        name: 'verification',
        content: 'Your code is {{code}}',
        category: 'verification',
      });

      const template = await templateService.getByName('verification');

      const result = await smsService.send({
        to: '+14155551234',
        templateId: template!.id,
        templateData: { code: '123456' },
      });

      expect(result.id).toBeDefined();
      const sentMessage = mockProvider.getSentMessageById(result.id);
      expect(sentMessage?.body).toContain('123456');
    });

    it('should use default from number', async () => {
      const result = await smsService.send({
        to: '+14155551234',
        body: 'Test',
      });

      const sentMessage = mockProvider.getSentMessageById(result.id);
      expect(sentMessage?.from).toBe('+14155559999');
    });

    it('should reject invalid phone numbers', async () => {
      await expect(
        smsService.send({
          to: '123',
          body: 'Test',
        })
      ).rejects.toThrow();
    });

    it('should reject messages exceeding max length', async () => {
      const longMessage = 'a'.repeat(1601);

      await expect(
        smsService.send({
          to: '+14155551234',
          body: longMessage,
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should enforce rate limits', async () => {
      for (let i = 0; i < 10; i++) {
        await smsService.send(
          {
            to: '+14155551234',
            body: 'Test',
          },
          'user-123'
        );
      }

      await expect(
        smsService.send(
          {
            to: '+14155551234',
            body: 'Test',
          },
          'user-123'
        )
      ).rejects.toThrow();
    });
  });

  describe('sendBatch', () => {
    it('should send multiple SMS messages', async () => {
      const requests = [
        { to: '+14155551111', body: 'Test 1' },
        { to: '+14155552222', body: 'Test 2' },
        { to: '+14155553333', body: 'Test 3' },
      ];

      const { results, errors } = await smsService.sendBatch(requests);

      expect(results.length).toBe(3);
      expect(errors.length).toBe(0);
      expect(mockProvider.getSentMessageCount()).toBe(3);
    });

    it('should handle partial failures', async () => {
      const requests = [
        { to: '+14155551111', body: 'Test 1' },
        { to: 'invalid', body: 'Test 2' },
        { to: '+14155553333', body: 'Test 3' },
      ];

      const { results, errors } = await smsService.sendBatch(requests);

      expect(results.length).toBe(2);
      expect(errors.length).toBe(1);
      expect(errors[0].index).toBe(1);
    });
  });

  describe('getDeliveryStatus', () => {
    it('should get delivery status for sent SMS', async () => {
      const sendResult = await smsService.send({
        to: '+14155551234',
        body: 'Test',
      });

      const events = await smsService.getDeliveryStatus(sendResult.id);
      expect(events).toBeDefined();
    });
  });

  describe('cancelMessage', () => {
    it('should cancel a message', async () => {
      const sendResult = await smsService.send({
        to: '+14155551234',
        body: 'Test',
      });

      const cancelled = await smsService.cancelMessage(sendResult.messageId);
      expect(typeof cancelled).toBe('boolean');
    });
  });

  describe('verification', () => {
    it('should create verification', async () => {
      const result = await smsService.createVerification('+14155551234');

      expect(result.verificationId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should create verification with options', async () => {
      const result = await smsService.createVerification('+14155551234', {
        channel: 'sms',
        codeLength: 6,
        expiresInMinutes: 5,
        locale: 'en',
      });

      expect(result.verificationId).toBeDefined();
    });

    it('should verify code', async () => {
      const createResult = await smsService.createVerification('+14155551234');
      
      const status = await smsService.getVerificationStatus('+14155551234');
      const code = status?.code?.replace(/\*/g, '') || '';
      
      const verifyResult = await smsService.verifyCode('+14155551234', code);
      expect(verifyResult).toBeDefined();
    });

    it('should cancel verification', async () => {
      await smsService.createVerification('+14155551234');
      const cancelled = await smsService.cancelVerification('+14155551234');
      expect(cancelled).toBe(true);
    });

    it('should get verification status', async () => {
      await smsService.createVerification('+14155551234');
      const status = await smsService.getVerificationStatus('+14155551234');
      expect(status).toBeDefined();
    });
  });

  describe('template management', () => {
    it('should create a template', async () => {
      const template = await smsService.createTemplate({
        name: 'test-template',
        content: 'Hello {{name}}',
        category: 'test',
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('test-template');
    });

    it('should update a template', async () => {
      const template = await smsService.createTemplate({
        name: 'test-template',
        content: 'Hello',
        category: 'test',
      });

      const updated = await smsService.updateTemplate(template.id, {
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should delete a template', async () => {
      const template = await smsService.createTemplate({
        name: 'test-template',
        content: 'Hello',
        category: 'test',
      });

      await smsService.deleteTemplate(template.id);

      const deleted = await smsService.getTemplate(template.id);
      expect(deleted).toBeNull();
    });

    it('should get template by name', async () => {
      await smsService.createTemplate({
        name: 'unique-template',
        content: 'Hello',
        category: 'test',
      });

      const template = await smsService.getTemplateByName('unique-template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('unique-template');
    });

    it('should list templates', async () => {
      await smsService.createTemplate({
        name: 'template-1',
        content: 'Hello 1',
        category: 'marketing',
      });

      await smsService.createTemplate({
        name: 'template-2',
        content: 'Hello 2',
        category: 'transactional',
      });

      const allTemplates = await smsService.listTemplates();
      expect(allTemplates.length).toBe(2);

      const marketingTemplates = await smsService.listTemplates({
        category: 'marketing',
      });
      expect(marketingTemplates.length).toBe(1);
    });
  });

  describe('delivery events', () => {
    it('should handle delivery event', () => {
      const event = {
        id: 'event-123',
        smsId: 'sms-123',
        messageId: 'msg-123',
        status: 'delivered' as const,
        timestamp: new Date(),
        to: '+14155551234',
      };

      smsService.handleDeliveryEvent(event);
    });
  });
});
