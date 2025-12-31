export interface SmsMessage {
  id?: string;
  to: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
  scheduledAt?: Date;
  validityPeriod?: number;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, unknown>;
}

export interface SmsSendResult {
  id: string;
  messageId: string;
  status: SmsDeliveryStatus;
  timestamp: Date;
  provider: string;
  to: string;
  from: string;
  segments?: number;
  price?: {
    amount: number;
    currency: string;
  };
}

export type SmsDeliveryStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'undelivered'
  | 'failed'
  | 'canceled';

export interface SmsDeliveryEvent {
  id: string;
  smsId: string;
  messageId: string;
  status: SmsDeliveryStatus;
  timestamp: Date;
  to: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  category?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface VerificationCode {
  id: string;
  phoneNumber: string;
  code: string;
  channel: 'sms' | 'call';
  status: 'pending' | 'verified' | 'expired' | 'failed';
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  createdAt: Date;
  verifiedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface SmsProviderConfig {
  provider: 'twilio' | 'mock';
  accountSid?: string;
  authToken?: string;
  defaultFrom?: string;
  messagingServiceSid?: string;
  sandbox?: boolean;
}

export interface ISmsProvider {
  name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
  sendBatch(messages: SmsMessage[]): Promise<SmsSendResult[]>;
  getDeliveryStatus(messageId: string): Promise<SmsDeliveryEvent[]>;
  cancelMessage(messageId: string): Promise<boolean>;
}

export interface ISmsTemplateService {
  create(template: Omit<SmsTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<SmsTemplate>;
  update(id: string, template: Partial<SmsTemplate>): Promise<SmsTemplate>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<SmsTemplate | null>;
  getByName(name: string): Promise<SmsTemplate | null>;
  list(filter?: { category?: string; isActive?: boolean }): Promise<SmsTemplate[]>;
  render(templateId: string, data: Record<string, unknown>): Promise<string>;
}

export interface IVerificationService {
  create(
    phoneNumber: string,
    options?: {
      channel?: 'sms' | 'call';
      codeLength?: number;
      expiresInMinutes?: number;
      locale?: string;
    }
  ): Promise<{ verificationId: string; expiresAt: Date }>;
  verify(phoneNumber: string, code: string): Promise<{ valid: boolean; verificationId?: string }>;
  cancel(phoneNumber: string): Promise<boolean>;
  getStatus(phoneNumber: string): Promise<VerificationCode | null>;
}

export interface SmsServiceConfig {
  provider: SmsProviderConfig;
  defaultFrom: string;
  maxMessageLength?: number;
  rateLimitPerMinute?: number;
  verificationCodeLength?: number;
  verificationExpiresMinutes?: number;
  verificationMaxAttempts?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}
