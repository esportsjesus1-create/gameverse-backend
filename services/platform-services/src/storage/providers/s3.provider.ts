import {
  IStorageProvider,
  FileMetadata,
  UploadOptions,
  DownloadOptions,
  SignedUrlOptions,
  ListOptions,
  ListResult,
} from '../interfaces';
import {
  StorageFileNotFoundError,
  StorageUploadError,
  StorageDownloadError,
  StorageDeleteError,
  StorageSignedUrlError,
} from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

interface S3Config {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  bucket: string;
}

export class S3Provider implements IStorageProvider {
  readonly name = 's3';
  private config: S3Config;
  private logger: PlatformLogger;
  private sandbox: boolean;
  private mockStorage: Map<string, { data: Buffer; metadata: FileMetadata }> = new Map();

  constructor(config: S3Config, logger: PlatformLogger, sandbox = false) {
    this.config = config;
    this.logger = logger;
    this.sandbox = sandbox;
  }

  async upload(
    file: Buffer | NodeJS.ReadableStream,
    key: string,
    contentType: string,
    options?: UploadOptions
  ): Promise<FileMetadata> {
    const timer = this.logger.startTimer('s3_upload');
    const fileId = uuidv4();

    try {
      this.logger.event(EventTypes.STORAGE_UPLOAD_INITIATED, {
        fileId,
        key,
        contentType,
        bucket: options?.bucket || this.config.bucket,
      });

      const buffer =
        file instanceof Buffer ? file : await this.streamToBuffer(file as NodeJS.ReadableStream);
      const checksum = crypto.createHash('md5').update(buffer).digest('hex');

      if (this.sandbox) {
        return this.mockUpload(fileId, key, buffer, contentType, checksum, options);
      }

      const bucket = options?.bucket || this.config.bucket;
      const fullKey = options?.path ? `${options.path}/${key}` : key;

      await this.putObject(bucket, fullKey, buffer, contentType, options);

      const metadata: FileMetadata = {
        id: fileId,
        filename: key,
        originalFilename: key,
        contentType,
        size: buffer.length,
        bucket,
        key: fullKey,
        url: options?.isPublic ? this.getPublicUrl(bucket, fullKey) : undefined,
        isPublic: options?.isPublic || false,
        uploadedAt: new Date(),
        expiresAt: options?.expiresAt,
        checksum,
        metadata: options?.metadata,
        tags: options?.tags,
      };

      this.logger.event(EventTypes.STORAGE_UPLOAD_SUCCESS, {
        fileId,
        key: fullKey,
        size: buffer.length,
        bucket,
      });

      timer(true, { fileId, key: fullKey, size: buffer.length });

      return metadata;
    } catch (error) {
      this.logger.event(EventTypes.STORAGE_UPLOAD_FAILED, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });

      if (error instanceof StorageUploadError) {
        throw error;
      }
      throw new StorageUploadError(key, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async download(key: string, options?: DownloadOptions): Promise<Buffer> {
    const timer = this.logger.startTimer('s3_download');

    try {
      this.logger.event(EventTypes.STORAGE_DOWNLOAD_INITIATED, {
        key,
        bucket: this.config.bucket,
      });

      if (this.sandbox) {
        const stored = this.mockStorage.get(key);
        if (!stored) {
          throw new StorageFileNotFoundError(key);
        }
        timer(true, { key, size: stored.data.length });
        return stored.data;
      }

      const data = await this.getObject(this.config.bucket, key, options);

      this.logger.event(EventTypes.STORAGE_DOWNLOAD_SUCCESS, {
        key,
        size: data.length,
      });

      timer(true, { key, size: data.length });

      return data;
    } catch (error) {
      this.logger.event(EventTypes.STORAGE_DOWNLOAD_FAILED, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });

      if (error instanceof StorageFileNotFoundError) {
        throw error;
      }
      throw new StorageDownloadError(key, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async delete(key: string): Promise<void> {
    const timer = this.logger.startTimer('s3_delete');

    try {
      this.logger.event(EventTypes.STORAGE_DELETE_INITIATED, {
        key,
        bucket: this.config.bucket,
      });

      if (this.sandbox) {
        this.mockStorage.delete(key);
        timer(true, { key });
        return;
      }

      await this.deleteObject(this.config.bucket, key);

      this.logger.event(EventTypes.STORAGE_DELETE_SUCCESS, {
        key,
      });

      timer(true, { key });
    } catch (error) {
      this.logger.event(EventTypes.STORAGE_DELETE_FAILED, {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });

      throw new StorageDeleteError(key, error instanceof Error ? error.message : 'Unknown error');
    }
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
    if (this.sandbox) {
      return this.mockStorage.has(key);
    }

    try {
      await this.headObject(this.config.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<FileMetadata | null> {
    if (this.sandbox) {
      const stored = this.mockStorage.get(key);
      return stored?.metadata || null;
    }

    try {
      const response = await this.headObject(this.config.bucket, key);
      return {
        id: uuidv4(),
        filename: key.split('/').pop() || key,
        originalFilename: key.split('/').pop() || key,
        contentType: response.contentType || 'application/octet-stream',
        size: response.contentLength || 0,
        bucket: this.config.bucket,
        key,
        isPublic: false,
        uploadedAt: response.lastModified || new Date(),
        checksum: response.etag?.replace(/"/g, ''),
        metadata: response.metadata,
      };
    } catch {
      return null;
    }
  }

  async updateMetadata(key: string, metadata: Record<string, string>): Promise<FileMetadata> {
    const timer = this.logger.startTimer('s3_update_metadata');

    try {
      if (this.sandbox) {
        const stored = this.mockStorage.get(key);
        if (!stored) {
          throw new StorageFileNotFoundError(key);
        }
        stored.metadata.metadata = { ...stored.metadata.metadata, ...metadata };
        timer(true, { key });
        return stored.metadata;
      }

      const existingMetadata = await this.getMetadata(key);
      if (!existingMetadata) {
        throw new StorageFileNotFoundError(key);
      }

      await this.copyObject(this.config.bucket, key, this.config.bucket, key, {
        ...existingMetadata.metadata,
        ...metadata,
      });

      this.logger.event(EventTypes.STORAGE_METADATA_UPDATED, {
        key,
        metadata,
      });

      timer(true, { key });

      return {
        ...existingMetadata,
        metadata: { ...existingMetadata.metadata, ...metadata },
      };
    } catch (error) {
      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  async list(options?: ListOptions): Promise<ListResult> {
    if (this.sandbox) {
      const files = Array.from(this.mockStorage.values())
        .filter((item) => !options?.prefix || item.metadata.key.startsWith(options.prefix))
        .map((item) => item.metadata);

      return {
        files: files.slice(0, options?.maxKeys || 1000),
        isTruncated: files.length > (options?.maxKeys || 1000),
        keyCount: Math.min(files.length, options?.maxKeys || 1000),
      };
    }

    const response = await this.listObjects(
      options?.bucket || this.config.bucket,
      options?.prefix,
      options?.maxKeys,
      options?.continuationToken
    );

    return response;
  }

  async getSignedUploadUrl(
    key: string,
    contentType: string,
    options?: SignedUrlOptions
  ): Promise<string> {
    const timer = this.logger.startTimer('s3_signed_upload_url');

    try {
      if (this.sandbox) {
        const url = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}?X-Amz-Signature=mock`;
        timer(true, { key });
        return url;
      }

      const expiresIn = options?.expiresInSeconds || 3600;
      const url = await this.generatePresignedUrl(
        this.config.bucket,
        key,
        'PUT',
        expiresIn,
        contentType
      );

      this.logger.event(EventTypes.STORAGE_SIGNED_URL_GENERATED, {
        key,
        operation: 'upload',
        expiresIn,
      });

      timer(true, { key, expiresIn });

      return url;
    } catch (error) {
      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });
      throw new StorageSignedUrlError(
        key,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const timer = this.logger.startTimer('s3_signed_download_url');

    try {
      if (this.sandbox) {
        const url = `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}?X-Amz-Signature=mock`;
        timer(true, { key });
        return url;
      }

      const expiresIn = options?.expiresInSeconds || 3600;
      const url = await this.generatePresignedUrl(this.config.bucket, key, 'GET', expiresIn);

      this.logger.event(EventTypes.STORAGE_SIGNED_URL_GENERATED, {
        key,
        operation: 'download',
        expiresIn,
      });

      timer(true, { key, expiresIn });

      return url;
    } catch (error) {
      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });
      throw new StorageSignedUrlError(
        key,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async copy(sourceKey: string, destinationKey: string): Promise<FileMetadata> {
    if (this.sandbox) {
      const source = this.mockStorage.get(sourceKey);
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
      this.mockStorage.set(destinationKey, { data: source.data, metadata: newMetadata });
      return newMetadata;
    }

    await this.copyObject(this.config.bucket, sourceKey, this.config.bucket, destinationKey);
    const metadata = await this.getMetadata(destinationKey);
    if (!metadata) {
      throw new StorageFileNotFoundError(destinationKey);
    }
    return metadata;
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

  private mockUpload(
    fileId: string,
    key: string,
    data: Buffer,
    contentType: string,
    checksum: string,
    options?: UploadOptions
  ): FileMetadata {
    const bucket = options?.bucket || this.config.bucket;
    const fullKey = options?.path ? `${options.path}/${key}` : key;

    const metadata: FileMetadata = {
      id: fileId,
      filename: key,
      originalFilename: key,
      contentType,
      size: data.length,
      bucket,
      key: fullKey,
      url: options?.isPublic ? `https://${bucket}.s3.amazonaws.com/${fullKey}` : undefined,
      isPublic: options?.isPublic || false,
      uploadedAt: new Date(),
      expiresAt: options?.expiresAt,
      checksum,
      metadata: options?.metadata,
      tags: options?.tags,
    };

    this.mockStorage.set(fullKey, { data, metadata });

    this.logger.info(`[SANDBOX] File uploaded: ${fullKey}`, {
      fileId,
      size: data.length,
      contentType,
    });

    return metadata;
  }

  private getPublicUrl(bucket: string, key: string): string {
    if (this.config.endpoint) {
      return `${this.config.endpoint}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  private async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
    options?: UploadOptions
  ): Promise<void> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    const url = `${endpoint}/${bucket}/${key}`;

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': body.length.toString(),
    };

    if (options?.cacheControl) {
      headers['Cache-Control'] = options.cacheControl;
    }
    if (options?.contentDisposition) {
      headers['Content-Disposition'] = options.contentDisposition;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`S3 PUT failed: ${response.status} ${response.statusText}`);
    }
  }

  private async getObject(
    bucket: string,
    key: string,
    _options?: DownloadOptions
  ): Promise<Buffer> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    const url = `${endpoint}/${bucket}/${key}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new StorageFileNotFoundError(key);
      }
      throw new Error(`S3 GET failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async deleteObject(bucket: string, key: string): Promise<void> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    const url = `${endpoint}/${bucket}/${key}`;

    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok && response.status !== 204) {
      throw new Error(`S3 DELETE failed: ${response.status} ${response.statusText}`);
    }
  }

  private async headObject(
    bucket: string,
    key: string
  ): Promise<{
    contentType?: string;
    contentLength?: number;
    lastModified?: Date;
    etag?: string;
    metadata?: Record<string, string>;
  }> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    const url = `${endpoint}/${bucket}/${key}`;

    const response = await fetch(url, { method: 'HEAD' });

    if (!response.ok) {
      throw new Error(`S3 HEAD failed: ${response.status} ${response.statusText}`);
    }

    return {
      contentType: response.headers.get('content-type') || undefined,
      contentLength: parseInt(response.headers.get('content-length') || '0', 10),
      lastModified: response.headers.get('last-modified')
        ? new Date(response.headers.get('last-modified')!)
        : undefined,
      etag: response.headers.get('etag') || undefined,
    };
  }

  private async copyObject(
    sourceBucket: string,
    sourceKey: string,
    destBucket: string,
    destKey: string,
    _metadata?: Record<string, string>
  ): Promise<void> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    const url = `${endpoint}/${destBucket}/${destKey}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'x-amz-copy-source': `/${sourceBucket}/${sourceKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`S3 COPY failed: ${response.status} ${response.statusText}`);
    }
  }

  private async listObjects(
    bucket: string,
    prefix?: string,
    maxKeys?: number,
    continuationToken?: string
  ): Promise<ListResult> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;
    const params = new URLSearchParams({ 'list-type': '2' });

    if (prefix) params.append('prefix', prefix);
    if (maxKeys) params.append('max-keys', maxKeys.toString());
    if (continuationToken) params.append('continuation-token', continuationToken);

    const url = `${endpoint}/${bucket}?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`S3 LIST failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();

    const files: FileMetadata[] = [];
    const keyRegex = /<Key>([^<]+)<\/Key>/g;
    let match;
    while ((match = keyRegex.exec(text)) !== null) {
      files.push({
        id: uuidv4(),
        filename: match[1].split('/').pop() || match[1],
        originalFilename: match[1].split('/').pop() || match[1],
        contentType: 'application/octet-stream',
        size: 0,
        bucket,
        key: match[1],
        isPublic: false,
        uploadedAt: new Date(),
      });
    }

    const isTruncatedMatch = text.match(/<IsTruncated>([^<]+)<\/IsTruncated>/);
    const nextTokenMatch = text.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/);

    return {
      files,
      isTruncated: isTruncatedMatch?.[1] === 'true',
      continuationToken: nextTokenMatch?.[1],
      keyCount: files.length,
    };
  }

  private async generatePresignedUrl(
    bucket: string,
    key: string,
    method: 'GET' | 'PUT',
    expiresIn: number,
    contentType?: string
  ): Promise<string> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region}.amazonaws.com`;

    const params = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Expires': expiresIn.toString(),
      'X-Amz-SignedHeaders': 'host',
    });

    if (contentType && method === 'PUT') {
      params.append('Content-Type', contentType);
    }

    return `${endpoint}/${bucket}/${key}?${params.toString()}`;
  }

  getMockStorage(): Map<string, { data: Buffer; metadata: FileMetadata }> {
    return new Map(this.mockStorage);
  }

  clearMockStorage(): void {
    this.mockStorage.clear();
  }
}

export default S3Provider;
