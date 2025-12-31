import {
  IEmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailDeliveryEvent,
  EmailTemplate,
  EmailServiceConfig,
} from '../interfaces';
import { EmailTemplateService } from './template.service';
import {
  EmailInvalidRecipientError,
  EmailAttachmentError,
  EmailQueueError,
  ValidationError,
} from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { ThreeTierRateLimiter } from '../../common/security/rate-limiter';
import { sendEmailRequestSchema, SendEmailRequest } from '../../common/validators';
import { v4 as uuidv4 } from 'uuid';

interface QueuedEmail {
  id: string;
  message: EmailMessage;
  priority: number;
  attempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  lastAttemptAt?: Date;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  error?: string;
}

export class EmailService {
  private provider: IEmailProvider;
  private templateService: EmailTemplateService;
  private logger: PlatformLogger;
  private rateLimiter: ThreeTierRateLimiter;
  private config: EmailServiceConfig;
  private queue: Map<string, QueuedEmail> = new Map();
  private deliveryEvents: Map<string, EmailDeliveryEvent[]> = new Map();
  private processingQueue: boolean = false;

  constructor(
    provider: IEmailProvider,
    templateService: EmailTemplateService,
    logger: PlatformLogger,
    rateLimiter: ThreeTierRateLimiter,
    config: EmailServiceConfig
  ) {
    this.provider = provider;
    this.templateService = templateService;
    this.logger = logger;
    this.rateLimiter = rateLimiter;
    this.config = {
      maxRecipientsPerEmail: 50,
      maxAttachmentSize: 10 * 1024 * 1024,
      maxAttachments: 10,
      rateLimitPerMinute: 100,
      retryAttempts: 3,
      retryDelayMs: 1000,
      trackOpens: true,
      trackClicks: true,
      ...config,
    };
  }

  async send(request: SendEmailRequest, userId?: string): Promise<EmailSendResult> {
    const timer = this.logger.startTimer('email_service_send');
    const correlationId = uuidv4();

    try {
      const validatedRequest = sendEmailRequestSchema.parse(request);

      this.rateLimiter.checkOrThrow('platform', 'email', userId);

      const recipients = Array.isArray(validatedRequest.to)
        ? validatedRequest.to
        : [validatedRequest.to];

      if (recipients.length > this.config.maxRecipientsPerEmail!) {
        throw new ValidationError(
          `Too many recipients. Maximum allowed: ${this.config.maxRecipientsPerEmail}`
        );
      }

      for (const recipient of recipients) {
        const validation = await this.provider.validateEmail(recipient);
        if (!validation.valid) {
          throw new EmailInvalidRecipientError(recipient, validation.reason || 'Invalid email');
        }
      }

      if (validatedRequest.attachments) {
        this.validateAttachments(validatedRequest.attachments);
      }

      let html = validatedRequest.body;
      let text: string | undefined;
      let subject = validatedRequest.subject;

      if (validatedRequest.templateId) {
        const rendered = await this.templateService.render(
          validatedRequest.templateId,
          validatedRequest.templateData || {}
        );
        html = rendered.html;
        text = rendered.text;
        subject = rendered.subject;
      }

      const message: EmailMessage = {
        id: uuidv4(),
        to: recipients.map((email) => ({ email })),
        cc: validatedRequest.cc?.map((email) => ({ email })),
        bcc: validatedRequest.bcc?.map((email) => ({ email })),
        from: validatedRequest.from || this.config.defaultFrom,
        replyTo: validatedRequest.replyTo ? { email: validatedRequest.replyTo } : undefined,
        subject,
        html,
        text,
        attachments: validatedRequest.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
          encoding: att.encoding,
        })),
        headers: validatedRequest.headers,
        priority: validatedRequest.priority,
        tags: validatedRequest.tags,
        metadata: validatedRequest.metadata,
        trackOpens: validatedRequest.trackOpens ?? this.config.trackOpens,
        trackClicks: validatedRequest.trackClicks ?? this.config.trackClicks,
        scheduledAt: validatedRequest.scheduledAt,
      };

      if (message.scheduledAt && message.scheduledAt > new Date()) {
        const queueId = await this.enqueue(message, this.getPriorityValue(message.priority));
        timer(true, { correlationId, queued: true, queueId });

        return {
          id: message.id!,
          messageId: queueId,
          status: 'queued',
          timestamp: new Date(),
          provider: this.provider.name,
          recipients: message.to.map((r) => ({ email: r.email, status: 'accepted' })),
        };
      }

      const result = await this.provider.send(message);

      this.logger.audit({
        eventType: EventTypes.EMAIL_SEND_SUCCESS,
        userId,
        operation: 'send',
        resource: 'email',
        resourceId: result.id,
        newValue: {
          to: recipients,
          subject: message.subject,
          templateId: validatedRequest.templateId,
        },
        success: true,
        correlationId,
      });

      timer(true, { correlationId, emailId: result.id, messageId: result.messageId });

      return result;
    } catch (error) {
      this.logger.audit({
        eventType: EventTypes.EMAIL_SEND_FAILED,
        userId,
        operation: 'send',
        resource: 'email',
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
    requests: SendEmailRequest[],
    userId?: string
  ): Promise<{ results: EmailSendResult[]; errors: { index: number; error: string }[] }> {
    const results: EmailSendResult[] = [];
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

  async getDeliveryStatus(emailId: string): Promise<EmailDeliveryEvent[]> {
    const events = this.deliveryEvents.get(emailId);
    if (events) {
      return events;
    }
    return this.provider.getDeliveryStatus(emailId);
  }

  async createTemplate(
    template: Omit<EmailTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>,
    _userId?: string
  ): Promise<EmailTemplate> {
    return this.templateService.create(template);
  }

  async updateTemplate(
    id: string,
    updates: Partial<EmailTemplate>,
    _userId?: string
  ): Promise<EmailTemplate> {
    return this.templateService.update(id, updates);
  }

  async deleteTemplate(id: string, _userId?: string): Promise<void> {
    return this.templateService.delete(id);
  }

  async getTemplate(id: string): Promise<EmailTemplate | null> {
    return this.templateService.get(id);
  }

  async getTemplateByName(name: string): Promise<EmailTemplate | null> {
    return this.templateService.getByName(name);
  }

  async listTemplates(filter?: {
    category?: string;
    isActive?: boolean;
  }): Promise<EmailTemplate[]> {
    return this.templateService.list(filter);
  }

  async enqueue(message: EmailMessage, priority: number = 0): Promise<string> {
    const queueId = uuidv4();

    const queuedEmail: QueuedEmail = {
      id: queueId,
      message,
      priority,
      attempts: 0,
      createdAt: new Date(),
      scheduledAt: message.scheduledAt,
      status: 'pending',
    };

    this.queue.set(queueId, queuedEmail);

    this.logger.event(EventTypes.EMAIL_QUEUED, {
      queueId,
      emailId: message.id,
      priority,
      scheduledAt: message.scheduledAt,
    });

    return queueId;
  }

  async processQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      const now = new Date();
      const pendingEmails = Array.from(this.queue.values())
        .filter((q) => q.status === 'pending' && (!q.scheduledAt || q.scheduledAt <= now))
        .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());

      for (const queuedEmail of pendingEmails) {
        queuedEmail.status = 'processing';
        queuedEmail.attempts++;
        queuedEmail.lastAttemptAt = new Date();

        try {
          const result = await this.provider.send(queuedEmail.message);

          queuedEmail.status = 'sent';

          this.logger.event(EventTypes.EMAIL_DEQUEUED, {
            queueId: queuedEmail.id,
            emailId: queuedEmail.message.id,
            messageId: result.messageId,
            attempts: queuedEmail.attempts,
          });
        } catch (error) {
          if (queuedEmail.attempts >= this.config.retryAttempts!) {
            queuedEmail.status = 'failed';
            queuedEmail.error = error instanceof Error ? error.message : 'Unknown error';

            this.logger.event(EventTypes.EMAIL_SEND_FAILED, {
              queueId: queuedEmail.id,
              emailId: queuedEmail.message.id,
              attempts: queuedEmail.attempts,
              error: queuedEmail.error,
            });
          } else {
            queuedEmail.status = 'pending';
          }
        }
      }
    } finally {
      this.processingQueue = false;
    }
  }

  async getQueueStatus(queueId: string): Promise<{
    status: string;
    position?: number;
    attempts?: number;
    error?: string;
  }> {
    const queuedEmail = this.queue.get(queueId);
    if (!queuedEmail) {
      throw new EmailQueueError('getStatus', 'Queue item not found');
    }

    const pendingEmails = Array.from(this.queue.values())
      .filter((q) => q.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());

    const position = pendingEmails.findIndex((q) => q.id === queueId);

    return {
      status: queuedEmail.status,
      position: position >= 0 ? position + 1 : undefined,
      attempts: queuedEmail.attempts,
      error: queuedEmail.error,
    };
  }

  async cancelQueued(queueId: string): Promise<boolean> {
    const queuedEmail = this.queue.get(queueId);
    if (!queuedEmail) {
      return false;
    }

    if (queuedEmail.status !== 'pending') {
      return false;
    }

    this.queue.delete(queueId);
    return true;
  }

  getQueueLength(): number {
    return Array.from(this.queue.values()).filter((q) => q.status === 'pending').length;
  }

  handleDeliveryEvent(event: EmailDeliveryEvent): void {
    const existingEvents = this.deliveryEvents.get(event.emailId) || [];
    existingEvents.push(event);
    this.deliveryEvents.set(event.emailId, existingEvents);

    this.logger.event(EventTypes.EMAIL_DELIVERY_STATUS_UPDATED, {
      emailId: event.emailId,
      messageId: event.messageId,
      status: event.status,
      recipient: event.recipient,
    });

    if (event.status === 'bounced') {
      this.logger.event(EventTypes.EMAIL_BOUNCE_RECEIVED, {
        emailId: event.emailId,
        recipient: event.recipient,
        bounceType: event.details?.bounceType,
      });
    }

    if (event.status === 'complained') {
      this.logger.event(EventTypes.EMAIL_COMPLAINT_RECEIVED, {
        emailId: event.emailId,
        recipient: event.recipient,
        complaintType: event.details?.complaintType,
      });
    }
  }

  private validateAttachments(
    attachments: { filename: string; content: string; contentType: string }[]
  ): void {
    if (attachments.length > this.config.maxAttachments!) {
      throw new EmailAttachmentError(
        'multiple',
        `Too many attachments. Maximum allowed: ${this.config.maxAttachments}`
      );
    }

    for (const attachment of attachments) {
      const sizeInBytes = Buffer.byteLength(attachment.content, 'base64');
      if (sizeInBytes > this.config.maxAttachmentSize!) {
        throw new EmailAttachmentError(
          attachment.filename,
          `Attachment too large. Maximum size: ${this.config.maxAttachmentSize! / 1024 / 1024}MB`
        );
      }

      const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.js', '.vbs'];
      const extension = attachment.filename
        .toLowerCase()
        .slice(attachment.filename.lastIndexOf('.'));
      if (dangerousExtensions.includes(extension)) {
        throw new EmailAttachmentError(
          attachment.filename,
          `File type ${extension} is not allowed`
        );
      }
    }
  }

  private getPriorityValue(priority?: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 10;
      case 'low':
        return -10;
      default:
        return 0;
    }
  }

  clearQueue(): void {
    this.queue.clear();
  }

  clearDeliveryEvents(): void {
    this.deliveryEvents.clear();
  }
}

export default EmailService;
