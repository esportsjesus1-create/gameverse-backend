import {
  PlatformError,
  ValidationError,
  EmailSendError,
  EmailTemplateError,
  EmailRateLimitError,
  EmailInvalidRecipientError,
  EmailAttachmentError,
  EmailDeliveryError,
  SmsSendError,
  SmsTemplateError,
  SmsRateLimitError,
  SmsInvalidPhoneError,
  SmsVerificationError,
  SmsDeliveryError,
  StorageUploadError,
  StorageDownloadError,
  StorageDeleteError,
  StorageFileNotFoundError,
  StorageQuotaExceededError,
  StorageFileTooLargeError,
  StorageInvalidFileTypeError,
  StorageSignedUrlError,
  StorageProviderError,
  ConfigNotFoundError,
  ConfigValidationError,
  ConfigUpdateError,
  ConfigFeatureFlagError,
  ConfigSecretError,
  RateLimitError,
  AuthenticationError,
  AuthorizationError,
  ServiceUnavailableError,
  TimeoutError,
  NetworkError,
  ErrorCodes,
} from '../../../src/common/errors';

describe('PlatformError', () => {
  it('should create a base platform error', () => {
    const error = new PlatformError('Test error', 'TEST_ERROR', 400);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('PlatformError');
  });

  it('should include details when provided', () => {
    const details = { field: 'test', value: 123 };
    const error = new PlatformError('Test error', 'TEST_ERROR', 400, details);
    expect(error.details).toEqual(details);
  });

  it('should convert to JSON correctly', () => {
    const error = new PlatformError('Test error', 'TEST_ERROR', 400, { key: 'value' });
    const json = error.toJSON();
    expect(json.message).toBe('Test error');
    expect(json.code).toBe('TEST_ERROR');
    expect(json.statusCode).toBe(400);
    expect(json.details).toEqual({ key: 'value' });
  });
});

describe('ValidationError', () => {
  it('should create a validation error', () => {
    const error = new ValidationError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    expect(error.statusCode).toBe(400);
  });

  it('should include field details', () => {
    const error = new ValidationError('Invalid email', { field: 'email' });
    expect(error.details).toEqual({ field: 'email' });
  });
});

describe('Email Errors', () => {
  it('should create EmailSendError', () => {
    const error = new EmailSendError('Failed to send');
    expect(error.code).toBe(ErrorCodes.EMAIL_SEND_FAILED);
    expect(error.statusCode).toBe(500);
  });

  it('should create EmailTemplateError', () => {
    const error = new EmailTemplateError('template-1', 'Template not found');
    expect(error.message).toContain('template-1');
    expect(error.code).toBe(ErrorCodes.EMAIL_TEMPLATE_ERROR);
  });

  it('should create EmailRateLimitError', () => {
    const error = new EmailRateLimitError(60);
    expect(error.message).toContain('60');
    expect(error.code).toBe(ErrorCodes.EMAIL_RATE_LIMITED);
    expect(error.statusCode).toBe(429);
  });

  it('should create EmailInvalidRecipientError', () => {
    const error = new EmailInvalidRecipientError('invalid@');
    expect(error.message).toContain('invalid@');
    expect(error.code).toBe(ErrorCodes.EMAIL_INVALID_RECIPIENT);
  });

  it('should create EmailAttachmentError', () => {
    const error = new EmailAttachmentError('file.exe', 'Blocked file type');
    expect(error.message).toContain('file.exe');
    expect(error.code).toBe(ErrorCodes.EMAIL_ATTACHMENT_ERROR);
  });

  it('should create EmailDeliveryError', () => {
    const error = new EmailDeliveryError('email-123', 'bounced');
    expect(error.message).toContain('email-123');
    expect(error.code).toBe(ErrorCodes.EMAIL_DELIVERY_FAILED);
  });
});

describe('SMS Errors', () => {
  it('should create SmsSendError', () => {
    const error = new SmsSendError('Failed to send SMS');
    expect(error.code).toBe(ErrorCodes.SMS_SEND_FAILED);
    expect(error.statusCode).toBe(500);
  });

  it('should create SmsTemplateError', () => {
    const error = new SmsTemplateError('sms-template-1', 'Template not found');
    expect(error.message).toContain('sms-template-1');
    expect(error.code).toBe(ErrorCodes.SMS_TEMPLATE_ERROR);
  });

  it('should create SmsRateLimitError', () => {
    const error = new SmsRateLimitError(30);
    expect(error.message).toContain('30');
    expect(error.code).toBe(ErrorCodes.SMS_RATE_LIMITED);
    expect(error.statusCode).toBe(429);
  });

  it('should create SmsInvalidPhoneError', () => {
    const error = new SmsInvalidPhoneError('123');
    expect(error.message).toContain('123');
    expect(error.code).toBe(ErrorCodes.SMS_INVALID_PHONE);
  });

  it('should create SmsVerificationError', () => {
    const error = new SmsVerificationError('Invalid code');
    expect(error.code).toBe(ErrorCodes.SMS_VERIFICATION_FAILED);
  });

  it('should create SmsDeliveryError', () => {
    const error = new SmsDeliveryError('sms-123', 'undelivered');
    expect(error.message).toContain('sms-123');
    expect(error.code).toBe(ErrorCodes.SMS_DELIVERY_FAILED);
  });
});

describe('Storage Errors', () => {
  it('should create StorageUploadError', () => {
    const error = new StorageUploadError('file.txt', 'Upload failed');
    expect(error.message).toContain('file.txt');
    expect(error.code).toBe(ErrorCodes.STORAGE_UPLOAD_FAILED);
  });

  it('should create StorageDownloadError', () => {
    const error = new StorageDownloadError('file.txt', 'Download failed');
    expect(error.message).toContain('file.txt');
    expect(error.code).toBe(ErrorCodes.STORAGE_DOWNLOAD_FAILED);
  });

  it('should create StorageDeleteError', () => {
    const error = new StorageDeleteError('file.txt', 'Delete failed');
    expect(error.message).toContain('file.txt');
    expect(error.code).toBe(ErrorCodes.STORAGE_DELETE_FAILED);
  });

  it('should create StorageFileNotFoundError', () => {
    const error = new StorageFileNotFoundError('missing.txt');
    expect(error.message).toContain('missing.txt');
    expect(error.code).toBe(ErrorCodes.STORAGE_FILE_NOT_FOUND);
    expect(error.statusCode).toBe(404);
  });

  it('should create StorageQuotaExceededError', () => {
    const error = new StorageQuotaExceededError('user-123', 1000, 500);
    expect(error.message).toContain('user-123');
    expect(error.code).toBe(ErrorCodes.STORAGE_QUOTA_EXCEEDED);
  });

  it('should create StorageFileTooLargeError', () => {
    const error = new StorageFileTooLargeError('large.zip', 100000000, 10000000);
    expect(error.message).toContain('large.zip');
    expect(error.code).toBe(ErrorCodes.STORAGE_FILE_TOO_LARGE);
  });

  it('should create StorageInvalidFileTypeError', () => {
    const error = new StorageInvalidFileTypeError('file.exe', 'application/exe', ['.jpg', '.png']);
    expect(error.message).toContain('file.exe');
    expect(error.code).toBe(ErrorCodes.STORAGE_INVALID_FILE_TYPE);
  });

  it('should create StorageSignedUrlError', () => {
    const error = new StorageSignedUrlError('file.txt', 'Failed to generate URL');
    expect(error.message).toContain('file.txt');
    expect(error.code).toBe(ErrorCodes.STORAGE_SIGNED_URL_ERROR);
  });

  it('should create StorageProviderError', () => {
    const error = new StorageProviderError('s3', 'Connection failed');
    expect(error.message).toContain('s3');
    expect(error.code).toBe(ErrorCodes.STORAGE_PROVIDER_ERROR);
  });
});

describe('Config Errors', () => {
  it('should create ConfigNotFoundError', () => {
    const error = new ConfigNotFoundError('API_KEY');
    expect(error.message).toContain('API_KEY');
    expect(error.code).toBe(ErrorCodes.CONFIG_NOT_FOUND);
    expect(error.statusCode).toBe(404);
  });

  it('should create ConfigValidationError', () => {
    const error = new ConfigValidationError('port', 'Must be a number');
    expect(error.message).toContain('port');
    expect(error.code).toBe(ErrorCodes.CONFIG_VALIDATION_ERROR);
  });

  it('should create ConfigUpdateError', () => {
    const error = new ConfigUpdateError('setting', 'Update failed');
    expect(error.message).toContain('setting');
    expect(error.code).toBe(ErrorCodes.CONFIG_UPDATE_FAILED);
  });

  it('should create ConfigFeatureFlagError', () => {
    const error = new ConfigFeatureFlagError('new-feature', 'Flag not found');
    expect(error.message).toContain('new-feature');
    expect(error.code).toBe(ErrorCodes.CONFIG_FEATURE_FLAG_ERROR);
  });

  it('should create ConfigSecretError', () => {
    const error = new ConfigSecretError('db-password', 'Access denied');
    expect(error.message).toContain('db-password');
    expect(error.code).toBe(ErrorCodes.CONFIG_SECRET_ERROR);
  });
});

describe('General Errors', () => {
  it('should create RateLimitError', () => {
    const error = new RateLimitError('api', 60);
    expect(error.message).toContain('api');
    expect(error.code).toBe(ErrorCodes.RATE_LIMIT_EXCEEDED);
    expect(error.statusCode).toBe(429);
  });

  it('should create AuthenticationError', () => {
    const error = new AuthenticationError('Invalid token');
    expect(error.code).toBe(ErrorCodes.AUTHENTICATION_ERROR);
    expect(error.statusCode).toBe(401);
  });

  it('should create AuthorizationError', () => {
    const error = new AuthorizationError('Insufficient permissions');
    expect(error.code).toBe(ErrorCodes.AUTHORIZATION_ERROR);
    expect(error.statusCode).toBe(403);
  });

  it('should create ServiceUnavailableError', () => {
    const error = new ServiceUnavailableError('email-service');
    expect(error.message).toContain('email-service');
    expect(error.code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
    expect(error.statusCode).toBe(503);
  });

  it('should create TimeoutError', () => {
    const error = new TimeoutError('api-call', 30000);
    expect(error.message).toContain('api-call');
    expect(error.code).toBe(ErrorCodes.TIMEOUT_ERROR);
    expect(error.statusCode).toBe(504);
  });

  it('should create NetworkError', () => {
    const error = new NetworkError('Connection refused');
    expect(error.code).toBe(ErrorCodes.NETWORK_ERROR);
    expect(error.statusCode).toBe(503);
  });
});

describe('ErrorCodes', () => {
  it('should have all required error codes', () => {
    expect(ErrorCodes.VALIDATION_ERROR).toBeDefined();
    expect(ErrorCodes.EMAIL_SEND_FAILED).toBeDefined();
    expect(ErrorCodes.SMS_SEND_FAILED).toBeDefined();
    expect(ErrorCodes.STORAGE_UPLOAD_FAILED).toBeDefined();
    expect(ErrorCodes.CONFIG_NOT_FOUND).toBeDefined();
    expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBeDefined();
  });

  it('should have unique error codes', () => {
    const codes = Object.values(ErrorCodes);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});
