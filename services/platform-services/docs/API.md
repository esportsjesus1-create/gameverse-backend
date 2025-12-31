# Platform Services API Documentation

## Overview

The Platform Services module provides infrastructure services for the GameVerse platform, including email, SMS, file storage, and configuration management. This module operates as a complementary layer on top of GamerStake and does NOT integrate with GamerStake modules (Wallet, Auth, NFT, Marketplace, Gacha).

## Table of Contents

1. [Email Service](#email-service)
2. [SMS Service](#sms-service)
3. [Storage Service](#storage-service)
4. [Configuration Service](#configuration-service)
5. [Feature Flags Service](#feature-flags-service)
6. [Secrets Service](#secrets-service)
7. [Error Codes](#error-codes)
8. [Rate Limiting](#rate-limiting)

---

## Email Service

### Functional Requirements

#### FR-EMAIL-001: Send Email
Send a single email with support for HTML and plain text content.

```typescript
emailService.send({
  to: string[];           // Required: recipient email addresses
  cc?: string[];          // Optional: CC recipients
  bcc?: string[];         // Optional: BCC recipients
  from?: string;          // Optional: sender address (uses default if not provided)
  replyTo?: string;       // Optional: reply-to address
  subject: string;        // Required: email subject
  html?: string;          // Optional: HTML content
  text?: string;          // Optional: plain text content
  templateId?: string;    // Optional: template ID for rendering
  templateData?: object;  // Optional: data for template rendering
  attachments?: Attachment[]; // Optional: file attachments
  priority?: 'high' | 'normal' | 'low'; // Optional: email priority
  tags?: string[];        // Optional: tags for tracking
  trackOpens?: boolean;   // Optional: track email opens
  trackClicks?: boolean;  // Optional: track link clicks
  scheduledAt?: string;   // Optional: ISO date for scheduled sending
}, userId?: string): Promise<EmailSendResult>
```

#### FR-EMAIL-002: Send Batch Emails
Send multiple emails in a single operation with error handling per email.

```typescript
emailService.sendBatch(
  requests: SendEmailRequest[],
  userId?: string
): Promise<{ results: EmailSendResult[]; errors: { index: number; error: string }[] }>
```

#### FR-EMAIL-003: Get Delivery Status
Retrieve delivery events for a sent email.

```typescript
emailService.getDeliveryStatus(emailId: string): Promise<EmailDeliveryEvent[]>
```

#### FR-EMAIL-004: Create Email Template
Create a reusable email template with variable placeholders.

```typescript
emailService.createTemplate({
  name: string;           // Required: unique template name
  subject: string;        // Required: email subject with {{variables}}
  htmlContent: string;    // Required: HTML content with {{variables}}
  textContent?: string;   // Optional: plain text content
  category?: string;      // Optional: template category
  description?: string;   // Optional: template description
  isActive?: boolean;     // Optional: whether template is active
  metadata?: object;      // Optional: additional metadata
}, userId?: string): Promise<EmailTemplate>
```

#### FR-EMAIL-005: Update Email Template
Update an existing email template.

```typescript
emailService.updateTemplate(
  id: string,
  updates: Partial<EmailTemplate>,
  userId?: string
): Promise<EmailTemplate>
```

#### FR-EMAIL-006: Delete Email Template
Delete an email template by ID.

```typescript
emailService.deleteTemplate(id: string, userId?: string): Promise<void>
```

#### FR-EMAIL-007: Get Email Template
Retrieve an email template by ID.

```typescript
emailService.getTemplate(id: string): Promise<EmailTemplate | null>
```

#### FR-EMAIL-008: Get Email Template by Name
Retrieve an email template by unique name.

```typescript
emailService.getTemplateByName(name: string): Promise<EmailTemplate | null>
```

#### FR-EMAIL-009: List Email Templates
List all email templates with optional filtering.

```typescript
emailService.listTemplates(filter?: {
  category?: string;
  isActive?: boolean;
}): Promise<EmailTemplate[]>
```

#### FR-EMAIL-010: Handle Delivery Webhook
Process delivery status webhooks from email providers.

```typescript
emailService.handleDeliveryEvent(event: EmailDeliveryEvent): void
```

---

## SMS Service

### Functional Requirements

#### FR-SMS-001: Send SMS
Send a single SMS message.

```typescript
smsService.send({
  to: string;             // Required: recipient phone number (E.164 format)
  from?: string;          // Optional: sender phone number
  body?: string;          // Optional: message content (required if no template)
  templateId?: string;    // Optional: template ID for rendering
  templateData?: object;  // Optional: data for template rendering
  mediaUrls?: string[];   // Optional: MMS media URLs
  scheduledAt?: string;   // Optional: ISO date for scheduled sending
  validityPeriod?: number; // Optional: message validity in seconds
  priority?: 'high' | 'normal' | 'low'; // Optional: message priority
  metadata?: object;      // Optional: additional metadata
}, userId?: string): Promise<SmsSendResult>
```

#### FR-SMS-002: Send Batch SMS
Send multiple SMS messages in a single operation.

```typescript
smsService.sendBatch(
  requests: SendSmsRequest[],
  userId?: string
): Promise<{ results: SmsSendResult[]; errors: { index: number; error: string }[] }>
```

#### FR-SMS-003: Get SMS Delivery Status
Retrieve delivery events for a sent SMS.

```typescript
smsService.getDeliveryStatus(smsId: string): Promise<SmsDeliveryEvent[]>
```

#### FR-SMS-004: Cancel SMS Message
Cancel a scheduled or queued SMS message.

```typescript
smsService.cancelMessage(messageId: string): Promise<boolean>
```

#### FR-SMS-005: Create Verification Code
Generate and send a verification code via SMS.

```typescript
smsService.createVerification(
  phoneNumber: string,
  options?: {
    channel?: 'sms' | 'call';
    codeLength?: number;
    expiresInMinutes?: number;
    locale?: string;
  },
  userId?: string
): Promise<{ verificationId: string; expiresAt: Date }>
```

#### FR-SMS-006: Verify Code
Validate a verification code.

```typescript
smsService.verifyCode(
  phoneNumber: string,
  code: string,
  userId?: string
): Promise<{ valid: boolean; verificationId?: string }>
```

#### FR-SMS-007: Cancel Verification
Cancel a pending verification.

```typescript
smsService.cancelVerification(phoneNumber: string): Promise<boolean>
```

#### FR-SMS-008: Get Verification Status
Get the status of a verification request.

```typescript
smsService.getVerificationStatus(phoneNumber: string): Promise<VerificationStatus | null>
```

#### FR-SMS-009: Create SMS Template
Create a reusable SMS template.

```typescript
smsService.createTemplate({
  name: string;           // Required: unique template name
  content: string;        // Required: message content with {{variables}}
  category?: string;      // Optional: template category
  description?: string;   // Optional: template description
  isActive?: boolean;     // Optional: whether template is active
  metadata?: object;      // Optional: additional metadata
}, userId?: string): Promise<SmsTemplate>
```

#### FR-SMS-010: Update SMS Template
Update an existing SMS template.

```typescript
smsService.updateTemplate(
  id: string,
  updates: Partial<SmsTemplate>,
  userId?: string
): Promise<SmsTemplate>
```

#### FR-SMS-011: Delete SMS Template
Delete an SMS template by ID.

```typescript
smsService.deleteTemplate(id: string, userId?: string): Promise<void>
```

#### FR-SMS-012: List SMS Templates
List all SMS templates with optional filtering.

```typescript
smsService.listTemplates(filter?: {
  category?: string;
  isActive?: boolean;
}): Promise<SmsTemplate[]>
```

---

## Storage Service

### Functional Requirements

#### FR-STORAGE-001: Upload File
Upload a file to storage.

```typescript
storageService.upload(
  file: Buffer | ReadableStream,
  filename: string,
  contentType: string,
  options?: {
    bucket?: string;
    path?: string;
    isPublic?: boolean;
    expiresAt?: Date;
    metadata?: Record<string, string>;
    tags?: Record<string, string>;
    contentDisposition?: string;
    cacheControl?: string;
    userId?: string;
  }
): Promise<FileMetadata>
```

#### FR-STORAGE-002: Download File
Download a file from storage.

```typescript
storageService.download(
  fileId: string,
  options?: {
    responseContentType?: string;
    responseContentDisposition?: string;
    versionId?: string;
    userId?: string;
  }
): Promise<Buffer>
```

#### FR-STORAGE-003: Delete File
Delete a file from storage.

```typescript
storageService.delete(fileId: string, userId?: string): Promise<void>
```

#### FR-STORAGE-004: Get File Metadata
Retrieve metadata for a file.

```typescript
storageService.getMetadata(fileId: string): Promise<FileMetadata | null>
```

#### FR-STORAGE-005: Update File Metadata
Update metadata for a file.

```typescript
storageService.updateMetadata(
  fileId: string,
  metadata: Record<string, string>,
  userId?: string
): Promise<FileMetadata>
```

#### FR-STORAGE-006: List Files
List files with optional filtering.

```typescript
storageService.list(options?: {
  bucket?: string;
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
  delimiter?: string;
  userId?: string;
}): Promise<ListResult>
```

#### FR-STORAGE-007: Generate Signed Upload URL
Generate a pre-signed URL for direct upload.

```typescript
storageService.getSignedUploadUrl(
  filename: string,
  contentType: string,
  options?: {
    expiresInSeconds?: number;
    path?: string;
    userId?: string;
  }
): Promise<{ url: string; key: string; expiresAt: Date }>
```

#### FR-STORAGE-008: Generate Signed Download URL
Generate a pre-signed URL for direct download.

```typescript
storageService.getSignedDownloadUrl(
  fileId: string,
  options?: {
    expiresInSeconds?: number;
    responseContentType?: string;
    contentDisposition?: string;
    userId?: string;
  }
): Promise<{ url: string; expiresAt: Date }>
```

#### FR-STORAGE-009: Copy File
Copy a file to a new location.

```typescript
storageService.copy(
  sourceFileId: string,
  destinationPath: string,
  userId?: string
): Promise<FileMetadata>
```

#### FR-STORAGE-010: Move File
Move a file to a new location.

```typescript
storageService.move(
  sourceFileId: string,
  destinationPath: string,
  userId?: string
): Promise<FileMetadata>
```

#### FR-STORAGE-011: Get User Quota
Get storage quota for a user.

```typescript
storageService.getQuota(userId: string): Promise<StorageQuota>
```

#### FR-STORAGE-012: Set User Quota
Set storage quota for a user.

```typescript
storageService.setQuota(
  userId: string,
  maxBytes: number,
  maxFileCount?: number
): Promise<StorageQuota>
```

---

## Configuration Service

### Functional Requirements

#### FR-CONFIG-001: Get Configuration Value
Retrieve a configuration value by key.

```typescript
configService.get<T>(key: string, defaultValue?: T): Promise<T>
```

#### FR-CONFIG-002: Set Configuration Value
Set a configuration value.

```typescript
configService.set(
  key: string,
  value: unknown,
  options?: {
    type?: 'string' | 'number' | 'boolean' | 'json' | 'array';
    description?: string;
    isSecret?: boolean;
    environment?: string;
    validFrom?: Date;
    validUntil?: Date;
    metadata?: object;
  }
): Promise<ConfigValue>
```

#### FR-CONFIG-003: Delete Configuration Value
Delete a configuration value.

```typescript
configService.delete(key: string): Promise<void>
```

#### FR-CONFIG-004: List Configuration Values
List all configuration values with optional filtering.

```typescript
configService.list(filter?: {
  environment?: string;
  isSecret?: boolean;
  prefix?: string;
}): Promise<ConfigValue[]>
```

#### FR-CONFIG-005: Get All Non-Secret Configurations
Get all non-secret configuration values as a key-value object.

```typescript
configService.getAll(): Promise<Record<string, unknown>>
```

#### FR-CONFIG-006: Reload Configurations
Reload all configurations from sources.

```typescript
configService.reload(): Promise<void>
```

---

## Feature Flags Service

### Functional Requirements

#### FR-FF-001: Check Feature Flag
Check if a feature flag is enabled for a given context.

```typescript
featureFlagService.isEnabled(
  flagName: string,
  context?: {
    userId?: string;
    userGroups?: string[];
    attributes?: Record<string, unknown>;
  }
): Promise<boolean>
```

#### FR-FF-002: Evaluate Feature Flag
Evaluate a feature flag with detailed reasoning.

```typescript
featureFlagService.evaluate(
  flagName: string,
  context?: FeatureFlagContext
): Promise<{
  enabled: boolean;
  reason: 'default' | 'user_targeted' | 'group_targeted' | 'condition_matched' | 'rollout' | 'disabled';
  flagName: string;
  timestamp: Date;
}>
```

#### FR-FF-003: Get Feature Flag
Retrieve a feature flag by name.

```typescript
featureFlagService.getFlag(flagName: string): Promise<FeatureFlag | null>
```

#### FR-FF-004: Set Feature Flag
Create or update a feature flag.

```typescript
featureFlagService.setFlag({
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[];
  targetGroups: string[];
  conditions: FeatureFlagCondition[];
  metadata?: object;
}): Promise<FeatureFlag>
```

#### FR-FF-005: Delete Feature Flag
Delete a feature flag.

```typescript
featureFlagService.deleteFlag(flagName: string): Promise<void>
```

#### FR-FF-006: List Feature Flags
List all feature flags with optional filtering.

```typescript
featureFlagService.listFlags(filter?: {
  enabled?: boolean;
  prefix?: string;
}): Promise<FeatureFlag[]>
```

---

## Secrets Service

### Functional Requirements

#### FR-SECRET-001: Get Secret
Retrieve a secret value.

```typescript
secretService.get(name: string): Promise<string | null>
```

#### FR-SECRET-002: Set Secret
Create or update a secret.

```typescript
secretService.set(
  name: string,
  value: string,
  options?: {
    description?: string;
    environment?: string;
    expiresAt?: Date;
    rotationPolicy?: {
      enabled: boolean;
      intervalDays?: number;
    };
    metadata?: object;
  }
): Promise<Secret>
```

#### FR-SECRET-003: Delete Secret
Delete a secret.

```typescript
secretService.delete(name: string): Promise<void>
```

#### FR-SECRET-004: List Secrets
List all secrets (without values).

```typescript
secretService.list(): Promise<Omit<Secret, 'value'>[]>
```

#### FR-SECRET-005: Rotate Secret
Rotate a secret with a new value.

```typescript
secretService.rotate(name: string, newValue: string): Promise<Secret>
```

#### FR-SECRET-006: Get Secret Metadata
Get secret metadata without the value.

```typescript
secretService.getMetadata(name: string): Promise<Omit<Secret, 'value'> | null>
```

#### FR-SECRET-007: Check Rotation Due
Get list of secrets due for rotation.

```typescript
secretService.checkRotationDue(): Promise<string[]>
```

#### FR-SECRET-008: Check Expired Secrets
Get list of expired secrets.

```typescript
secretService.checkExpired(): Promise<string[]>
```

---

## Error Codes

The Platform Services module uses 40+ domain-specific error codes:

### Email Errors
- `EMAIL_SEND_FAILED` - Failed to send email
- `EMAIL_TEMPLATE_ERROR` - Template processing error
- `EMAIL_RATE_LIMITED` - Rate limit exceeded
- `EMAIL_INVALID_RECIPIENT` - Invalid recipient address
- `EMAIL_ATTACHMENT_ERROR` - Attachment validation error
- `EMAIL_DELIVERY_FAILED` - Delivery failure
- `EMAIL_PROVIDER_ERROR` - Provider communication error

### SMS Errors
- `SMS_SEND_FAILED` - Failed to send SMS
- `SMS_TEMPLATE_ERROR` - Template processing error
- `SMS_RATE_LIMITED` - Rate limit exceeded
- `SMS_INVALID_PHONE` - Invalid phone number
- `SMS_VERIFICATION_FAILED` - Verification failure
- `SMS_DELIVERY_FAILED` - Delivery failure
- `SMS_PROVIDER_ERROR` - Provider communication error

### Storage Errors
- `STORAGE_UPLOAD_FAILED` - Upload failure
- `STORAGE_DOWNLOAD_FAILED` - Download failure
- `STORAGE_DELETE_FAILED` - Delete failure
- `STORAGE_FILE_NOT_FOUND` - File not found
- `STORAGE_QUOTA_EXCEEDED` - Quota exceeded
- `STORAGE_FILE_TOO_LARGE` - File size exceeded
- `STORAGE_INVALID_FILE_TYPE` - Invalid file type
- `STORAGE_SIGNED_URL_ERROR` - Signed URL generation error
- `STORAGE_PROVIDER_ERROR` - Provider communication error

### Config Errors
- `CONFIG_NOT_FOUND` - Configuration not found
- `CONFIG_VALIDATION_ERROR` - Validation error
- `CONFIG_UPDATE_FAILED` - Update failure
- `CONFIG_FEATURE_FLAG_ERROR` - Feature flag error
- `CONFIG_SECRET_ERROR` - Secret management error

### General Errors
- `VALIDATION_ERROR` - Input validation error
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `AUTHENTICATION_ERROR` - Authentication failure
- `AUTHORIZATION_ERROR` - Authorization failure
- `SERVICE_UNAVAILABLE` - Service unavailable
- `TIMEOUT_ERROR` - Operation timeout
- `NETWORK_ERROR` - Network communication error

---

## Rate Limiting

The Platform Services module implements 3-tier rate limiting:

### Global Rate Limit
- Applies to all requests across the platform
- Default: 10,000 requests per minute

### Service Rate Limit
- Applies per service (email, sms, storage, config)
- Default: 1,000 requests per minute per service

### User Rate Limit
- Applies per user per service
- Default: 100 requests per minute per user

### Rate Limit Response
When rate limited, the API returns:
- HTTP Status: 429 Too Many Requests
- Headers:
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp
  - `Retry-After`: Seconds until retry allowed

---

## Event Types

The Platform Services module logs 30+ event types for audit trails and monitoring:

### Email Events
- `EMAIL_SEND_SUCCESS`, `EMAIL_SEND_FAILED`
- `EMAIL_TEMPLATE_CREATED`, `EMAIL_TEMPLATE_UPDATED`, `EMAIL_TEMPLATE_DELETED`, `EMAIL_TEMPLATE_RENDERED`
- `EMAIL_DELIVERY_STATUS_UPDATED`

### SMS Events
- `SMS_SEND_SUCCESS`, `SMS_SEND_FAILED`
- `SMS_TEMPLATE_CREATED`, `SMS_TEMPLATE_UPDATED`, `SMS_TEMPLATE_DELETED`, `SMS_TEMPLATE_RENDERED`
- `SMS_DELIVERY_STATUS_UPDATED`
- `SMS_VERIFICATION_CREATED`, `SMS_VERIFICATION_VALIDATED`, `SMS_VERIFICATION_FAILED`, `SMS_VERIFICATION_EXPIRED`

### Storage Events
- `STORAGE_UPLOAD_INITIATED`, `STORAGE_UPLOAD_SUCCESS`, `STORAGE_UPLOAD_FAILED`
- `STORAGE_DOWNLOAD_INITIATED`, `STORAGE_DOWNLOAD_SUCCESS`, `STORAGE_DOWNLOAD_FAILED`
- `STORAGE_DELETE_INITIATED`, `STORAGE_DELETE_SUCCESS`, `STORAGE_DELETE_FAILED`
- `STORAGE_SIGNED_URL_GENERATED`, `STORAGE_METADATA_UPDATED`

### Config Events
- `CONFIG_LOADED`, `CONFIG_UPDATED`
- `CONFIG_SECRET_ACCESSED`, `CONFIG_SECRET_UPDATED`, `CONFIG_SECRET_ROTATED`
- `FEATURE_FLAG_CHECKED`, `FEATURE_FLAG_UPDATED`

### System Events
- `RATE_LIMIT_CHECKED`, `RATE_LIMIT_EXCEEDED`
- `SERVICE_INITIALIZED`, `SERVICE_SHUTDOWN`

---

## Security

### Input Sanitization
All inputs are sanitized to prevent:
- XSS attacks (HTML escaping, script removal)
- SQL injection (quote escaping, comment removal)
- Path traversal (path normalization, null byte removal)

### File Security
- Blocked file types: `.exe`, `.bat`, `.cmd`, `.scr`, `.pif`, `.js`, `.vbs`
- Maximum file size enforcement
- Content type validation
- Secure filename sanitization

### Secret Management
- AES-256-GCM encryption for stored secrets
- Automatic secret detection in environment variables
- Rotation policy support
- Expiration tracking

---

## Usage Example

```typescript
import { PlatformServices } from '@gameverse/platform-services';

const platform = new PlatformServices({
  serviceName: 'gameverse-api',
  environment: 'production',
  email: {
    provider: { provider: 'sendgrid', apiKey: process.env.SENDGRID_API_KEY },
    defaultFrom: 'noreply@gameverse.com',
  },
  sms: {
    provider: { provider: 'twilio', accountSid: '...', authToken: '...' },
    defaultFrom: '+14155559999',
  },
  storage: {
    provider: { provider: 's3', region: 'us-east-1', bucket: 'gameverse-files' },
    defaultBucket: 'gameverse-files',
    maxFileSize: 100 * 1024 * 1024,
  },
  config: {
    environment: 'production',
  },
});

await platform.initialize();

// Send email
await platform.email.send({
  to: ['user@example.com'],
  subject: 'Welcome to GameVerse!',
  html: '<h1>Welcome!</h1>',
});

// Send verification SMS
const { verificationId } = await platform.sms.createVerification('+14155551234');

// Upload file
const file = await platform.storage.upload(
  Buffer.from('content'),
  'document.pdf',
  'application/pdf'
);

// Check feature flag
const isEnabled = await platform.featureFlags.isEnabled('new-feature', {
  userId: 'user-123',
});
```
