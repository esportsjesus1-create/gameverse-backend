export * from './s3.provider';
export * from './mock.provider';

import { IStorageProvider, StorageProviderConfig } from '../interfaces';
import { S3Provider } from './s3.provider';
import { MockStorageProvider } from './mock.provider';
import { PlatformLogger } from '../../common/logging';

export function createStorageProvider(
  config: StorageProviderConfig,
  logger: PlatformLogger,
  sandbox = false
): IStorageProvider {
  switch (config.provider) {
    case 's3':
      if (!config.region || !config.bucket) {
        throw new Error('AWS region and bucket are required for S3');
      }
      return new S3Provider(
        {
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          endpoint: config.endpoint,
          bucket: config.bucket,
        },
        logger,
        sandbox
      );

    case 'mock':
      return new MockStorageProvider(logger);

    default:
      throw new Error(`Unknown storage provider: ${config.provider}`);
  }
}
