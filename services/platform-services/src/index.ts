export * from './common';
export { EmailService, createEmailProvider, EmailTemplateService } from './email';
export type { EmailServiceConfig, EmailProviderConfig, EmailSendResult } from './email';
export { SmsService, createSmsProvider, SmsTemplateService, VerificationService } from './sms';
export type { SmsServiceConfig, SmsProviderConfig, SmsSendResult } from './sms';
export { StorageService, createStorageProvider } from './storage';
export type { StorageServiceConfig, StorageProviderConfig } from './storage';
export { ConfigService, FeatureFlagService, SecretService } from './config';
export type { ConfigServiceOptions } from './config';

import { PlatformLogger, EventTypes, LogLevel, LogLevelType } from './common/logging';
import { ThreeTierRateLimiter } from './common/security/rate-limiter';
import { InputSanitizer } from './common/security/sanitizer';

import { EmailService } from './email/services/email.service';
import { EmailTemplateService } from './email/services/template.service';
import { createEmailProvider } from './email/providers';
import { EmailServiceConfig } from './email/interfaces';

import { SmsService } from './sms/services/sms.service';
import { SmsTemplateService } from './sms/services/template.service';
import { VerificationService } from './sms/services/verification.service';
import { createSmsProvider } from './sms/providers';
import { SmsServiceConfig } from './sms/interfaces';

import { StorageService } from './storage/services/storage.service';
import { createStorageProvider } from './storage/providers';
import { StorageServiceConfig } from './storage/interfaces';

import { ConfigService } from './config/services/config.service';
import { FeatureFlagService } from './config/services/feature-flag.service';
import { SecretService } from './config/services/secret.service';
import { ConfigServiceOptions } from './config/interfaces';

export interface PlatformServicesConfig {
  serviceName?: string;
  environment?: string;
  logLevel?: LogLevelType;
  email?: EmailServiceConfig;
  sms?: SmsServiceConfig;
  storage?: StorageServiceConfig;
  config?: ConfigServiceOptions;
  rateLimiting?: {
    global?: { maxRequests: number; windowMs: number };
    service?: { maxRequests: number; windowMs: number };
    user?: { maxRequests: number; windowMs: number };
  };
}

export class PlatformServices {
  readonly logger: PlatformLogger;
  readonly rateLimiter: ThreeTierRateLimiter;
  readonly sanitizer: typeof InputSanitizer;

  readonly email?: EmailService;
  readonly sms?: SmsService;
  readonly storage?: StorageService;
  readonly config?: ConfigService;
  readonly featureFlags?: FeatureFlagService;
  readonly secrets?: SecretService;

  constructor(config: PlatformServicesConfig) {
    this.logger = new PlatformLogger(config.serviceName || 'platform-services', {
      level: config.logLevel || LogLevel.INFO,
    });

    this.rateLimiter = new ThreeTierRateLimiter(this.logger, {
      global: config.rateLimiting?.global || { maxRequests: 10000, windowMs: 60000 },
      service: config.rateLimiting?.service || { maxRequests: 1000, windowMs: 60000 },
      user: config.rateLimiting?.user || { maxRequests: 100, windowMs: 60000 },
    });

    this.sanitizer = InputSanitizer;

    if (config.email) {
      const emailProvider = createEmailProvider(config.email.provider, this.logger);
      const emailTemplateService = new EmailTemplateService(this.logger);
      this.email = new EmailService(
        emailProvider,
        emailTemplateService,
        this.logger,
        this.rateLimiter,
        config.email
      );
    }

    if (config.sms) {
      const smsProvider = createSmsProvider(config.sms.provider, this.logger);
      const smsTemplateService = new SmsTemplateService(this.logger);
      const verificationService = new VerificationService(
        smsProvider,
        this.logger,
        this.rateLimiter,
        {
          codeLength: config.sms.verificationCodeLength,
          expiresInMinutes: config.sms.verificationExpiresMinutes,
          maxAttempts: config.sms.verificationMaxAttempts,
        }
      );
      this.sms = new SmsService(
        smsProvider,
        smsTemplateService,
        verificationService,
        this.logger,
        this.rateLimiter,
        config.sms
      );
    }

    if (config.storage) {
      const storageProvider = createStorageProvider(config.storage.provider, this.logger);
      this.storage = new StorageService(
        storageProvider,
        this.logger,
        this.rateLimiter,
        config.storage
      );
    }

    if (config.config) {
      this.config = new ConfigService(this.logger, config.config);
      this.featureFlags = new FeatureFlagService(this.logger);
      this.secrets = new SecretService(this.logger);
    }
  }

  async initialize(): Promise<void> {
    if (this.config) {
      await this.config.initialize();
    }
    if (this.secrets) {
      await (this.secrets as SecretService).initialize();
    }

    this.logger.event(EventTypes.SERVICE_INITIALIZED, {
      services: {
        email: !!this.email,
        sms: !!this.sms,
        storage: !!this.storage,
        config: !!this.config,
        featureFlags: !!this.featureFlags,
        secrets: !!this.secrets,
      },
    });
  }

  async shutdown(): Promise<void> {
    this.logger.event(EventTypes.SERVICE_SHUTDOWN, {
      message: 'Platform services shutting down',
    });
  }
}

export default PlatformServices;
