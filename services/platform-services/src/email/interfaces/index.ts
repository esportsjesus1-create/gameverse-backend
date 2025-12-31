export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
  encoding?: 'base64' | 'utf8';
  contentId?: string;
  disposition?: 'attachment' | 'inline';
}

export interface EmailMessage {
  id?: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  from: EmailAddress;
  replyTo?: EmailAddress;
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  priority?: 'high' | 'normal' | 'low';
  tags?: string[];
  metadata?: Record<string, unknown>;
  trackOpens?: boolean;
  trackClicks?: boolean;
  scheduledAt?: Date;
}

export interface EmailSendResult {
  id: string;
  messageId: string;
  status: EmailDeliveryStatus;
  timestamp: Date;
  provider: string;
  recipients: {
    email: string;
    status: 'accepted' | 'rejected';
    reason?: string;
  }[];
}

export type EmailDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'deferred';

export interface EmailDeliveryEvent {
  id: string;
  emailId: string;
  messageId: string;
  status: EmailDeliveryStatus;
  timestamp: Date;
  recipient: string;
  details?: {
    bounceType?: 'hard' | 'soft' | 'undetermined';
    bounceSubType?: string;
    complaintType?: string;
    userAgent?: string;
    ipAddress?: string;
    linkUrl?: string;
    reason?: string;
  };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  category?: string;
  description?: string;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface EmailTemplateRenderResult {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProviderConfig {
  provider: 'sendgrid' | 'ses' | 'mock';
  apiKey?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  defaultFrom?: EmailAddress;
  sandbox?: boolean;
}

export interface IEmailProvider {
  name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
  sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]>;
  getDeliveryStatus(messageId: string): Promise<EmailDeliveryEvent[]>;
  validateEmail(email: string): Promise<{ valid: boolean; reason?: string }>;
}

export interface IEmailTemplateService {
  create(
    template: Omit<EmailTemplate, 'id' | 'version' | 'createdAt' | 'updatedAt'>
  ): Promise<EmailTemplate>;
  update(id: string, template: Partial<EmailTemplate>): Promise<EmailTemplate>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<EmailTemplate | null>;
  getByName(name: string): Promise<EmailTemplate | null>;
  list(filter?: { category?: string; isActive?: boolean }): Promise<EmailTemplate[]>;
  render(templateId: string, data: Record<string, unknown>): Promise<EmailTemplateRenderResult>;
}

export interface IEmailQueueService {
  enqueue(message: EmailMessage, priority?: number): Promise<string>;
  dequeue(count?: number): Promise<EmailMessage[]>;
  getStatus(queueId: string): Promise<{ status: string; position?: number }>;
  cancel(queueId: string): Promise<boolean>;
  getQueueLength(): Promise<number>;
  processQueue(): Promise<void>;
}

export interface EmailServiceConfig {
  provider: EmailProviderConfig;
  defaultFrom: EmailAddress;
  maxRecipientsPerEmail?: number;
  maxAttachmentSize?: number;
  maxAttachments?: number;
  rateLimitPerMinute?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  trackOpens?: boolean;
  trackClicks?: boolean;
}
