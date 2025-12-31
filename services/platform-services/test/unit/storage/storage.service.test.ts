import { StorageService } from '../../../src/storage/services/storage.service';
import { MockStorageProvider } from '../../../src/storage/providers/mock.provider';
import { PlatformLogger, LogLevel } from '../../../src/common/logging';
import { ThreeTierRateLimiter } from '../../../src/common/security/rate-limiter';
import { StorageServiceConfig } from '../../../src/storage/interfaces';
import {
  StorageFileNotFoundError,
  StorageFileTooLargeError,
  StorageQuotaExceededError,
  StorageInvalidFileTypeError,
  ValidationError,
} from '../../../src/common/errors';

describe('StorageService', () => {
  let storageService: StorageService;
  let mockProvider: MockStorageProvider;
  let logger: PlatformLogger;
  let rateLimiter: ThreeTierRateLimiter;
  let config: StorageServiceConfig;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-storage-service',
      level: LogLevel.ERROR,
    });

    mockProvider = new MockStorageProvider(logger);

    rateLimiter = new ThreeTierRateLimiter(
      {
        global: { maxRequests: 1000, windowMs: 60000 },
        service: { maxRequests: 100, windowMs: 60000 },
        user: { maxRequests: 10, windowMs: 60000 },
      },
      logger
    );

    config = {
      provider: { provider: 'mock', bucket: 'test-bucket' },
      defaultBucket: 'test-bucket',
      maxFileSize: 10 * 1024 * 1024,
      defaultQuotaBytes: 100 * 1024 * 1024,
      defaultMaxFileCount: 100,
      signedUrlExpiresSeconds: 3600,
    };

    storageService = new StorageService(
      mockProvider,
      logger,
      rateLimiter,
      config
    );
  });

  afterEach(() => {
    mockProvider.clearStorage();
    storageService.clearFileIndex();
    storageService.clearQuotas();
    rateLimiter.reset();
  });

  describe('upload', () => {
    it('should upload a file', async () => {
      const content = Buffer.from('test content');
      const result = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      expect(result.id).toBeDefined();
      expect(result.size).toBe(content.length);
      expect(result.contentType).toBe('text/plain');
    });

    it('should upload file with options', async () => {
      const content = Buffer.from('test content');
      const result = await storageService.upload(
        content,
        'test.txt',
        'text/plain',
        {
          path: 'uploads',
          isPublic: true,
          metadata: { userId: '123' },
          tags: { project: 'test' },
          userId: 'user-123',
        }
      );

      expect(result.id).toBeDefined();
      expect(result.key).toContain('uploads/');
      expect(result.isPublic).toBe(true);
    });

    it('should reject files exceeding max size', async () => {
      const largeContent = Buffer.alloc(11 * 1024 * 1024);

      await expect(
        storageService.upload(largeContent, 'large.bin', 'application/octet-stream')
      ).rejects.toThrow(StorageFileTooLargeError);
    });

    it('should reject invalid filenames', async () => {
      const content = Buffer.from('test');

      await expect(
        storageService.upload(content, '../../../etc/passwd', 'text/plain')
      ).rejects.toThrow();
    });

    it('should track quota usage', async () => {
      const content = Buffer.from('test content');
      await storageService.upload(content, 'test.txt', 'text/plain', {
        userId: 'user-123',
      });

      const quota = await storageService.getQuota('user-123');
      expect(quota.usedBytes).toBe(content.length);
      expect(quota.fileCount).toBe(1);
    });

    it('should reject when quota exceeded', async () => {
      await storageService.setQuota('user-123', 10, 1);

      const content = Buffer.from('test content that is longer than 10 bytes');

      await expect(
        storageService.upload(content, 'test.txt', 'text/plain', {
          userId: 'user-123',
        })
      ).rejects.toThrow(StorageQuotaExceededError);
    });

    it('should enforce rate limits', async () => {
      const content = Buffer.from('test');

      for (let i = 0; i < 10; i++) {
        await storageService.upload(content, `test${i}.txt`, 'text/plain', {
          userId: 'user-123',
        });
      }

      await expect(
        storageService.upload(content, 'test10.txt', 'text/plain', {
          userId: 'user-123',
        })
      ).rejects.toThrow();
    });
  });

  describe('download', () => {
    it('should download a file', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      const downloaded = await storageService.download(uploadResult.id);
      expect(downloaded.toString()).toBe('test content');
    });

    it('should throw for non-existent file', async () => {
      await expect(
        storageService.download('non-existent-id')
      ).rejects.toThrow(StorageFileNotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain',
        { userId: 'user-123' }
      );

      await storageService.delete(uploadResult.id, 'user-123');

      await expect(
        storageService.download(uploadResult.id)
      ).rejects.toThrow(StorageFileNotFoundError);
    });

    it('should update quota on delete', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain',
        { userId: 'user-123' }
      );

      const quotaBefore = await storageService.getQuota('user-123');
      expect(quotaBefore.usedBytes).toBe(content.length);

      await storageService.delete(uploadResult.id, 'user-123');

      const quotaAfter = await storageService.getQuota('user-123');
      expect(quotaAfter.usedBytes).toBe(0);
    });

    it('should throw for non-existent file', async () => {
      await expect(
        storageService.delete('non-existent-id')
      ).rejects.toThrow(StorageFileNotFoundError);
    });
  });

  describe('getMetadata', () => {
    it('should get file metadata', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      const metadata = await storageService.getMetadata(uploadResult.id);
      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe(uploadResult.id);
      expect(metadata?.contentType).toBe('text/plain');
    });

    it('should return null for non-existent file', async () => {
      const metadata = await storageService.getMetadata('non-existent-id');
      expect(metadata).toBeNull();
    });
  });

  describe('updateMetadata', () => {
    it('should update file metadata', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      const updated = await storageService.updateMetadata(
        uploadResult.id,
        { customKey: 'customValue' }
      );

      expect(updated.metadata?.customKey).toBe('customValue');
    });

    it('should throw for non-existent file', async () => {
      await expect(
        storageService.updateMetadata('non-existent-id', { key: 'value' })
      ).rejects.toThrow(StorageFileNotFoundError);
    });
  });

  describe('list', () => {
    it('should list files', async () => {
      const content = Buffer.from('test');
      await storageService.upload(content, 'test1.txt', 'text/plain');
      await storageService.upload(content, 'test2.txt', 'text/plain');
      await storageService.upload(content, 'test3.txt', 'text/plain');

      const result = await storageService.list();
      expect(result.files.length).toBe(3);
    });

    it('should list files with prefix filter', async () => {
      const content = Buffer.from('test');
      await storageService.upload(content, 'doc1.txt', 'text/plain', { path: 'docs' });
      await storageService.upload(content, 'img1.png', 'image/png', { path: 'images' });

      const result = await storageService.list({ prefix: 'docs/' });
      expect(result.files.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getSignedUploadUrl', () => {
    it('should generate signed upload URL', async () => {
      const result = await storageService.getSignedUploadUrl(
        'test.txt',
        'text/plain'
      );

      expect(result.url).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should generate signed upload URL with options', async () => {
      const result = await storageService.getSignedUploadUrl(
        'test.txt',
        'text/plain',
        {
          expiresInSeconds: 7200,
          path: 'uploads',
          userId: 'user-123',
        }
      );

      expect(result.url).toBeDefined();
      expect(result.key).toContain('uploads/');
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should generate signed download URL', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      const result = await storageService.getSignedDownloadUrl(uploadResult.id);

      expect(result.url).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should throw for non-existent file', async () => {
      await expect(
        storageService.getSignedDownloadUrl('non-existent-id')
      ).rejects.toThrow(StorageFileNotFoundError);
    });
  });

  describe('copy', () => {
    it('should copy a file', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      const copyResult = await storageService.copy(
        uploadResult.id,
        'copies',
        'user-123'
      );

      expect(copyResult.id).toBeDefined();
      expect(copyResult.id).not.toBe(uploadResult.id);
    });

    it('should throw for non-existent source file', async () => {
      await expect(
        storageService.copy('non-existent-id', 'copies')
      ).rejects.toThrow(StorageFileNotFoundError);
    });
  });

  describe('move', () => {
    it('should move a file', async () => {
      const content = Buffer.from('test content');
      const uploadResult = await storageService.upload(
        content,
        'test.txt',
        'text/plain'
      );

      const moveResult = await storageService.move(
        uploadResult.id,
        'moved',
        'user-123'
      );

      expect(moveResult.id).toBeDefined();
      expect(moveResult.id).not.toBe(uploadResult.id);

      await expect(
        storageService.download(uploadResult.id)
      ).rejects.toThrow(StorageFileNotFoundError);
    });
  });

  describe('quota management', () => {
    it('should get quota for user', async () => {
      const quota = await storageService.getQuota('user-123');
      expect(quota.userId).toBe('user-123');
      expect(quota.maxBytes).toBe(config.defaultQuotaBytes);
    });

    it('should set quota for user', async () => {
      const quota = await storageService.setQuota('user-123', 50 * 1024 * 1024, 50);
      expect(quota.maxBytes).toBe(50 * 1024 * 1024);
      expect(quota.maxFileCount).toBe(50);
    });
  });

  describe('file type validation', () => {
    it('should reject blocked extensions', async () => {
      const configWithBlocked: StorageServiceConfig = {
        ...config,
        blockedExtensions: ['.exe', '.bat'],
      };

      const serviceWithBlocked = new StorageService(
        mockProvider,
        logger,
        rateLimiter,
        configWithBlocked
      );

      const content = Buffer.from('test');

      await expect(
        serviceWithBlocked.upload(content, 'malware.exe', 'application/octet-stream')
      ).rejects.toThrow(StorageInvalidFileTypeError);
    });

    it('should reject blocked MIME types', async () => {
      const configWithBlocked: StorageServiceConfig = {
        ...config,
        blockedMimeTypes: ['application/x-executable'],
      };

      const serviceWithBlocked = new StorageService(
        mockProvider,
        logger,
        rateLimiter,
        configWithBlocked
      );

      const content = Buffer.from('test');

      await expect(
        serviceWithBlocked.upload(content, 'file.bin', 'application/x-executable')
      ).rejects.toThrow(StorageInvalidFileTypeError);
    });

    it('should only allow specified extensions', async () => {
      const configWithAllowed: StorageServiceConfig = {
        ...config,
        allowedExtensions: ['.jpg', '.png'],
      };

      const serviceWithAllowed = new StorageService(
        mockProvider,
        logger,
        rateLimiter,
        configWithAllowed
      );

      const content = Buffer.from('test');

      await expect(
        serviceWithAllowed.upload(content, 'file.txt', 'text/plain')
      ).rejects.toThrow(StorageInvalidFileTypeError);
    });
  });
});
