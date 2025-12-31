import {
  ISmsProvider,
  SmsMessage,
  SmsSendResult,
  SmsDeliveryEvent,
  SmsTemplate,
  SmsServiceConfig,
} from '../interfaces';
import { SmsTemplateService } from './template.service';
import { VerificationService } from './verification.service';
import { SmsInvalidPhoneError, ValidationError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { ThreeTierRateLimiter } from '../../common/security/rate-limiter';
import {
  sendSmsRequestSchema,
  SendSmsRequest,
  verificationRequestSchema,
  verificationCheckSchema,
} from '../../common/validators';
import { v4 as uuidv4 } from 'uuid';

export class SmsService {
  private provider: ISmsProvider;
  private templateService: SmsTemplateService;
  private verificationService: VerificationService;
  private logger: PlatformLogger;
  private rateLimiter: ThreeTierRateLimiter;
  private config: SmsServiceConfig;
  private deliveryEvents: Map<string, SmsDeliveryEvent[]> = new Map();

  constructor(
    provider: ISmsProvider,
    templateService: SmsTemplateService,
    verificationService: VerificationService,
    logger: PlatformLogger,
    rateLimiter: ThreeTierRateLimiter,
    config: SmsServiceConfig
  ) {
    this.provider = provider;
    this.templateService = templateService;
    this.verificationService = verificationService;
    this.logger = logger;
    this.rateLimiter = rateLimiter;
    this.config = {
      maxMessageLength: 1600,
      rateLimitPerMinute: 60,
      verificationCodeLength: 6,
      verificationExpiresMinutes: 10,
      verificationMaxAttempts: 3,
      retryAttempts: 3,
      retryDelayMs: 1000,
      ...config,
    };
  }

  async send(request: SendSmsRequest, userId?: string): Promise<SmsSendResult> {
    const timer = this.logger.startTimer('sms_service_send');
    const correlationId = uuidv4();

    try {
      const validatedRequest = sendSmsRequestSchema.parse(request);

      this.rateLimiter.checkOrThrow('platform', 'sms', userId);

      this.validatePhoneNumber(validatedRequest.to);

      let body = validatedRequest.body;

      if (validatedRequest.templateId) {
        body = await this.templateService.render(
          validatedRequest.templateId,
          validatedRequest.templateData || {}
        );
      }

      if (!body) {
        throw new ValidationError('Message body is required');
      }

      if (body.length > this.config.maxMessageLength!) {
        throw new ValidationError(
          `Message too long. Maximum length: ${this.config.maxMessageLength} characters`
        );
      }

      const message: SmsMessage = {
        id: uuidv4(),
        to: validatedRequest.to,
        from: validatedRequest.from || this.config.defaultFrom,
        body,
        mediaUrls: validatedRequest.mediaUrls,
        scheduledAt: validatedRequest.scheduledAt,
        validityPeriod: validatedRequest.validityPeriod,
        priority: validatedRequest.priority,
        metadata: validatedRequest.metadata,
      };

      const result = await this.provider.send(message);

      this.logger.audit({
        eventType: EventTypes.SMS_SEND_SUCCESS,
        userId,
        operation: 'send',
        resource: 'sms',
        resourceId: result.id,
        newValue: {
          to: this.maskPhoneNumber(validatedRequest.to),
          templateId: validatedRequest.templateId,
          segments: result.segments,
        },
        success: true,
        correlationId,
      });

      timer(true, { correlationId, smsId: result.id, messageId: result.messageId });

      return result;
    } catch (error) {
      this.logger.audit({
        eventType: EventTypes.SMS_SEND_FAILED,
        userId,
        operation: 'send',
        resource: 'sms',
        success: false,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });

      timer(false, { correlationId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  async sendBatch(
    requests: SendSmsRequest[],
    userId?: string
  ): Promise<{ results: SmsSendResult[]; errors: { index: number; error: string }[] }> {
    const results: SmsSendResult[] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < requests.length; i++) {
      try {
        const result = await this.send(requests[i], userId);
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { results, errors };
  }

  async getDeliveryStatus(smsId: string): Promise<SmsDeliveryEvent[]> {
    const events = this.deliveryEvents.get(smsId);
    if (events) {
      return events;
    }
    return this.provider.getDeliveryStatus(smsId);
  }

  async cancelMessage(messageId: string): Promise<boolean> {
    return this.provider.cancelMessage(messageId);
  }

  async createVerification(
    phoneNumber: string,
    options?: {
      channel?: 'sms' | 'call';
      codeLength?: number;
      expiresInMinutes?: number;
      locale?: string;
    },
    _userId?: string
  ): Promise<{ verificationId: string; expiresAt: Date }> {
    const validatedRequest = verificationRequestSchema.parse({
      phoneNumber,
      ...options,
    });

    return this.verificationService.create(validatedRequest.phoneNumber, {
      channel: validatedRequest.channel,
      codeLength: validatedRequest.codeLength,
      expiresInMinutes: validatedRequest.expiresInMinutes,
      locale: validatedRequest.locale,
    });
  }

  async verifyCode(
    phoneNumber: string,
    code: string,
    _userId?: string
  ): Promise<{ valid: boolean; verificationId?: string }> {
    const validatedRequest = verificationCheckSchema.parse({
      phoneNumber,
      code,
    });

    return this.verificationService.verify(validatedRequest.phoneNumber, validatedRequest.code);
  }

  async cancelVerification(phoneNumber: string): Promise<boolean> {
    return this.verificationService.cancel(phoneNumber);
  }

  async getVerificationStatus(phoneNumber: string) {
    return this.verificationService.getStatus(phoneNumber);
  }

  async createTemplate(
    template: Omit<SmsTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    _userId?: string
  ): Promise<SmsTemplate> {
    return this.templateService.create(template);
  }

  async updateTemplate(
    id: string,
    updates: Partial<SmsTemplate>,
    _userId?: string
  ): Promise<SmsTemplate> {
    return this.templateService.update(id, updates);
  }

  async deleteTemplate(id: string, _userId?: string): Promise<void> {
    return this.templateService.delete(id);
  }

  async getTemplate(id: string): Promise<SmsTemplate | null> {
    return this.templateService.get(id);
  }

  async getTemplateByName(name: string): Promise<SmsTemplate | null> {
    return this.templateService.getByName(name);
  }

  async listTemplates(filter?: { category?: string; isActive?: boolean }): Promise<SmsTemplate[]> {
    return this.templateService.list(filter);
  }

  handleDeliveryEvent(event: SmsDeliveryEvent): void {
    const existingEvents = this.deliveryEvents.get(event.smsId) || [];
    existingEvents.push(event);
    this.deliveryEvents.set(event.smsId, existingEvents);

    this.logger.event(EventTypes.SMS_DELIVERY_STATUS_UPDATED, {
      smsId: event.smsId,
      messageId: event.messageId,
      status: event.status,
      to: this.maskPhoneNumber(event.to),
    });
  }

  private validatePhoneNumber(phoneNumber: string): void {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      throw new SmsInvalidPhoneError(phoneNumber);
    }
  }

  private maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length <= 4) {
      return '****';
    }
    return phoneNumber.slice(0, 3) + '****' + phoneNumber.slice(-2);
  }

  clearDeliveryEvents(): void {
    this.deliveryEvents.clear();
  }
}

export default SmsService;
