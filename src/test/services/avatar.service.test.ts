import { AvatarService } from '../../services/avatar.service';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');
jest.mock('sharp');

describe('AvatarService', () => {
  let avatarService: AvatarService;

  beforeEach(() => {
    avatarService = new AvatarService();
  });

  describe('uploadAvatar', () => {
    it('should upload avatar successfully', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const file = Buffer.from('test-image-data');
      const mimeType = 'image/jpeg';

      const result = await avatarService.uploadAvatar(userId, file, mimeType);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('thumbnailUrl');
      expect(result).toHaveProperty('key');
    });

    it('should throw error for invalid mime type', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const file = Buffer.from('test-data');
      const mimeType = 'application/pdf';

      await expect(avatarService.uploadAvatar(userId, file, mimeType)).rejects.toThrow(
        'Invalid file type'
      );
    });

    it('should throw error for file too large', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const file = Buffer.alloc(6 * 1024 * 1024);
      const mimeType = 'image/jpeg';

      await expect(avatarService.uploadAvatar(userId, file, mimeType)).rejects.toThrow(
        'File too large'
      );
    });

    it('should accept png files', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const file = Buffer.from('test-image-data');
      const mimeType = 'image/png';

      const result = await avatarService.uploadAvatar(userId, file, mimeType);

      expect(result).toHaveProperty('url');
    });

    it('should accept webp files', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const file = Buffer.from('test-image-data');
      const mimeType = 'image/webp';

      const result = await avatarService.uploadAvatar(userId, file, mimeType);

      expect(result).toHaveProperty('url');
    });

    it('should accept gif files', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const file = Buffer.from('test-image-data');
      const mimeType = 'image/gif';

      const result = await avatarService.uploadAvatar(userId, file, mimeType);

      expect(result).toHaveProperty('url');
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar successfully', async () => {
      const key = 'avatars/user123/avatar.webp';

      await expect(avatarService.deleteAvatar(key)).resolves.not.toThrow();
    });
  });

  describe('getPresignedUploadUrl', () => {
    it('should return presigned upload URL', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const contentType = 'image/jpeg';

      const result = await avatarService.getPresignedUploadUrl(userId, contentType);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('key');
    });

    it('should throw error for invalid content type', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const contentType = 'application/pdf';

      await expect(avatarService.getPresignedUploadUrl(userId, contentType)).rejects.toThrow(
        'Invalid content type'
      );
    });

    it('should handle png content type', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const contentType = 'image/png';

      const result = await avatarService.getPresignedUploadUrl(userId, contentType);

      expect(result.key).toContain('.png');
    });

    it('should handle webp content type', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const contentType = 'image/webp';

      const result = await avatarService.getPresignedUploadUrl(userId, contentType);

      expect(result.key).toContain('.webp');
    });

    it('should handle gif content type', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const contentType = 'image/gif';

      const result = await avatarService.getPresignedUploadUrl(userId, contentType);

      expect(result.key).toContain('.gif');
    });
  });

  describe('getPresignedDownloadUrl', () => {
    it('should return presigned download URL', async () => {
      const key = 'avatars/user123/avatar.webp';

      const result = await avatarService.getPresignedDownloadUrl(key);

      expect(result).toBe('https://presigned-url.example.com');
    });
  });
});
