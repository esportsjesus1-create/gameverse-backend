import {
  IEmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailDeliveryEvent,
  EmailDeliveryStatus,
} from '../interfaces';
import { EmailProviderError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';

interface SendGridMailContent {
  type: string;
  value: string;
}

interface SendGridPersonalization {
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject?: string;
  headers?: Record<string, string>;
  custom_args?: Record<string, string>;
}

interface SendGridAttachment {
  content: string;
  filename: string;
  type?: string;
  disposition?: string;
  content_id?: string;
}

interface SendGridMailData {
  personalizations: SendGridPersonalization[];
  from: { email: string; name?: string };
  reply_to?: { email: string; name?: string };
  subject: string;
  content: SendGridMailContent[];
  attachments?: SendGridAttachment[];
  headers?: Record<string, string>;
  categories?: string[];
  custom_args?: Record<string, string>;
  send_at?: number;
  tracking_settings?: {
    click_tracking?: { enable: boolean };
    open_tracking?: { enable: boolean };
  };
}

export class SendGridProvider implements IEmailProvider {
  readonly name = 'sendgrid';
  private apiKey: string;
  private logger: PlatformLogger;
  private sandbox: boolean;
  private deliveryEvents: Map<string, EmailDeliveryEvent[]> = new Map();

  constructor(apiKey: string, logger: PlatformLogger, sandbox = false) {
    this.apiKey = apiKey;
    this.logger = logger;
    this.sandbox = sandbox;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const timer = this.logger.startTimer('sendgrid_send');
    const emailId = message.id || uuidv4();

    try {
      this.logger.event(EventTypes.EMAIL_SEND_INITIATED, {
        emailId,
        to: message.to.map((t) => t.email),
        subject: message.subject,
        provider: this.name,
      });

      const mailData = this.buildMailData(message);

      if (this.sandbox) {
        return this.mockSend(emailId, message);
      }

      const response = await this.sendRequest(mailData);

      const messageId = response.headers?.['x-message-id'] || uuidv4();
      const result: EmailSendResult = {
        id: emailId,
        messageId,
        status: 'sent',
        timestamp: new Date(),
        provider: this.name,
        recipients: message.to.map((recipient) => ({
          email: recipient.email,
          status: 'accepted',
        })),
      };

      this.logger.event(EventTypes.EMAIL_SEND_SUCCESS, {
        emailId,
        messageId,
        recipientCount: message.to.length,
      });

      timer(true, { emailId, messageId });
      return result;
    } catch (error) {
      this.logger.event(EventTypes.EMAIL_SEND_FAILED, {
        emailId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      timer(false, { emailId, error: error instanceof Error ? error.message : 'Unknown error' });

      if (error instanceof Error) {
        throw new EmailProviderError(this.name, error);
      }
      throw new EmailProviderError(this.name, error);
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];

    for (const message of messages) {
      try {
        const result = await this.send(message);
        results.push(result);
      } catch (error) {
        results.push({
          id: message.id || uuidv4(),
          messageId: '',
          status: 'failed',
          timestamp: new Date(),
          provider: this.name,
          recipients: message.to.map((recipient) => ({
            email: recipient.email,
            status: 'rejected',
            reason: error instanceof Error ? error.message : 'Unknown error',
          })),
        });
      }
    }

    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<EmailDeliveryEvent[]> {
    return this.deliveryEvents.get(messageId) || [];
  }

  async validateEmail(email: string): Promise<{ valid: boolean; reason?: string }> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Invalid email format' };
    }

    const disposableDomains = ['tempmail.com', 'throwaway.com', 'mailinator.com'];
    const domain = email.split('@')[1].toLowerCase();
    if (disposableDomains.includes(domain)) {
      return { valid: false, reason: 'Disposable email addresses not allowed' };
    }

    return { valid: true };
  }

  private buildMailData(message: EmailMessage): SendGridMailData {
    const content: SendGridMailContent[] = [];

    if (message.text) {
      content.push({ type: 'text/plain', value: message.text });
    }
    if (message.html) {
      content.push({ type: 'text/html', value: message.html });
    }

    const personalization: SendGridPersonalization = {
      to: message.to.map((t) => ({ email: t.email, name: t.name })),
    };

    if (message.cc?.length) {
      personalization.cc = message.cc.map((c) => ({ email: c.email, name: c.name }));
    }
    if (message.bcc?.length) {
      personalization.bcc = message.bcc.map((b) => ({ email: b.email, name: b.name }));
    }
    if (message.headers) {
      personalization.headers = message.headers;
    }

    const mailData: SendGridMailData = {
      personalizations: [personalization],
      from: { email: message.from.email, name: message.from.name },
      subject: message.subject,
      content,
    };

    if (message.replyTo) {
      mailData.reply_to = { email: message.replyTo.email, name: message.replyTo.name };
    }

    if (message.attachments?.length) {
      mailData.attachments = message.attachments.map((att) => ({
        content: att.content,
        filename: att.filename,
        type: att.contentType,
        disposition: att.disposition || 'attachment',
        content_id: att.contentId,
      }));
    }

    if (message.tags?.length) {
      mailData.categories = message.tags;
    }

    if (message.scheduledAt) {
      mailData.send_at = Math.floor(message.scheduledAt.getTime() / 1000);
    }

    mailData.tracking_settings = {
      click_tracking: { enable: message.trackClicks !== false },
      open_tracking: { enable: message.trackOpens !== false },
    };

    return mailData;
  }

  private async sendRequest(
    mailData: SendGridMailData
  ): Promise<{ headers?: Record<string, string> }> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailData),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorBody}`);
    }

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return { headers };
  }

  private mockSend(emailId: string, message: EmailMessage): EmailSendResult {
    const messageId = `mock-${uuidv4()}`;

    this.logger.info(`[SANDBOX] Email sent to ${message.to.map((t) => t.email).join(', ')}`, {
      emailId,
      messageId,
      subject: message.subject,
    });

    const events: EmailDeliveryEvent[] = [
      {
        id: uuidv4(),
        emailId,
        messageId,
        status: 'sent',
        timestamp: new Date(),
        recipient: message.to[0].email,
      },
      {
        id: uuidv4(),
        emailId,
        messageId,
        status: 'delivered',
        timestamp: new Date(Date.now() + 1000),
        recipient: message.to[0].email,
      },
    ];
    this.deliveryEvents.set(messageId, events);

    return {
      id: emailId,
      messageId,
      status: 'sent',
      timestamp: new Date(),
      provider: this.name,
      recipients: message.to.map((recipient) => ({
        email: recipient.email,
        status: 'accepted',
      })),
    };
  }

  handleWebhook(payload: Record<string, unknown>[]): EmailDeliveryEvent[] {
    const events: EmailDeliveryEvent[] = [];

    for (const event of payload) {
      const emailId = (event.sg_message_id as string)?.split('.')[0] || '';
      const messageId = (event.sg_message_id as string) || '';
      const eventType = event.event as string;

      const statusMap: Record<string, EmailDeliveryStatus> = {
        processed: 'sent',
        delivered: 'delivered',
        open: 'opened',
        click: 'clicked',
        bounce: 'bounced',
        spamreport: 'complained',
        dropped: 'failed',
        deferred: 'deferred',
      };

      const deliveryEvent: EmailDeliveryEvent = {
        id: uuidv4(),
        emailId,
        messageId,
        status: statusMap[eventType] || 'sent',
        timestamp: new Date((event.timestamp as number) * 1000),
        recipient: event.email as string,
        details: {
          bounceType: event.type as 'hard' | 'soft' | 'undetermined' | undefined,
          reason: event.reason as string | undefined,
          userAgent: event.useragent as string | undefined,
          ipAddress: event.ip as string | undefined,
          linkUrl: event.url as string | undefined,
        },
      };

      events.push(deliveryEvent);

      const existingEvents = this.deliveryEvents.get(messageId) || [];
      existingEvents.push(deliveryEvent);
      this.deliveryEvents.set(messageId, existingEvents);

      this.logger.event(EventTypes.EMAIL_DELIVERY_STATUS_UPDATED, {
        emailId,
        messageId,
        status: deliveryEvent.status,
        recipient: deliveryEvent.recipient,
      });
    }

    return events;
  }
}

export default SendGridProvider;
