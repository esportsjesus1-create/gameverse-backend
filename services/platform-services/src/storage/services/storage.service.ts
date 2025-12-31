import {
  IStorageProvider,
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  SignedUrlOptions,
  ListOptions,
  ListResult,
  StorageQuota,
  StorageServiceConfig,
} from '../interfaces';
import {
  StorageQuotaExceededError,
  StorageFileTooLargeError,
  StorageInvalidFileTypeError,
  StorageFileNotFoundError,
  ValidationError,
} from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { ThreeTierRateLimiter } from '../../common/security/rate-limiter';
import { InputSanitizer } from '../../common/security/sanitizer';
import { signedUrlRequestSchema, fileListRequestSchema } from '../../common/validators';
import { v4 as uuidv4 } from 'uuid';
import * as mimeTypes from 'mime-types';

export class StorageService {
  private provider: IStorageProvider;
  private logger: PlatformLogger;
  private rateLimiter: ThreeTierRateLimiter;
  private config: StorageServiceConfig;
  private quotas: Map<string, StorageQuota> = new Map();
  private fileIndex: Map<string, FileMetadata> = new Map();

  constructor(
    provider: IStorageProvider,
    logger: PlatformLogger,
    rateLimiter: ThreeTierRateLimiter,
    config: StorageServiceConfig
  ) {
    this.provider = provider;
    this.logger = logger;
    this.rateLimiter = rateLimiter;
    this.config = {
      defaultQuotaBytes: 10 * 1024 * 1024 * 1024,
      defaultMaxFileCount: 10000,
      signedUrlExpiresSeconds: 3600,
      enableVersioning: false,
      ...config,
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024,
    };
  }

  async upload(
    file: Buffer | NodeJS.ReadableStream,
    filename: string,
    contentType: string,
    options?: UploadOptions & { userId?: string }
  ): Promise<FileMetadata> {
    const timer = this.logger.startTimer('storage_service_upload');
    const correlationId = uuidv4();

    try {
      this.rateLimiter.checkOrThrow('platform', 'storage', options?.userId);

      const sanitizedFilename = InputSanitizer.sanitizeFilename(filename);
      if (!sanitizedFilename) {
        throw new ValidationError('Invalid filename');
      }

      const buffer =
        file instanceof Buffer ? file : await this.streamToBuffer(file as NodeJS.ReadableStream);

      if (buffer.length > this.config.maxFileSize) {
        throw new StorageFileTooLargeError(
          sanitizedFilename,
          buffer.length,
          this.config.maxFileSize
        );
      }

      this.validateContentType(sanitizedFilename, contentType);

      if (options?.userId) {
        await this.checkQuota(options.userId, buffer.length);
      }

      const fileId = uuidv4();
      const extension = sanitizedFilename.includes('.')
        ? sanitizedFilename.split('.').pop()
        : mimeTypes.extension(contentType) || '';
      const key = options?.path
        ? `${options.path}/${fileId}${extension ? `.${extension}` : ''}`
        : `${fileId}${extension ? `.${extension}` : ''}`;

      const metadata = await this.provider.upload(buffer, key, contentType, {
        ...options,
        metadata: {
          ...options?.metadata,
          originalFilename: sanitizedFilename,
          uploadedBy: options?.userId || 'anonymous',
        },
      });

      metadata.originalFilename = sanitizedFilename;
      metadata.uploadedBy = options?.userId;

      this.fileIndex.set(metadata.id, metadata);

      if (options?.userId) {
        await this.updateQuotaUsage(options.userId, buffer.length, 1);
      }

      this.logger.audit({
        eventType: EventTypes.STORAGE_UPLOAD_SUCCESS,
        userId: options?.userId,
        operation: 'upload',
        resource: 'file',
        resourceId: metadata.id,
        newValue: {
          filename: sanitizedFilename,
          size: buffer.length,
          contentType,
          key: metadata.key,
        },
        success: true,
        correlationId,
      });

      timer(true, { correlationId, fileId: metadata.id, size: buffer.length });

      return metadata;
    } catch (error) {
      this.logger.audit({
        eventType: EventTypes.STORAGE_UPLOAD_FAILED,
        userId: options?.userId,
        operation: 'upload',
        resource: 'file',
        success: false,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });

      timer(false, { correlationId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  async download(fileId: string, options?: DownloadOptions & { userId?: string }): Promise<Buffer> {
    const timer = this.logger.startTimer('storage_service_download');
    const correlationId = uuidv4();

    try {
      this.rateLimiter.checkOrThrow('platform', 'storage', options?.userId);

      const metadata = this.fileIndex.get(fileId);
      if (!metadata) {
        throw new StorageFileNotFoundError(fileId);
      }

      const data = await this.provider.download(metadata.key, options);

      this.logger.audit({
        eventType: EventTypes.STORAGE_DOWNLOAD_SUCCESS,
        userId: options?.userId,
        operation: 'download',
        resource: 'file',
        resourceId: fileId,
        success: true,
        correlationId,
      });

      timer(true, { correlationId, fileId, size: data.length });

      return data;
    } catch (error) {
      this.logger.audit({
        eventType: EventTypes.STORAGE_DOWNLOAD_FAILED,
        userId: options?.userId,
        operation: 'download',
        resource: 'file',
        resourceId: fileId,
        success: false,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });

      timer(false, {
        correlationId,
        fileId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async delete(fileId: string, userId?: string): Promise<void> {
    const timer = this.logger.startTimer('storage_service_delete');
    const correlationId = uuidv4();

    try {
      this.rateLimiter.checkOrThrow('platform', 'storage', userId);

      const metadata = this.fileIndex.get(fileId);
      if (!metadata) {
        throw new StorageFileNotFoundError(fileId);
      }

      await this.provider.delete(metadata.key);

      this.fileIndex.delete(fileId);

      if (metadata.uploadedBy) {
        await this.updateQuotaUsage(metadata.uploadedBy, -metadata.size, -1);
      }

      this.logger.audit({
        eventType: EventTypes.STORAGE_DELETE_SUCCESS,
        userId,
        operation: 'delete',
        resource: 'file',
        resourceId: fileId,
        oldValue: { filename: metadata.originalFilename, size: metadata.size },
        success: true,
        correlationId,
      });

      timer(true, { correlationId, fileId });
    } catch (error) {
      this.logger.audit({
        eventType: EventTypes.STORAGE_DELETE_FAILED,
        userId,
        operation: 'delete',
        resource: 'file',
        resourceId: fileId,
        success: false,
        errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        correlationId,
      });

      timer(false, {
        correlationId,
        fileId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  async getMetadata(fileId: string): Promise<FileMetadata | null> {
    return this.fileIndex.get(fileId) || null;
  }

  async updateMetadata(
    fileId: string,
    metadata: Record<string, string>,
    userId?: string
  ): Promise<FileMetadata> {
    const existing = this.fileIndex.get(fileId);
    if (!existing) {
      throw new StorageFileNotFoundError(fileId);
    }

    const updated = await this.provider.updateMetadata(existing.key, metadata);

    this.fileIndex.set(fileId, updated);

    this.logger.audit({
      eventType: EventTypes.STORAGE_METADATA_UPDATED,
      userId,
      operation: 'updateMetadata',
      resource: 'file',
      resourceId: fileId,
      oldValue: existing.metadata,
      newValue: updated.metadata,
      success: true,
      correlationId: uuidv4(),
    });

    return updated;
  }

  async list(options?: ListOptions & { userId?: string }): Promise<ListResult> {
    const validatedOptions = fileListRequestSchema.parse(options || {});

    this.rateLimiter.checkOrThrow('platform', 'storage', options?.userId);

    return this.provider.list(validatedOptions);
  }

  async getSignedUploadUrl(
    filename: string,
    contentType: string,
    options?: SignedUrlOptions & { userId?: string; path?: string }
  ): Promise<{ url: string; key: string; expiresAt: Date }> {
    const validatedOptions = signedUrlRequestSchema.parse({
      fileKey: filename,
      operation: 'put',
      expiresInSeconds: options?.expiresInSeconds || this.config.signedUrlExpiresSeconds,
      contentType,
    });

    this.rateLimiter.checkOrThrow('platform', 'storage', options?.userId);

    const sanitizedFilename = InputSanitizer.sanitizeFilename(filename);
    this.validateContentType(sanitizedFilename, contentType);

    const fileId = uuidv4();
    const extension = sanitizedFilename.includes('.')
      ? sanitizedFilename.split('.').pop()
      : mimeTypes.extension(contentType) || '';
    const key = options?.path
      ? `${options.path}/${fileId}${extension ? `.${extension}` : ''}`
      : `${fileId}${extension ? `.${extension}` : ''}`;

    const url = await this.provider.getSignedUploadUrl(key, contentType, {
      expiresInSeconds: validatedOptions.expiresInSeconds,
    });

    const expiresAt = new Date(Date.now() + validatedOptions.expiresInSeconds * 1000);

    this.logger.event(EventTypes.STORAGE_SIGNED_URL_GENERATED, {
      key,
      operation: 'upload',
      expiresAt,
      userId: options?.userId,
    });

    return { url, key, expiresAt };
  }

  async getSignedDownloadUrl(
    fileId: string,
    options?: SignedUrlOptions & { userId?: string }
  ): Promise<{ url: string; expiresAt: Date }> {
    const metadata = this.fileIndex.get(fileId);
    if (!metadata) {
      throw new StorageFileNotFoundError(fileId);
    }

    this.rateLimiter.checkOrThrow('platform', 'storage', options?.userId);

    const expiresInSeconds = options?.expiresInSeconds || this.config.signedUrlExpiresSeconds!;

    const url = await this.provider.getSignedDownloadUrl(metadata.key, {
      expiresInSeconds,
      responseContentType: options?.responseContentType,
      contentDisposition: options?.contentDisposition,
    });

    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    this.logger.event(EventTypes.STORAGE_SIGNED_URL_GENERATED, {
      fileId,
      key: metadata.key,
      operation: 'download',
      expiresAt,
      userId: options?.userId,
    });

    return { url, expiresAt };
  }

  async copy(
    sourceFileId: string,
    destinationPath: string,
    userId?: string
  ): Promise<FileMetadata> {
    const sourceMetadata = this.fileIndex.get(sourceFileId);
    if (!sourceMetadata) {
      throw new StorageFileNotFoundError(sourceFileId);
    }

    const newFileId = uuidv4();
    const extension = sourceMetadata.filename.includes('.')
      ? sourceMetadata.filename.split('.').pop()
      : '';
    const destinationKey = `${destinationPath}/${newFileId}${extension ? `.${extension}` : ''}`;

    const newMetadata = await this.provider.copy(sourceMetadata.key, destinationKey);
    newMetadata.id = newFileId;
    newMetadata.uploadedBy = userId;

    this.fileIndex.set(newFileId, newMetadata);

    if (userId) {
      await this.updateQuotaUsage(userId, newMetadata.size, 1);
    }

    return newMetadata;
  }

  async move(
    sourceFileId: string,
    destinationPath: string,
    userId?: string
  ): Promise<FileMetadata> {
    const sourceMetadata = this.fileIndex.get(sourceFileId);
    if (!sourceMetadata) {
      throw new StorageFileNotFoundError(sourceFileId);
    }

    const newFileId = uuidv4();
    const extension = sourceMetadata.filename.includes('.')
      ? sourceMetadata.filename.split('.').pop()
      : '';
    const destinationKey = `${destinationPath}/${newFileId}${extension ? `.${extension}` : ''}`;

    const newMetadata = await this.provider.move(sourceMetadata.key, destinationKey);
    newMetadata.id = newFileId;
    newMetadata.uploadedBy = userId || sourceMetadata.uploadedBy;

    this.fileIndex.delete(sourceFileId);
    this.fileIndex.set(newFileId, newMetadata);

    return newMetadata;
  }

  async getQuota(userId: string): Promise<StorageQuota> {
    let quota = this.quotas.get(userId);
    if (!quota) {
      quota = {
        userId,
        maxBytes: this.config.defaultQuotaBytes!,
        usedBytes: 0,
        fileCount: 0,
        maxFileCount: this.config.defaultMaxFileCount,
        updatedAt: new Date(),
      };
      this.quotas.set(userId, quota);
    }
    return quota;
  }

  async setQuota(userId: string, maxBytes: number, maxFileCount?: number): Promise<StorageQuota> {
    const quota = await this.getQuota(userId);
    quota.maxBytes = maxBytes;
    if (maxFileCount !== undefined) {
      quota.maxFileCount = maxFileCount;
    }
    quota.updatedAt = new Date();
    this.quotas.set(userId, quota);
    return quota;
  }

  private async checkQuota(userId: string, additionalBytes: number): Promise<void> {
    const quota = await this.getQuota(userId);

    if (quota.usedBytes + additionalBytes > quota.maxBytes) {
      throw new StorageQuotaExceededError(userId, quota.usedBytes, quota.maxBytes);
    }

    if (quota.maxFileCount && quota.fileCount >= quota.maxFileCount) {
      throw new StorageQuotaExceededError(userId, quota.fileCount, quota.maxFileCount);
    }
  }

  private async updateQuotaUsage(
    userId: string,
    bytesChange: number,
    fileCountChange: number
  ): Promise<void> {
    const quota = await this.getQuota(userId);
    quota.usedBytes = Math.max(0, quota.usedBytes + bytesChange);
    quota.fileCount = Math.max(0, quota.fileCount + fileCountChange);
    quota.updatedAt = new Date();
    this.quotas.set(userId, quota);
  }

  private validateContentType(filename: string, contentType: string): void {
    const extension = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : '';

    if (this.config.blockedExtensions?.length) {
      if (extension && this.config.blockedExtensions.includes(`.${extension}`)) {
        throw new StorageInvalidFileTypeError(
          filename,
          contentType,
          this.config.allowedExtensions || []
        );
      }
    }

    if (this.config.allowedExtensions?.length) {
      if (!extension || !this.config.allowedExtensions.includes(`.${extension}`)) {
        throw new StorageInvalidFileTypeError(filename, contentType, this.config.allowedExtensions);
      }
    }

    if (this.config.blockedMimeTypes?.length) {
      if (this.config.blockedMimeTypes.includes(contentType)) {
        throw new StorageInvalidFileTypeError(
          filename,
          contentType,
          this.config.allowedMimeTypes || []
        );
      }
    }

    if (this.config.allowedMimeTypes?.length) {
      if (!this.config.allowedMimeTypes.includes(contentType)) {
        throw new StorageInvalidFileTypeError(filename, contentType, this.config.allowedMimeTypes);
      }
    }
  }

  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  getFileCount(): number {
    return this.fileIndex.size;
  }

  clearFileIndex(): void {
    this.fileIndex.clear();
  }

  clearQuotas(): void {
    this.quotas.clear();
  }
}

export default StorageService;
