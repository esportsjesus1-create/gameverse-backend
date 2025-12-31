import {
  IStorageProvider,
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  SignedUrlOptions,
  ListOptions,
  ListResult,
} from '../interfaces';
import { StorageFileNotFoundError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class MockStorageProvider implements IStorageProvider {
  readonly name = 'mock';
  private logger: PlatformLogger;
  private storage: Map<string, { data: Buffer; metadata: FileMetadata }> = new Map();
  private simulateFailure: boolean = false;
  private failureRate: number = 0;

  constructor(logger: PlatformLogger) {
    this.logger = logger;
  }

  setSimulateFailure(simulate: boolean, rate: number = 0.1): void {
    this.simulateFailure = simulate;
    this.failureRate = rate;
  }

  async upload(
    file: Buffer | NodeJS.ReadableStream,
    key: string,
    contentType: string,
    options?: UploadOptions
  ): Promise<FileMetadata> {
    const timer = this.logger.startTimer('mock_storage_upload');
    const fileId = uuidv4();

    this.logger.event(EventTypes.STORAGE_UPLOAD_INITIATED, {
      fileId,
      key,
      contentType,
      provider: this.name,
    });

    if (this.simulateFailure && Math.random() < this.failureRate) {
      timer(false, { key, error: 'Simulated failure' });
      throw new Error('Simulated upload failure');
    }

    const buffer =
      file instanceof Buffer ? file : await this.streamToBuffer(file as NodeJS.ReadableStream);
    const checksum = crypto.createHash('md5').update(buffer).digest('hex');
    const bucket = options?.bucket || 'mock-bucket';
    const fullKey = options?.path ? `${options.path}/${key}` : key;

    const metadata: FileMetadata = {
      id: fileId,
      filename: key,
      originalFilename: key,
      contentType,
      size: buffer.length,
      bucket,
      key: fullKey,
      url: options?.isPublic ? `https://${bucket}.mock-storage.com/${fullKey}` : undefined,
      isPublic: options?.isPublic || false,
      uploadedAt: new Date(),
      expiresAt: options?.expiresAt,
      checksum,
      metadata: options?.metadata,
      tags: options?.tags,
    };

    this.storage.set(fullKey, { data: buffer, metadata });

    this.logger.event(EventTypes.STORAGE_UPLOAD_SUCCESS, {
      fileId,
      key: fullKey,
      size: buffer.length,
    });

    timer(true, { fileId, key: fullKey, size: buffer.length });

    return metadata;
  }

  async download(key: string, _options?: DownloadOptions): Promise<Buffer> {
    const timer = this.logger.startTimer('mock_storage_download');

    this.logger.event(EventTypes.STORAGE_DOWNLOAD_INITIATED, {
      key,
      provider: this.name,
    });

    if (this.simulateFailure && Math.random() < this.failureRate) {
      timer(false, { key, error: 'Simulated failure' });
      throw new Error('Simulated download failure');
    }

    const stored = this.storage.get(key);
    if (!stored) {
      timer(false, { key, error: 'not_found' });
      throw new StorageFileNotFoundError(key);
    }

    this.logger.event(EventTypes.STORAGE_DOWNLOAD_SUCCESS, {
      key,
      size: stored.data.length,
    });

    timer(true, { key, size: stored.data.length });

    return stored.data;
  }

  async delete(key: string): Promise<void> {
    const timer = this.logger.startTimer('mock_storage_delete');

    this.logger.event(EventTypes.STORAGE_DELETE_INITIATED, {
      key,
      provider: this.name,
    });

    if (this.simulateFailure && Math.random() < this.failureRate) {
      timer(false, { key, error: 'Simulated failure' });
      throw new Error('Simulated delete failure');
    }

    this.storage.delete(key);

    this.logger.event(EventTypes.STORAGE_DELETE_SUCCESS, {
      key,
    });

    timer(true, { key });
  }

  async deleteMany(
    keys: string[]
  ): Promise<{ deleted: string[]; errors: { key: string; error: string }[] }> {
    const deleted: string[] = [];
    const errors: { key: string; error: string }[] = [];

    for (const key of keys) {
      try {
        await this.delete(key);
        deleted.push(key);
      } catch (error) {
        errors.push({
          key,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { deleted, errors };
  }

  async exists(key: string): Promise<boolean> {
    return this.storage.has(key);
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    const stored = this.storage.get(key);
    return stored?.metadata || null;
  }

  async updateMetadata(key: string, metadata: Record<string, string>): Promise<FileMetadata> {
    const stored = this.storage.get(key);
    if (!stored) {
      throw new StorageFileNotFoundError(key);
    }

    stored.metadata.metadata = { ...stored.metadata.metadata, ...metadata };

    this.logger.event(EventTypes.STORAGE_METADATA_UPDATED, {
      key,
      metadata,
    });

    return stored.metadata;
  }

  async list(options?: ListOptions): Promise<ListResult> {
    let files = Array.from(this.storage.values()).map((item) => item.metadata);

    if (options?.prefix) {
      files = files.filter((f) => f.key.startsWith(options.prefix!));
    }

    if (options?.bucket) {
      files = files.filter((f) => f.bucket === options.bucket);
    }

    const maxKeys = options?.maxKeys || 1000;
    const isTruncated = files.length > maxKeys;
    const resultFiles = files.slice(0, maxKeys);

    return {
      files: resultFiles,
      isTruncated,
      keyCount: resultFiles.length,
      continuationToken: isTruncated ? 'mock-continuation-token' : undefined,
    };
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    options?: SignedUrlOptions
  ): Promise<string> {
    const expiresIn = options?.expiresInSeconds || 3600;

    this.logger.event(EventTypes.STORAGE_SIGNED_URL_GENERATED, {
      key,
      operation: 'upload',
      expiresIn,
    });

    return `https://mock-bucket.mock-storage.com/${key}?signature=mock&expires=${Date.now() + expiresIn * 1000}&contentType=${encodeURIComponent(contentType)}`;
  }

  async getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresInSeconds || 3600;

    this.logger.event(EventTypes.STORAGE_SIGNED_URL_GENERATED, {
      key,
      operation: 'download',
      expiresIn,
    });

    return `https://mock-bucket.mock-storage.com/${key}?signature=mock&expires=${Date.now() + expiresIn * 1000}`;
  }

  async copy(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const source = this.storage.get(sourceKey);
    if (!source) {
      throw new StorageFileNotFoundError(sourceKey);
    }

    const newMetadata: FileMetadata = {
      ...source.metadata,
      id: uuidv4(),
      key: destinationKey,
      filename: destinationKey.split('/').pop() || destinationKey,
      uploadedAt: new Date(),
    };

    this.storage.set(destinationKey, { data: source.data, metadata: newMetadata });

    return newMetadata;
  }

  async move(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    const metadata = await this.copy(sourceKey, destinationKey);
    await this.delete(sourceKey);
    return metadata;
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  getStorage(): Map<string, { data: Buffer; metadata: FileMetadata }> {
    return new Map(this.storage);
  }

  getStorageCount(): number {
    return this.storage.size;
  }

  clearStorage(): void {
    this.storage.clear();
  }
}

export default MockStorageProvider;
