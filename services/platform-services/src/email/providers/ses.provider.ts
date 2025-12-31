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

interface SESConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class SESProvider implements IEmailProvider {
  readonly name = 'ses';
  private config: SESConfig;
  private logger: PlatformLogger;
  private sandbox: boolean;
  private deliveryEvents: Map<string, EmailDeliveryEvent[]> = new Map();

  constructor(config: SESConfig, logger: PlatformLogger, sandbox = false) {
    this.config = config;
    this.logger = logger;
    this.sandbox = sandbox;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const timer = this.logger.startTimer('ses_send');
    const emailId = message.id || uuidv4();

    try {
      this.logger.event(EventTypes.EMAIL_SEND_INITIATED, {
        emailId,
        to: message.to.map((t) => t.email),
        subject: message.subject,
        provider: this.name,
      });

      if (this.sandbox) {
        return this.mockSend(emailId, message);
      }

      const rawMessage = this.buildRawMessage(message);
      const response = await this.sendRawEmail(rawMessage);

      const messageId = response.MessageId || uuidv4();
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
    return { valid: true };
  }

  private buildRawMessage(message: EmailMessage): string {
    const boundary = `----=_Part_${uuidv4().replace(/-/g, '')}`;
    const lines: string[] = [];

    lines.push(`From: ${this.formatAddress(message.from)}`);
    lines.push(`To: ${message.to.map((t) => this.formatAddress(t)).join(', ')}`);

    if (message.cc?.length) {
      lines.push(`Cc: ${message.cc.map((c) => this.formatAddress(c)).join(', ')}`);
    }

    if (message.replyTo) {
      lines.push(`Reply-To: ${this.formatAddress(message.replyTo)}`);
    }

    lines.push(`Subject: ${this.encodeSubject(message.subject)}`);
    lines.push('MIME-Version: 1.0');

    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        lines.push(`${key}: ${value}`);
      }
    }

    const hasAttachments = message.attachments && message.attachments.length > 0;
    const hasMultipleParts = message.html && message.text;

    if (hasAttachments) {
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');

      if (hasMultipleParts) {
        const altBoundary = `----=_Alt_${uuidv4().replace(/-/g, '')}`;
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
        lines.push('');

        if (message.text) {
          lines.push(`--${altBoundary}`);
          lines.push('Content-Type: text/plain; charset=UTF-8');
          lines.push('Content-Transfer-Encoding: quoted-printable');
          lines.push('');
          lines.push(message.text);
          lines.push('');
        }

        if (message.html) {
          lines.push(`--${altBoundary}`);
          lines.push('Content-Type: text/html; charset=UTF-8');
          lines.push('Content-Transfer-Encoding: quoted-printable');
          lines.push('');
          lines.push(message.html);
          lines.push('');
        }

        lines.push(`--${altBoundary}--`);
      } else {
        lines.push(`--${boundary}`);
        if (message.html) {
          lines.push('Content-Type: text/html; charset=UTF-8');
          lines.push('Content-Transfer-Encoding: quoted-printable');
          lines.push('');
          lines.push(message.html);
        } else if (message.text) {
          lines.push('Content-Type: text/plain; charset=UTF-8');
          lines.push('Content-Transfer-Encoding: quoted-printable');
          lines.push('');
          lines.push(message.text);
        }
        lines.push('');
      }

      for (const attachment of message.attachments!) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${attachment.contentType}; name="${attachment.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(
          `Content-Disposition: ${attachment.disposition || 'attachment'}; filename="${attachment.filename}"`
        );
        if (attachment.contentId) {
          lines.push(`Content-ID: <${attachment.contentId}>`);
        }
        lines.push('');
        lines.push(attachment.content);
        lines.push('');
      }

      lines.push(`--${boundary}--`);
    } else if (hasMultipleParts) {
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
      lines.push('');

      if (message.text) {
        lines.push(`--${boundary}`);
        lines.push('Content-Type: text/plain; charset=UTF-8');
        lines.push('Content-Transfer-Encoding: quoted-printable');
        lines.push('');
        lines.push(message.text);
        lines.push('');
      }

      if (message.html) {
        lines.push(`--${boundary}`);
        lines.push('Content-Type: text/html; charset=UTF-8');
        lines.push('Content-Transfer-Encoding: quoted-printable');
        lines.push('');
        lines.push(message.html);
        lines.push('');
      }

      lines.push(`--${boundary}--`);
    } else {
      if (message.html) {
        lines.push('Content-Type: text/html; charset=UTF-8');
        lines.push('Content-Transfer-Encoding: quoted-printable');
        lines.push('');
        lines.push(message.html);
      } else if (message.text) {
        lines.push('Content-Type: text/plain; charset=UTF-8');
        lines.push('Content-Transfer-Encoding: quoted-printable');
        lines.push('');
        lines.push(message.text);
      }
    }

    return lines.join('\r\n');
  }

  private formatAddress(address: { email: string; name?: string }): string {
    if (address.name) {
      return `"${address.name}" <${address.email}>`;
    }
    return address.email;
  }

  private encodeSubject(subject: string): string {
    if (/^[\x20-\x7E]*$/.test(subject)) {
      return subject;
    }
    return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  }

  private async sendRawEmail(rawMessage: string): Promise<{ MessageId: string }> {
    const endpoint = `https://email.${this.config.region}.amazonaws.com`;
    const body = new URLSearchParams({
      Action: 'SendRawEmail',
      'RawMessage.Data': Buffer.from(rawMessage).toString('base64'),
      Version: '2010-12-01',
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SES API error: ${response.status} - ${errorBody}`);
    }

    const responseText = await response.text();
    const messageIdMatch = responseText.match(/<MessageId>([^<]+)<\/MessageId>/);
    const messageId = messageIdMatch ? messageIdMatch[1] : uuidv4();

    return { MessageId: messageId };
  }

  private mockSend(emailId: string, message: EmailMessage): EmailSendResult {
    const messageId = `mock-ses-${uuidv4()}`;

    this.logger.info(`[SANDBOX] SES Email sent to ${message.to.map((t) => t.email).join(', ')}`, {
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

  handleSNSNotification(notification: Record<string, unknown>): EmailDeliveryEvent | null {
    const message =
      typeof notification.Message === 'string'
        ? JSON.parse(notification.Message)
        : notification.Message;

    if (!message) return null;

    const notificationType = message.notificationType as string;
    const mail = message.mail as Record<string, unknown>;

    if (!mail) return null;

    const messageId = mail.messageId as string;
    const emailId =
      ((mail.commonHeaders as Record<string, unknown>)?.messageId as string) || messageId;

    const statusMap: Record<string, EmailDeliveryStatus> = {
      Delivery: 'delivered',
      Bounce: 'bounced',
      Complaint: 'complained',
    };

    const status = statusMap[notificationType];
    if (!status) return null;

    const deliveryEvent: EmailDeliveryEvent = {
      id: uuidv4(),
      emailId,
      messageId,
      status,
      timestamp: new Date(mail.timestamp as string),
      recipient: (mail.destination as string[])?.[0] || '',
      details: {},
    };

    if (notificationType === 'Bounce') {
      const bounce = message.bounce as Record<string, unknown>;
      deliveryEvent.details = {
        bounceType: bounce?.bounceType as 'hard' | 'soft' | 'undetermined',
        bounceSubType: bounce?.bounceSubType as string,
      };
    }

    if (notificationType === 'Complaint') {
      const complaint = message.complaint as Record<string, unknown>;
      deliveryEvent.details = {
        complaintType: complaint?.complaintFeedbackType as string,
      };
    }

    const existingEvents = this.deliveryEvents.get(messageId) || [];
    existingEvents.push(deliveryEvent);
    this.deliveryEvents.set(messageId, existingEvents);

    this.logger.event(EventTypes.EMAIL_DELIVERY_STATUS_UPDATED, {
      emailId,
      messageId,
      status: deliveryEvent.status,
      recipient: deliveryEvent.recipient,
    });

    return deliveryEvent;
  }
}

export default SESProvider;
