import {
  IEmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailDeliveryEvent,
  EmailDeliveryStatus,
} from '../interfaces';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';

export class MockEmailProvider implements IEmailProvider {
  readonly name = 'mock';
  private logger: PlatformLogger;
  private sentEmails: Map<string, EmailMessage> = new Map();
  private deliveryEvents: Map<string, EmailDeliveryEvent[]> = new Map();
  private simulateFailure: boolean = false;
  private failureRate: number = 0;

  constructor(logger: PlatformLogger) {
    this.logger = logger;
  }

  setSimulateFailure(simulate: boolean, rate: number = 0.1): void {
    this.simulateFailure = simulate;
    this.failureRate = rate;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const timer = this.logger.startTimer('mock_email_send');
    const emailId = message.id || uuidv4();
    const messageId = `mock-${uuidv4()}`;

    this.logger.event(EventTypes.EMAIL_SEND_INITIATED, {
      emailId,
      to: message.to.map((t) => t.email),
      subject: message.subject,
      provider: this.name,
    });

    if (this.simulateFailure && Math.random() < this.failureRate) {
      this.logger.event(EventTypes.EMAIL_SEND_FAILED, {
        emailId,
        error: 'Simulated failure',
      });
      timer(false, { emailId, error: 'Simulated failure' });

      return {
        id: emailId,
        messageId,
        status: 'failed',
        timestamp: new Date(),
        provider: this.name,
        recipients: message.to.map((recipient) => ({
          email: recipient.email,
          status: 'rejected',
          reason: 'Simulated failure',
        })),
      };
    }

    this.sentEmails.set(emailId, message);

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
        timestamp: new Date(Date.now() + 100),
        recipient: message.to[0].email,
      },
    ];
    this.deliveryEvents.set(messageId, events);

    this.logger.event(EventTypes.EMAIL_SEND_SUCCESS, {
      emailId,
      messageId,
      recipientCount: message.to.length,
    });

    timer(true, { emailId, messageId });

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

  async sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
    const results: EmailSendResult[] = [];
    for (const message of messages) {
      const result = await this.send(message);
      results.push(result);
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

  getSentEmails(): Map<string, EmailMessage> {
    return new Map(this.sentEmails);
  }

  getSentEmailById(emailId: string): EmailMessage | undefined {
    return this.sentEmails.get(emailId);
  }

  getSentEmailCount(): number {
    return this.sentEmails.size;
  }

  clearSentEmails(): void {
    this.sentEmails.clear();
    this.deliveryEvents.clear();
  }

  simulateDeliveryEvent(
    messageId: string,
    status: EmailDeliveryStatus,
    recipient: string
  ): EmailDeliveryEvent {
    const event: EmailDeliveryEvent = {
      id: uuidv4(),
      emailId: messageId,
      messageId,
      status,
      timestamp: new Date(),
      recipient,
    };

    const existingEvents = this.deliveryEvents.get(messageId) || [];
    existingEvents.push(event);
    this.deliveryEvents.set(messageId, existingEvents);

    this.logger.event(EventTypes.EMAIL_DELIVERY_STATUS_UPDATED, {
      emailId: messageId,
      messageId,
      status,
      recipient,
    });

    return event;
  }
}

export default MockEmailProvider;
