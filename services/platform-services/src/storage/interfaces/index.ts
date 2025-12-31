export interface FileMetadata {
  id: string;
  filename: string;
  originalFilename: string;
  contentType: string;
  size: number;
  bucket: string;
  key: string;
  url?: string;
  isPublic: boolean;
  uploadedBy?: string;
  uploadedAt: Date;
  expiresAt?: Date;
  checksum?: string;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
}

export interface UploadOptions {
  bucket?: string;
  path?: string;
  isPublic?: boolean;
  expiresAt?: Date;
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  contentDisposition?: string;
  cacheControl?: string;
}

export interface DownloadOptions {
  responseContentType?: string;
  responseContentDisposition?: string;
  versionId?: string;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  contentType?: string;
  contentDisposition?: string;
  responseContentType?: string;
}

export interface ListOptions {
  bucket?: string;
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
  delimiter?: string;
}

export interface ListResult {
  files: FileMetadata[];
  continuationToken?: string;
  isTruncated: boolean;
  keyCount: number;
}

export interface StorageProviderConfig {
  provider: 's3' | 'mock';
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  endpoint?: string;
  bucket: string;
  publicBucket?: string;
  cdnUrl?: string;
}

export interface IStorageProvider {
  name: string;
  upload(
    file: Buffer | NodeJS.ReadableStream,
    key: string,
    contentType: string,
    options?: UploadOptions
  ): Promise<FileMetadata>;
  download(key: string, options?: DownloadOptions): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deleteMany(
    keys: string[]
  ): Promise<{ deleted: string[]; errors: { key: string; error: string }[] }>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<FileMetadata | null>;
  updateMetadata(key: string, metadata: Record<string, string>): Promise<FileMetadata>;
  list(options?: ListOptions): Promise<ListResult>;
  getSignedUploadUrl(key: string, contentType: string, options?: SignedUrlOptions): Promise<string>;
  getSignedDownloadUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  copy(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
  move(sourceKey: string, destinationKey: string): Promise<FileMetadata>;
}

export interface StorageQuota {
  userId: string;
  maxBytes: number;
  usedBytes: number;
  fileCount: number;
  maxFileCount?: number;
  updatedAt: Date;
}

export interface StorageServiceConfig {
  provider: StorageProviderConfig;
  defaultBucket: string;
  publicBucket?: string;
  maxFileSize: number;
  allowedMimeTypes?: string[];
  blockedMimeTypes?: string[];
  allowedExtensions?: string[];
  blockedExtensions?: string[];
  defaultQuotaBytes?: number;
  defaultMaxFileCount?: number;
  signedUrlExpiresSeconds?: number;
  enableVersioning?: boolean;
  cdnUrl?: string;
}

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format?: 'jpeg' | 'png' | 'webp' | 'avif';
  quality?: number;
}
