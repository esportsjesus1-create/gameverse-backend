import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Phone number must be in E.164 format (e.g., +14155552671)');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const urlSchema = z.string().url('Invalid URL format');

export const dateSchema = z.coerce.date();

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const sendEmailRequestSchema = z
  .object({
    to: z.union([emailSchema, z.array(emailSchema).min(1).max(50)]),
    cc: z.array(emailSchema).max(10).optional(),
    bcc: z.array(emailSchema).max(10).optional(),
    subject: z.string().min(1).max(998),
    body: z.string().min(1).max(100000).optional(),
    templateId: z.string().optional(),
    templateData: z.record(z.unknown()).optional(),
    from: z
      .object({
        email: emailSchema,
        name: z.string().max(100).optional(),
      })
      .optional(),
    replyTo: emailSchema.optional(),
    attachments: z
      .array(
        z.object({
          filename: z.string().min(1).max(255),
          content: z.string(),
          contentType: z.string(),
          encoding: z.enum(['base64', 'utf8']).default('base64'),
        })
      )
      .max(10)
      .optional(),
    headers: z.record(z.string()).optional(),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    scheduledAt: dateSchema.optional(),
    trackOpens: z.boolean().default(true),
    trackClicks: z.boolean().default(true),
    tags: z.array(z.string().max(50)).max(10).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((data) => data.body || data.templateId, {
    message: 'Either body or templateId must be provided',
  });

export const emailTemplateSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(998),
  htmlContent: z.string().min(1).max(500000),
  textContent: z.string().max(100000).optional(),
  variables: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const emailDeliveryStatusSchema = z.object({
  emailId: uuidSchema,
  status: z.enum([
    'queued',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'complained',
    'failed',
  ]),
  timestamp: dateSchema,
  details: z.record(z.unknown()).optional(),
});

export const sendSmsRequestSchema = z
  .object({
    to: phoneSchema,
    body: z.string().min(1).max(1600).optional(),
    templateId: z.string().optional(),
    templateData: z.record(z.unknown()).optional(),
    from: z.string().optional(),
    mediaUrls: z.array(urlSchema).max(10).optional(),
    scheduledAt: dateSchema.optional(),
    validityPeriod: z.number().int().min(1).max(14400).optional(),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((data) => data.body || data.templateId, {
    message: 'Either body or templateId must be provided',
  });

export const smsTemplateSchema = z.object({
  id: uuidSchema.optional(),
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(1600),
  variables: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

export const verificationRequestSchema = z.object({
  phoneNumber: phoneSchema,
  channel: z.enum(['sms', 'call']).default('sms'),
  codeLength: z.number().int().min(4).max(10).default(6),
  expiresInMinutes: z.number().int().min(1).max(60).default(10),
  locale: z.string().max(10).default('en'),
  metadata: z.record(z.unknown()).optional(),
});

export const verificationCheckSchema = z.object({
  phoneNumber: phoneSchema,
  code: z.string().min(4).max(10),
});

export const fileUploadRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100),
  size: z.number().int().min(1),
  bucket: z.string().min(1).max(63).optional(),
  path: z.string().max(1024).optional(),
  isPublic: z.boolean().default(false),
  expiresAt: dateSchema.optional(),
  metadata: z.record(z.string()).optional(),
  tags: z.record(z.string()).optional(),
});

export const fileMetadataSchema = z.object({
  id: uuidSchema,
  filename: z.string(),
  originalFilename: z.string(),
  contentType: z.string(),
  size: z.number().int(),
  bucket: z.string(),
  key: z.string(),
  url: urlSchema.optional(),
  isPublic: z.boolean(),
  uploadedBy: z.string().optional(),
  uploadedAt: dateSchema,
  expiresAt: dateSchema.optional(),
  checksum: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  tags: z.record(z.string()).optional(),
});

export const signedUrlRequestSchema = z.object({
  fileKey: z.string().min(1).max(1024),
  operation: z.enum(['get', 'put']),
  expiresInSeconds: z.number().int().min(60).max(604800).default(3600),
  contentType: z.string().optional(),
  contentDisposition: z.string().optional(),
});

export const fileListRequestSchema = z.object({
  bucket: z.string().optional(),
  prefix: z.string().max(1024).optional(),
  maxKeys: z.number().int().min(1).max(1000).default(100),
  continuationToken: z.string().optional(),
  uploadedBy: z.string().optional(),
  contentType: z.string().optional(),
  minSize: z.number().int().optional(),
  maxSize: z.number().int().optional(),
  uploadedAfter: dateSchema.optional(),
  uploadedBefore: dateSchema.optional(),
});

export const configValueSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
  type: z.enum(['string', 'number', 'boolean', 'json', 'array']),
  description: z.string().max(500).optional(),
  isSecret: z.boolean().default(false),
  environment: z.string().optional(),
  validFrom: dateSchema.optional(),
  validUntil: dateSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const featureFlagSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).default(0),
  targetUsers: z.array(z.string()).optional(),
  targetGroups: z.array(z.string()).optional(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum([
          'eq',
          'ne',
          'gt',
          'gte',
          'lt',
          'lte',
          'in',
          'nin',
          'contains',
          'startsWith',
          'endsWith',
        ]),
        value: z.unknown(),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export const secretSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Secret name must be alphanumeric with underscores'),
  value: z.string().min(1),
  description: z.string().max(500).optional(),
  environment: z.string().optional(),
  expiresAt: dateSchema.optional(),
  rotationPolicy: z
    .object({
      enabled: z.boolean().default(false),
      intervalDays: z.number().int().min(1).max(365).optional(),
      lastRotatedAt: dateSchema.optional(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const rateLimitConfigSchema = z.object({
  tier: z.enum(['global', 'service', 'user']),
  identifier: z.string(),
  maxRequests: z.number().int().min(1),
  windowMs: z.number().int().min(1000),
  blockDurationMs: z.number().int().min(0).optional(),
  skipFailedRequests: z.boolean().default(false),
  skipSuccessfulRequests: z.boolean().default(false),
  keyGenerator: z.function().optional(),
});

export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .optional(),
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        hasMore: z.boolean().optional(),
      })
      .optional(),
  });

export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>;
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export type EmailDeliveryStatus = z.infer<typeof emailDeliveryStatusSchema>;
export type SendSmsRequest = z.infer<typeof sendSmsRequestSchema>;
export type SmsTemplate = z.infer<typeof smsTemplateSchema>;
export type VerificationRequest = z.infer<typeof verificationRequestSchema>;
export type VerificationCheck = z.infer<typeof verificationCheckSchema>;
export type FileUploadRequest = z.infer<typeof fileUploadRequestSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type SignedUrlRequest = z.infer<typeof signedUrlRequestSchema>;
export type FileListRequest = z.infer<typeof fileListRequestSchema>;
export type ConfigValue = z.infer<typeof configValueSchema>;
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
export type Secret = z.infer<typeof secretSchema>;
export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;
export type Pagination = z.infer<typeof paginationSchema>;

export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
  }
  return result.data;
}

export function validateSafe<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError['errors'] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.errors };
}
