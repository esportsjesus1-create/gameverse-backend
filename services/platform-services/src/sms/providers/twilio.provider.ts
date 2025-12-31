import {
  ISmsProvider,
  SmsMessage,
  SmsSendResult,
  SmsDeliveryEvent,
  SmsDeliveryStatus,
} from '../interfaces';
import { SmsProviderError, SmsDeliveryError, SmsInvalidPhoneError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  defaultFrom?: string;
  messagingServiceSid?: string;
}

export class TwilioProvider implements ISmsProvider {
  readonly name = 'twilio';
  private config: TwilioConfig;
  private logger: PlatformLogger;
  private sandbox: boolean;
  private deliveryEvents: Map<string, SmsDeliveryEvent[]> = new Map();

  constructor(config: TwilioConfig, logger: PlatformLogger, sandbox = false) {
    this.config = config;
    this.logger = logger;
    this.sandbox = sandbox;
  }

  async send(message: SmsMessage): Promise<SmsSendResult> {
    const timer = this.logger.startTimer('twilio_send');
    const smsId = message.id || uuidv4();

    try {
      this.logger.event(EventTypes.SMS_SEND_INITIATED, {
        smsId,
        to: message.to,
        provider: this.name,
      });

      this.validatePhoneNumber(message.to);

      if (this.sandbox) {
        return this.mockSend(smsId, message);
      }

      const response = await this.sendRequest(message);

      const result: SmsSendResult = {
        id: smsId,
        messageId: response.sid,
        status: this.mapTwilioStatus(response.status),
        timestamp: new Date(),
        provider: this.name,
        to: message.to,
        from: response.from || message.from || this.config.defaultFrom || '',
        segments: response.numSegments,
        price: response.price
          ? { amount: parseFloat(response.price), currency: response.priceUnit || 'USD' }
          : undefined,
      };

      this.logger.event(EventTypes.SMS_SEND_SUCCESS, {
        smsId,
        messageId: result.messageId,
        segments: result.segments,
      });

      timer(true, { smsId, messageId: result.messageId });
      return result;
    } catch (error) {
      this.logger.event(EventTypes.SMS_SEND_FAILED, {
        smsId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      timer(false, { smsId, error: error instanceof Error ? error.message : 'Unknown error' });

      if (error instanceof SmsInvalidPhoneError) {
        throw error;
      }
      throw new SmsProviderError(this.name, error);
    }
  }

  async sendBatch(messages: SmsMessage[]): Promise<SmsSendResult[]> {
    const results: SmsSendResult[] = [];

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
          to: message.to,
          from: message.from || this.config.defaultFrom || '',
        });
      }
    }

    return results;
  }

  async getDeliveryStatus(messageId: string): Promise<SmsDeliveryEvent[]> {
    if (this.sandbox) {
      return this.deliveryEvents.get(messageId) || [];
    }

    try {
      const response = await this.fetchMessageStatus(messageId);

      const event: SmsDeliveryEvent = {
        id: uuidv4(),
        smsId: messageId,
        messageId,
        status: this.mapTwilioStatus(response.status),
        timestamp: new Date(response.dateUpdated),
        to: response.to,
        errorCode: response.errorCode?.toString(),
        errorMessage: response.errorMessage,
      };

      return [event];
    } catch (error) {
      throw new SmsDeliveryError(
        messageId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async cancelMessage(messageId: string): Promise<boolean> {
    if (this.sandbox) {
      return true;
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages/${messageId}.json`;
      const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
        'base64'
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'Status=canceled',
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  private validatePhoneNumber(phoneNumber: string): void {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      throw new SmsInvalidPhoneError(phoneNumber);
    }
  }

  private async sendRequest(message: SmsMessage): Promise<{
    sid: string;
    status: string;
    from: string;
    numSegments?: number;
    price?: string;
    priceUnit?: string;
  }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64'
    );

    const body = new URLSearchParams({
      To: message.to,
      Body: message.body,
    });

    if (message.from) {
      body.append('From', message.from);
    } else if (this.config.messagingServiceSid) {
      body.append('MessagingServiceSid', this.config.messagingServiceSid);
    } else if (this.config.defaultFrom) {
      body.append('From', this.config.defaultFrom);
    }

    if (message.mediaUrls?.length) {
      for (const url of message.mediaUrls) {
        body.append('MediaUrl', url);
      }
    }

    if (message.scheduledAt) {
      body.append('SendAt', message.scheduledAt.toISOString());
      body.append('ScheduleType', 'fixed');
    }

    if (message.validityPeriod) {
      body.append('ValidityPeriod', message.validityPeriod.toString());
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = (await response.json()) as { message?: string };
      throw new Error(`Twilio API error: ${errorBody.message || response.statusText}`);
    }

    return response.json() as Promise<{
      sid: string;
      status: string;
      from: string;
      numSegments?: number;
      price?: string;
      priceUnit?: string;
    }>;
  }

  private async fetchMessageStatus(messageId: string): Promise<{
    status: string;
    dateUpdated: string;
    to: string;
    errorCode?: number;
    errorMessage?: string;
  }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages/${messageId}.json`;
    const auth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64'
    );

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch message status: ${response.statusText}`);
    }

    return response.json() as Promise<{
      status: string;
      dateUpdated: string;
      to: string;
      errorCode?: number;
      errorMessage?: string;
    }>;
  }

  private mapTwilioStatus(status: string): SmsDeliveryStatus {
    const statusMap: Record<string, SmsDeliveryStatus> = {
      queued: 'queued',
      sending: 'sending',
      sent: 'sent',
      delivered: 'delivered',
      undelivered: 'undelivered',
      failed: 'failed',
      canceled: 'canceled',
      accepted: 'queued',
      scheduled: 'queued',
      read: 'delivered',
    };

    return statusMap[status.toLowerCase()] || 'sent';
  }

  private mockSend(smsId: string, message: SmsMessage): SmsSendResult {
    const messageId = `mock-twilio-${uuidv4()}`;

    this.logger.info(`[SANDBOX] SMS sent to ${message.to}`, {
      smsId,
      messageId,
      body: message.body.substring(0, 50) + (message.body.length > 50 ? '...' : ''),
    });

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
        timestamp: new Date(Date.now() + 1000),
        to: message.to,
      },
    ];
    this.deliveryEvents.set(messageId, events);

    return {
      id: smsId,
      messageId,
      status: 'sent',
      timestamp: new Date(),
      provider: this.name,
      to: message.to,
      from: message.from || this.config.defaultFrom || '+15555555555',
      segments: Math.ceil(message.body.length / 160),
    };
  }

  handleWebhook(payload: Record<string, string>): SmsDeliveryEvent {
    const messageId = payload.MessageSid || payload.SmsSid;
    const status = payload.MessageStatus || payload.SmsStatus;

    const event: SmsDeliveryEvent = {
      id: uuidv4(),
      smsId: messageId,
      messageId,
      status: this.mapTwilioStatus(status),
      timestamp: new Date(),
      to: payload.To,
      errorCode: payload.ErrorCode,
      errorMessage: payload.ErrorMessage,
    };

    const existingEvents = this.deliveryEvents.get(messageId) || [];
    existingEvents.push(event);
    this.deliveryEvents.set(messageId, existingEvents);

    this.logger.event(EventTypes.SMS_DELIVERY_STATUS_UPDATED, {
      smsId: messageId,
      messageId,
      status: event.status,
      to: event.to,
    });

    return event;
  }
}

export default TwilioProvider;
