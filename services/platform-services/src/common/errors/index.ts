export class PlatformError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly timestamp: Date;
  public readonly correlationId?: string;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown,
    correlationId?: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date();
    this.correlationId = correlationId;

    Object.setPrototypeOf(this, PlatformError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
        correlationId: this.correlationId,
      },
    };
  }
}

export class EmailError extends PlatformError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, 500, code, true, details);
  }
}

export class EmailProviderError extends EmailError {
  constructor(provider: string, originalError?: unknown) {
    super(`Email provider ${provider} error`, 'EMAIL_PROVIDER_ERROR', { provider, originalError });
  }
}

export class EmailTemplateNotFoundError extends EmailError {
  constructor(templateId: string) {
    super(`Email template ${templateId} not found`, 'EMAIL_TEMPLATE_NOT_FOUND', { templateId });
  }
}

export class EmailTemplateRenderError extends EmailError {
  constructor(templateId: string, reason: string) {
    super(
      `Failed to render email template ${templateId}: ${reason}`,
      'EMAIL_TEMPLATE_RENDER_ERROR',
      { templateId, reason }
    );
  }
}

export class EmailDeliveryError extends EmailError {
  constructor(emailId: string, reason: string) {
    super(`Email delivery failed for ${emailId}: ${reason}`, 'EMAIL_DELIVERY_ERROR', {
      emailId,
      reason,
    });
  }
}

export class EmailBounceError extends EmailError {
  constructor(emailId: string, bounceType: string) {
    super(`Email ${emailId} bounced: ${bounceType}`, 'EMAIL_BOUNCE_ERROR', { emailId, bounceType });
  }
}

export class EmailComplaintError extends EmailError {
  constructor(emailId: string, complaintType: string) {
    super(`Email ${emailId} received complaint: ${complaintType}`, 'EMAIL_COMPLAINT_ERROR', {
      emailId,
      complaintType,
    });
  }
}

export class EmailRateLimitError extends EmailError {
  constructor(recipient: string) {
    super(`Rate limit exceeded for recipient ${recipient}`, 'EMAIL_RATE_LIMIT_EXCEEDED', {
      recipient,
    });
  }
}

export class EmailInvalidRecipientError extends EmailError {
  constructor(recipient: string, reason: string) {
    super(`Invalid recipient ${recipient}: ${reason}`, 'EMAIL_INVALID_RECIPIENT', {
      recipient,
      reason,
    });
  }
}

export class EmailAttachmentError extends EmailError {
  constructor(filename: string, reason: string) {
    super(`Email attachment error for ${filename}: ${reason}`, 'EMAIL_ATTACHMENT_ERROR', {
      filename,
      reason,
    });
  }
}

export class EmailQueueError extends EmailError {
  constructor(operation: string, reason: string) {
    super(`Email queue ${operation} failed: ${reason}`, 'EMAIL_QUEUE_ERROR', { operation, reason });
  }
}

export class SmsError extends PlatformError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, 500, code, true, details);
  }
}

export class SmsProviderError extends SmsError {
  constructor(provider: string, originalError?: unknown) {
    super(`SMS provider ${provider} error`, 'SMS_PROVIDER_ERROR', { provider, originalError });
  }
}

export class SmsDeliveryError extends SmsError {
  constructor(messageId: string, reason: string) {
    super(`SMS delivery failed for ${messageId}: ${reason}`, 'SMS_DELIVERY_ERROR', {
      messageId,
      reason,
    });
  }
}

export class SmsInvalidPhoneError extends SmsError {
  constructor(phoneNumber: string) {
    super(`Invalid phone number: ${phoneNumber}`, 'SMS_INVALID_PHONE', { phoneNumber });
  }
}

export class SmsVerificationExpiredError extends SmsError {
  constructor(phoneNumber: string) {
    super(`Verification code expired for ${phoneNumber}`, 'SMS_VERIFICATION_EXPIRED', {
      phoneNumber,
    });
  }
}

export class SmsVerificationInvalidError extends SmsError {
  constructor(phoneNumber: string) {
    super(`Invalid verification code for ${phoneNumber}`, 'SMS_VERIFICATION_INVALID', {
      phoneNumber,
    });
  }
}

export class SmsVerificationMaxAttemptsError extends SmsError {
  constructor(phoneNumber: string) {
    super(
      `Max verification attempts exceeded for ${phoneNumber}`,
      'SMS_VERIFICATION_MAX_ATTEMPTS',
      { phoneNumber }
    );
  }
}

export class SmsRateLimitError extends SmsError {
  constructor(phoneNumber: string) {
    super(`Rate limit exceeded for phone ${phoneNumber}`, 'SMS_RATE_LIMIT_EXCEEDED', {
      phoneNumber,
    });
  }
}

export class SmsTemplateNotFoundError extends SmsError {
  constructor(templateId: string) {
    super(`SMS template ${templateId} not found`, 'SMS_TEMPLATE_NOT_FOUND', { templateId });
  }
}

export class SmsCountryNotSupportedError extends SmsError {
  constructor(countryCode: string) {
    super(`Country ${countryCode} not supported for SMS`, 'SMS_COUNTRY_NOT_SUPPORTED', {
      countryCode,
    });
  }
}

export class StorageError extends PlatformError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, 500, code, true, details);
  }
}

export class StorageProviderError extends StorageError {
  constructor(provider: string, originalError?: unknown) {
    super(`Storage provider ${provider} error`, 'STORAGE_PROVIDER_ERROR', {
      provider,
      originalError,
    });
  }
}

export class StorageFileNotFoundError extends StorageError {
  constructor(fileKey: string) {
    super(`File ${fileKey} not found`, 'STORAGE_FILE_NOT_FOUND', { fileKey });
  }
}

export class StorageUploadError extends StorageError {
  constructor(filename: string, reason: string) {
    super(`Upload failed for ${filename}: ${reason}`, 'STORAGE_UPLOAD_ERROR', { filename, reason });
  }
}

export class StorageDownloadError extends StorageError {
  constructor(fileKey: string, reason: string) {
    super(`Download failed for ${fileKey}: ${reason}`, 'STORAGE_DOWNLOAD_ERROR', {
      fileKey,
      reason,
    });
  }
}

export class StorageDeleteError extends StorageError {
  constructor(fileKey: string, reason: string) {
    super(`Delete failed for ${fileKey}: ${reason}`, 'STORAGE_DELETE_ERROR', { fileKey, reason });
  }
}

export class StorageQuotaExceededError extends StorageError {
  constructor(userId: string, currentUsage: number, quota: number) {
    super(`Storage quota exceeded for user ${userId}`, 'STORAGE_QUOTA_EXCEEDED', {
      userId,
      currentUsage,
      quota,
    });
  }
}

export class StorageFileTooLargeError extends StorageError {
  constructor(filename: string, size: number, maxSize: number) {
    super(`File ${filename} exceeds max size`, 'STORAGE_FILE_TOO_LARGE', {
      filename,
      size,
      maxSize,
    });
  }
}

export class StorageInvalidFileTypeError extends StorageError {
  constructor(filename: string, mimeType: string, allowedTypes: string[]) {
    super(`Invalid file type for ${filename}`, 'STORAGE_INVALID_FILE_TYPE', {
      filename,
      mimeType,
      allowedTypes,
    });
  }
}

export class StorageSignedUrlError extends StorageError {
  constructor(fileKey: string, reason: string) {
    super(`Failed to generate signed URL for ${fileKey}: ${reason}`, 'STORAGE_SIGNED_URL_ERROR', {
      fileKey,
      reason,
    });
  }
}

export class StorageMetadataError extends StorageError {
  constructor(fileKey: string, reason: string) {
    super(`Metadata operation failed for ${fileKey}: ${reason}`, 'STORAGE_METADATA_ERROR', {
      fileKey,
      reason,
    });
  }
}

export class StorageBucketError extends StorageError {
  constructor(bucket: string, operation: string) {
    super(`Bucket ${bucket} ${operation} failed`, 'STORAGE_BUCKET_ERROR', { bucket, operation });
  }
}

export class ConfigError extends PlatformError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, 500, code, true, details);
  }
}

export class ConfigNotFoundError extends ConfigError {
  constructor(key: string) {
    super(`Configuration ${key} not found`, 'CONFIG_NOT_FOUND', { key });
  }
}

export class ConfigValidationError extends ConfigError {
  constructor(key: string, reason: string) {
    super(`Configuration validation failed for ${key}: ${reason}`, 'CONFIG_VALIDATION_ERROR', {
      key,
      reason,
    });
  }
}

export class ConfigSecretAccessError extends ConfigError {
  constructor(secretName: string) {
    super(`Failed to access secret ${secretName}`, 'CONFIG_SECRET_ACCESS_ERROR', { secretName });
  }
}

export class ConfigSecretError extends ConfigError {
  constructor(secretName: string, reason: string) {
    super(`Secret ${secretName} error: ${reason}`, 'CONFIG_SECRET_ERROR', { secretName, reason });
  }
}

export class ConfigFeatureFlagError extends ConfigError {
  constructor(flagName: string, reason: string) {
    super(`Feature flag ${flagName} error: ${reason}`, 'CONFIG_FEATURE_FLAG_ERROR', {
      flagName,
      reason,
    });
  }
}

export class ConfigEnvironmentError extends ConfigError {
  constructor(environment: string, reason: string) {
    super(`Environment ${environment} configuration error: ${reason}`, 'CONFIG_ENVIRONMENT_ERROR', {
      environment,
      reason,
    });
  }
}

export class ConfigUpdateError extends ConfigError {
  constructor(key: string, reason: string) {
    super(`Failed to update configuration ${key}: ${reason}`, 'CONFIG_UPDATE_ERROR', {
      key,
      reason,
    });
  }
}

export class ValidationError extends PlatformError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}

export class ValidationSchemaError extends ValidationError {
  constructor(schema: string, errors: unknown[]) {
    super(`Schema validation failed for ${schema}`, { schema, errors });
  }
}

export class ValidationInputError extends ValidationError {
  constructor(field: string, reason: string) {
    super(`Invalid input for ${field}: ${reason}`, { field, reason });
  }
}

export class ValidationFormatError extends ValidationError {
  constructor(field: string, expectedFormat: string) {
    super(`Invalid format for ${field}, expected ${expectedFormat}`, { field, expectedFormat });
  }
}

export class SecurityError extends PlatformError {
  constructor(message: string, code: string, details?: unknown) {
    super(message, 403, code, true, details);
  }
}

export class SecurityRateLimitError extends SecurityError {
  constructor(identifier: string, tier: string) {
    super(`Rate limit exceeded for ${identifier} at ${tier} tier`, 'SECURITY_RATE_LIMIT', {
      identifier,
      tier,
    });
  }
}

export class SecurityInputSanitizationError extends SecurityError {
  constructor(field: string, reason: string) {
    super(`Input sanitization failed for ${field}: ${reason}`, 'SECURITY_INPUT_SANITIZATION', {
      field,
      reason,
    });
  }
}

export class SecurityUnauthorizedError extends SecurityError {
  constructor(resource: string, action: string) {
    super(`Unauthorized ${action} on ${resource}`, 'SECURITY_UNAUTHORIZED', { resource, action });
  }
}

export class SecurityForbiddenError extends SecurityError {
  constructor(resource: string, reason: string) {
    super(`Access forbidden to ${resource}: ${reason}`, 'SECURITY_FORBIDDEN', { resource, reason });
  }
}

export class SecurityTokenError extends SecurityError {
  constructor(tokenType: string, reason: string) {
    super(`${tokenType} token error: ${reason}`, 'SECURITY_TOKEN_ERROR', { tokenType, reason });
  }
}

export class InternalError extends PlatformError {
  constructor(message: string, details?: unknown) {
    super(message, 500, 'INTERNAL_ERROR', false, details);
  }
}

export class ServiceUnavailableError extends PlatformError {
  constructor(service: string, reason?: string) {
    super(
      `Service ${service} unavailable${reason ? `: ${reason}` : ''}`,
      503,
      'SERVICE_UNAVAILABLE',
      true,
      { service, reason }
    );
  }
}

export class TimeoutError extends PlatformError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation ${operation} timed out after ${timeoutMs}ms`, 504, 'TIMEOUT_ERROR', true, {
      operation,
      timeoutMs,
    });
  }
}

export class DependencyError extends PlatformError {
  constructor(dependency: string, reason: string) {
    super(`Dependency ${dependency} error: ${reason}`, 502, 'DEPENDENCY_ERROR', true, {
      dependency,
      reason,
    });
  }
}

export function isPlatformError(error: unknown): error is PlatformError {
  return error instanceof PlatformError;
}

export function handleError(error: unknown): PlatformError {
  if (isPlatformError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message, { originalError: error.name });
  }

  return new InternalError('An unexpected error occurred');
}

export const ErrorCodes = {
  EMAIL_PROVIDER_ERROR: 'EMAIL_PROVIDER_ERROR',
  EMAIL_TEMPLATE_NOT_FOUND: 'EMAIL_TEMPLATE_NOT_FOUND',
  EMAIL_TEMPLATE_RENDER_ERROR: 'EMAIL_TEMPLATE_RENDER_ERROR',
  EMAIL_DELIVERY_ERROR: 'EMAIL_DELIVERY_ERROR',
  EMAIL_BOUNCE_ERROR: 'EMAIL_BOUNCE_ERROR',
  EMAIL_COMPLAINT_ERROR: 'EMAIL_COMPLAINT_ERROR',
  EMAIL_RATE_LIMIT_EXCEEDED: 'EMAIL_RATE_LIMIT_EXCEEDED',
  EMAIL_INVALID_RECIPIENT: 'EMAIL_INVALID_RECIPIENT',
  EMAIL_ATTACHMENT_ERROR: 'EMAIL_ATTACHMENT_ERROR',
  EMAIL_QUEUE_ERROR: 'EMAIL_QUEUE_ERROR',
  SMS_PROVIDER_ERROR: 'SMS_PROVIDER_ERROR',
  SMS_DELIVERY_ERROR: 'SMS_DELIVERY_ERROR',
  SMS_INVALID_PHONE: 'SMS_INVALID_PHONE',
  SMS_VERIFICATION_EXPIRED: 'SMS_VERIFICATION_EXPIRED',
  SMS_VERIFICATION_INVALID: 'SMS_VERIFICATION_INVALID',
  SMS_VERIFICATION_MAX_ATTEMPTS: 'SMS_VERIFICATION_MAX_ATTEMPTS',
  SMS_RATE_LIMIT_EXCEEDED: 'SMS_RATE_LIMIT_EXCEEDED',
  SMS_TEMPLATE_NOT_FOUND: 'SMS_TEMPLATE_NOT_FOUND',
  SMS_COUNTRY_NOT_SUPPORTED: 'SMS_COUNTRY_NOT_SUPPORTED',
  STORAGE_PROVIDER_ERROR: 'STORAGE_PROVIDER_ERROR',
  STORAGE_FILE_NOT_FOUND: 'STORAGE_FILE_NOT_FOUND',
  STORAGE_UPLOAD_ERROR: 'STORAGE_UPLOAD_ERROR',
  STORAGE_DOWNLOAD_ERROR: 'STORAGE_DOWNLOAD_ERROR',
  STORAGE_DELETE_ERROR: 'STORAGE_DELETE_ERROR',
  STORAGE_QUOTA_EXCEEDED: 'STORAGE_QUOTA_EXCEEDED',
  STORAGE_FILE_TOO_LARGE: 'STORAGE_FILE_TOO_LARGE',
  STORAGE_INVALID_FILE_TYPE: 'STORAGE_INVALID_FILE_TYPE',
  STORAGE_SIGNED_URL_ERROR: 'STORAGE_SIGNED_URL_ERROR',
  STORAGE_METADATA_ERROR: 'STORAGE_METADATA_ERROR',
  STORAGE_BUCKET_ERROR: 'STORAGE_BUCKET_ERROR',
  CONFIG_NOT_FOUND: 'CONFIG_NOT_FOUND',
  CONFIG_VALIDATION_ERROR: 'CONFIG_VALIDATION_ERROR',
  CONFIG_SECRET_ACCESS_ERROR: 'CONFIG_SECRET_ACCESS_ERROR',
  CONFIG_FEATURE_FLAG_ERROR: 'CONFIG_FEATURE_FLAG_ERROR',
  CONFIG_ENVIRONMENT_ERROR: 'CONFIG_ENVIRONMENT_ERROR',
  CONFIG_UPDATE_ERROR: 'CONFIG_UPDATE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  VALIDATION_SCHEMA_ERROR: 'VALIDATION_SCHEMA_ERROR',
  VALIDATION_INPUT_ERROR: 'VALIDATION_INPUT_ERROR',
  VALIDATION_FORMAT_ERROR: 'VALIDATION_FORMAT_ERROR',
  SECURITY_RATE_LIMIT: 'SECURITY_RATE_LIMIT',
  SECURITY_INPUT_SANITIZATION: 'SECURITY_INPUT_SANITIZATION',
  SECURITY_UNAUTHORIZED: 'SECURITY_UNAUTHORIZED',
  SECURITY_FORBIDDEN: 'SECURITY_FORBIDDEN',
  SECURITY_TOKEN_ERROR: 'SECURITY_TOKEN_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
