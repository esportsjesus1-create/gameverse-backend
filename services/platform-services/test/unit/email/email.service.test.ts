import { EmailService } from '../../../src/email/services/email.service';
import { EmailTemplateService } from '../../../src/email/services/template.service';
import { MockEmailProvider } from '../../../src/email/providers/mock.provider';
import { PlatformLogger, LogLevel } from '../../../src/common/logging';
import { ThreeTierRateLimiter } from '../../../src/common/security/rate-limiter';
import { EmailServiceConfig } from '../../../src/email/interfaces';
import {
  EmailRateLimitError,
  EmailInvalidRecipientError,
  EmailAttachmentError,
  ValidationError,
} from '../../../src/common/errors';

describe('EmailService', () => {
  let emailService: EmailService;
  let mockProvider: MockEmailProvider;
  let templateService: EmailTemplateService;
  let logger: PlatformLogger;
  let rateLimiter: ThreeTierRateLimiter;
  let config: EmailServiceConfig;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-email-service',
      level: LogLevel.ERROR,
    });

    mockProvider = new MockEmailProvider(logger);
    templateService = new EmailTemplateService(logger);

    rateLimiter = new ThreeTierRateLimiter(
      {
        global: { maxRequests: 1000, windowMs: 60000 },
        service: { maxRequests: 100, windowMs: 60000 },
        user: { maxRequests: 10, windowMs: 60000 },
      },
      logger
    );

    config = {
      provider: { provider: 'mock' },
      defaultFrom: 'noreply@example.com',
      maxRecipientsPerEmail: 50,
      maxAttachmentSize: 10 * 1024 * 1024,
      maxAttachments: 5,
      rateLimitPerMinute: 60,
      retryAttempts: 3,
      retryDelayMs: 1000,
      trackOpens: true,
      trackClicks: true,
    };

    emailService = new EmailService(
      mockProvider,
      templateService,
      logger,
      rateLimiter,
      config
    );
  });

  afterEach(() => {
    mockProvider.clearSentEmails();
    rateLimiter.reset();
  });

  describe('send', () => {
    it('should send a simple email', async () => {
      const result = await emailService.send({
        to: ['test@example.com'],
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
      expect(mockProvider.getSentEmailCount()).toBe(1);
    });

    it('should send email with all fields', async () => {
      const result = await emailService.send({
        to: ['test@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        from: 'sender@example.com',
        replyTo: 'reply@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
        text: 'Test content',
        priority: 'high',
        tags: ['test'],
        trackOpens: true,
        trackClicks: true,
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('should send email with template', async () => {
      await templateService.create({
        name: 'welcome',
        subject: 'Welcome {{name}}!',
        htmlContent: '<h1>Welcome {{name}}</h1>',
        category: 'onboarding',
      });

      const template = await templateService.getByName('welcome');

      const result = await emailService.send({
        to: ['test@example.com'],
        subject: 'Welcome',
        templateId: template!.id,
        templateData: { name: 'John' },
      });

      expect(result.id).toBeDefined();
      const sentEmail = mockProvider.getSentEmailById(result.id);
      expect(sentEmail?.html).toContain('Welcome John');
    });

    it('should use default from address', async () => {
      const result = await emailService.send({
        to: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      const sentEmail = mockProvider.getSentEmailById(result.id);
      expect(sentEmail?.from).toBe('noreply@example.com');
    });

    it('should reject invalid email addresses', async () => {
      await expect(
        emailService.send({
          to: ['invalid-email'],
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow();
    });

    it('should reject too many recipients', async () => {
      const tooManyRecipients = Array.from(
        { length: 51 },
        (_, i) => `test${i}@example.com`
      );

      await expect(
        emailService.send({
          to: tooManyRecipients,
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow();
    });

    it('should reject blocked file types in attachments', async () => {
      await expect(
        emailService.send({
          to: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          attachments: [
            {
              filename: 'malware.exe',
              content: Buffer.from('test').toString('base64'),
              contentType: 'application/octet-stream',
            },
          ],
        })
      ).rejects.toThrow(EmailAttachmentError);
    });

    it('should reject attachments exceeding size limit', async () => {
      const largeContent = Buffer.alloc(11 * 1024 * 1024).toString('base64');

      await expect(
        emailService.send({
          to: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          attachments: [
            {
              filename: 'large.pdf',
              content: largeContent,
              contentType: 'application/pdf',
            },
          ],
        })
      ).rejects.toThrow(EmailAttachmentError);
    });

    it('should reject too many attachments', async () => {
      const attachments = Array.from({ length: 6 }, (_, i) => ({
        filename: `file${i}.pdf`,
        content: Buffer.from('test').toString('base64'),
        contentType: 'application/pdf',
      }));

      await expect(
        emailService.send({
          to: ['test@example.com'],
          subject: 'Test',
          html: '<p>Test</p>',
          attachments,
        })
      ).rejects.toThrow(EmailAttachmentError);
    });

    it('should enforce rate limits', async () => {
      for (let i = 0; i < 10; i++) {
        await emailService.send(
          {
            to: ['test@example.com'],
            subject: 'Test',
            html: '<p>Test</p>',
          },
          'user-123'
        );
      }

      await expect(
        emailService.send(
          {
            to: ['test@example.com'],
            subject: 'Test',
            html: '<p>Test</p>',
          },
          'user-123'
        )
      ).rejects.toThrow();
    });
  });

  describe('sendBatch', () => {
    it('should send multiple emails', async () => {
      const requests = [
        { to: ['test1@example.com'], subject: 'Test 1', html: '<p>Test 1</p>' },
        { to: ['test2@example.com'], subject: 'Test 2', html: '<p>Test 2</p>' },
        { to: ['test3@example.com'], subject: 'Test 3', html: '<p>Test 3</p>' },
      ];

      const { results, errors } = await emailService.sendBatch(requests);

      expect(results.length).toBe(3);
      expect(errors.length).toBe(0);
      expect(mockProvider.getSentEmailCount()).toBe(3);
    });

    it('should handle partial failures', async () => {
      const requests = [
        { to: ['test1@example.com'], subject: 'Test 1', html: '<p>Test 1</p>' },
        { to: ['invalid-email'], subject: 'Test 2', html: '<p>Test 2</p>' },
        { to: ['test3@example.com'], subject: 'Test 3', html: '<p>Test 3</p>' },
      ];

      const { results, errors } = await emailService.sendBatch(requests);

      expect(results.length).toBe(2);
      expect(errors.length).toBe(1);
      expect(errors[0].index).toBe(1);
    });
  });

  describe('getDeliveryStatus', () => {
    it('should get delivery status for sent email', async () => {
      const sendResult = await emailService.send({
        to: ['test@example.com'],
        subject: 'Test',
        html: '<p>Test</p>',
      });

      const events = await emailService.getDeliveryStatus(sendResult.id);
      expect(events).toBeDefined();
    });
  });

  describe('template management', () => {
    it('should create a template', async () => {
      const template = await emailService.createTemplate({
        name: 'test-template',
        subject: 'Test {{name}}',
        htmlContent: '<h1>Hello {{name}}</h1>',
        category: 'test',
      });

      expect(template.id).toBeDefined();
      expect(template.name).toBe('test-template');
    });

    it('should update a template', async () => {
      const template = await emailService.createTemplate({
        name: 'test-template',
        subject: 'Test',
        htmlContent: '<h1>Hello</h1>',
        category: 'test',
      });

      const updated = await emailService.updateTemplate(template.id, {
        subject: 'Updated Subject',
      });

      expect(updated.subject).toBe('Updated Subject');
    });

    it('should delete a template', async () => {
      const template = await emailService.createTemplate({
        name: 'test-template',
        subject: 'Test',
        htmlContent: '<h1>Hello</h1>',
        category: 'test',
      });

      await emailService.deleteTemplate(template.id);

      const deleted = await emailService.getTemplate(template.id);
      expect(deleted).toBeNull();
    });

    it('should get template by name', async () => {
      await emailService.createTemplate({
        name: 'unique-template',
        subject: 'Test',
        htmlContent: '<h1>Hello</h1>',
        category: 'test',
      });

      const template = await emailService.getTemplateByName('unique-template');
      expect(template).toBeDefined();
      expect(template?.name).toBe('unique-template');
    });

    it('should list templates', async () => {
      await emailService.createTemplate({
        name: 'template-1',
        subject: 'Test 1',
        htmlContent: '<h1>Hello 1</h1>',
        category: 'marketing',
      });

      await emailService.createTemplate({
        name: 'template-2',
        subject: 'Test 2',
        htmlContent: '<h1>Hello 2</h1>',
        category: 'transactional',
      });

      const allTemplates = await emailService.listTemplates();
      expect(allTemplates.length).toBe(2);

      const marketingTemplates = await emailService.listTemplates({
        category: 'marketing',
      });
      expect(marketingTemplates.length).toBe(1);
    });
  });

  describe('queue management', () => {
    it('should enqueue scheduled email', async () => {
      const scheduledAt = new Date(Date.now() + 3600000);

      const result = await emailService.send({
        to: ['test@example.com'],
        subject: 'Scheduled Email',
        html: '<p>Scheduled content</p>',
        scheduledAt: scheduledAt.toISOString(),
      });

      expect(result.id).toBeDefined();
    });

    it('should get queue status', async () => {
      const status = await emailService.getQueueStatus();
      expect(status).toBeDefined();
    });

    it('should get queue length', async () => {
      const length = await emailService.getQueueLength();
      expect(typeof length).toBe('number');
    });
  });

  describe('delivery events', () => {
    it('should handle delivery event', () => {
      const event = {
        id: 'event-123',
        emailId: 'email-123',
        messageId: 'msg-123',
        status: 'delivered' as const,
        timestamp: new Date(),
        recipient: 'test@example.com',
      };

      emailService.handleDeliveryEvent(event);
    });
  });
});
