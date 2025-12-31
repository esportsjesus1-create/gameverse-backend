export * from './sendgrid.provider';
export * from './ses.provider';
export * from './mock.provider';

import { IEmailProvider, EmailProviderConfig } from '../interfaces';
import { SendGridProvider } from './sendgrid.provider';
import { SESProvider } from './ses.provider';
import { MockEmailProvider } from './mock.provider';
import { PlatformLogger } from '../../common/logging';

export function createEmailProvider(
  config: EmailProviderConfig,
  logger: PlatformLogger
): IEmailProvider {
  switch (config.provider) {
    case 'sendgrid':
      if (!config.apiKey) {
        throw new Error('SendGrid API key is required');
      }
      return new SendGridProvider(config.apiKey, logger, config.sandbox);

    case 'ses':
      if (!config.region) {
        throw new Error('AWS region is required for SES');
      }
      return new SESProvider(
        {
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        logger,
        config.sandbox
      );

    case 'mock':
      return new MockEmailProvider(logger);

    default:
      throw new Error(`Unknown email provider: ${config.provider}`);
  }
}
