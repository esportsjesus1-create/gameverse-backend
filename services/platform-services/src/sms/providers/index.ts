export * from './twilio.provider';
export * from './mock.provider';

import { ISmsProvider, SmsProviderConfig } from '../interfaces';
import { TwilioProvider } from './twilio.provider';
import { MockSmsProvider } from './mock.provider';
import { PlatformLogger } from '../../common/logging';

export function createSmsProvider(config: SmsProviderConfig, logger: PlatformLogger): ISmsProvider {
  switch (config.provider) {
    case 'twilio':
      if (!config.accountSid || !config.authToken) {
        throw new Error('Twilio account SID and auth token are required');
      }
      return new TwilioProvider(
        {
          accountSid: config.accountSid,
          authToken: config.authToken,
          defaultFrom: config.defaultFrom,
          messagingServiceSid: config.messagingServiceSid,
        },
        logger,
        config.sandbox
      );

    case 'mock':
      return new MockSmsProvider(logger);

    default:
      throw new Error(`Unknown SMS provider: ${config.provider}`);
  }
}
