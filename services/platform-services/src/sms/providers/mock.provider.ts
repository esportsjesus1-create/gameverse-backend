import {
  ISmsProvider,
  SmsMessage,
  SmsSendResult,
  SmsDeliveryEvent,
  SmsDeliveryStatus,
} from '../interfaces';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';

export class MockSmsProvider implements ISmsProvider {
  readonly name = 'mock';
  private logger: PlatformLogger;
  private sentMessages: Map<string, SmsMessage> = new Map();
  private deliveryEvents: Map<string, SmsDeliveryEvent[]> = new Map();
  private simulateFailure: boolean = false;
  private failureRate: number = 0;

  constructor(logger: PlatformLogger) {
    this.logger = logger;
  }

  setSimulateFailure(simulate: boolean, rate: number = 0.1): void {
    this.simulateFailure = simulate;
    this.failureRate = rate;
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const timer = this.logger.startTimer('mock_sms_send');
    const smsId = message.id || uuidv4();
    const messageId = `mock-${uuidv4()}`;

    this.logger.event(EventTypes.SMS_SEND_INITIATED, {
      smsId,
      to: message.to,
      provider: this.name,
    });

    if (this.simulateFailure && Math.random() < this.failureRate) {
      this.logger.event(EventTypes.SMS_SEND_FAILED, {
        smsId,
        error: 'Simulated failure',
      });
      timer(false, { smsId, error: 'Simulated failure' });

      return {
        id: smsId,
        messageId,
        status: 'failed',
        timestamp: new Date(),
        provider: this.name,
        to: message.to,
        from: message.from || '+15555555555',
      };
    }

    this.sentMessages.set(smsId, message);

    const events: SmsDeliveryEvent[] = [
      {
        id: uuidv4(),
        smsId,
        messageId,
        status: 'sent',
        timestamp: new Date(),
        to: message.to,
      },
      {
        id: uuidv4(),
        smsId,
        messageId,
        status: 'delivered',
        timestamp: new Date(Date.now() + 100),
        to: message.to,
      },
    ];
    this.deliveryEvents.set(messageId, events);

    this.logger.event(EventTypes.SMS_SEND_SUCCESS, {
      smsId,
      messageId,
      segments: Math.ceil(message.body.length / 160),
    });

    timer(true, { smsId, messageId });

    return {
      id: smsId,
      messageId,
      status: 'sent',
      timestamp: new Date(),
      provider: this.name,
      to: message.to,
      from: message.from || '+15555555555',
      segments: Math.ceil(message.body.length / 160),
    };
  }

  async sendBatch(messages: SmsMessage[]): Promise<SmsSendResult[]> {
    const results: SmsSendResult[] = [];
    for (const message of messages) {
      const result = await this.send(message);
      results.push(result);
    }
    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<SmsDeliveryEvent[]> {
    return this.deliveryEvents.get(messageId) || [];
  }

  async cancelMessage(messageId: string): Promise<boolean> {
    const events = this.deliveryEvents.get(messageId);
    if (!events) return false;

    const lastEvent = events[events.length - 1];
    if (lastEvent.status === 'delivered' || lastEvent.status === 'failed') {
      return false;
    }

    events.push({
      id: uuidv4(),
      smsId: lastEvent.smsId,
      messageId,
      status: 'canceled',
      timestamp: new Date(),
      to: lastEvent.to,
    });

    return true;
  }

  getSentMessages(): Map<string, SmsMessage> {
    return new Map(this.sentMessages);
  }

  getSentMessageById(smsId: string): SmsMessage | undefined {
    return this.sentMessages.get(smsId);
  }

  getSentMessageCount(): number {
    return this.sentMessages.size;
  }

  clearSentMessages(): void {
    this.sentMessages.clear();
    this.deliveryEvents.clear();
  }

  simulateDeliveryEvent(
    messageId: string,
    status: SmsDeliveryStatus,
    to: string
  ): SmsDeliveryEvent {
    const event: SmsDeliveryEvent = {
      id: uuidv4(),
      smsId: messageId,
      messageId,
      status,
      timestamp: new Date(),
      to,
    };

    const existingEvents = this.deliveryEvents.get(messageId) || [];
    existingEvents.push(event);
    this.deliveryEvents.set(messageId, existingEvents);

    this.logger.event(EventTypes.SMS_DELIVERY_STATUS_UPDATED, {
      smsId: messageId,
      messageId,
      status,
      to,
    });

    return event;
  }
}

export default MockSmsProvider;
