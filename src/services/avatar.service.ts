import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AvatarUploadResult } from '../types';
import { logger } from '../utils/logger';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;
const THUMBNAIL_SIZE = 64;

export class AvatarService {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    const s3Config: ConstructorParameters<typeof S3Client>[0] = {
      region: config.aws.region,
    };

    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      s3Config.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      };
    }

    if (config.aws.s3Endpoint) {
      s3Config.endpoint = config.aws.s3Endpoint;
      s3Config.forcePathStyle = true;
    }

    this.s3Client = new S3Client(s3Config);
    this.bucket = config.aws.s3Bucket;
  }

  async uploadAvatar(
    userId: string,
    file: Buffer,
    mimeType: string
  ): Promise<AvatarUploadResult> {
    this.validateFile(file, mimeType);

    const avatarBuffer = await this.processImage(file, AVATAR_SIZE);
    const thumbnailBuffer = await this.processImage(file, THUMBNAIL_SIZE);

    const avatarKey = `avatars/${userId}/${uuidv4()}.webp`;
    const thumbnailKey = `avatars/${userId}/${uuidv4()}_thumb.webp`;

    await Promise.all([
      this.uploadToS3(avatarKey, avatarBuffer, 'image/webp'),
      this.uploadToS3(thumbnailKey, thumbnailBuffer, 'image/webp'),
    ]);

    const avatarUrl = this.getPublicUrl(avatarKey);
    const thumbnailUrl = this.getPublicUrl(thumbnailKey);

    logger.info('Avatar uploaded', { userId, avatarKey, thumbnailKey });

    return {
      url: avatarUrl,
      thumbnailUrl,
      key: avatarKey,
    };
  }

  private validateFile(file: Buffer, mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(
        `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    if (file.length > MAX_FILE_SIZE) {
      throw new Error(
        `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }
  }

  private async processImage(buffer: Buffer, size: number): Promise<Buffer> {
    return sharp(buffer)
      .resize(size, size, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 80 })
      .toBuffer();
  }

  private async uploadToS3(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'max-age=31536000',
    });

    await this.s3Client.send(command);
  }

  async deleteAvatar(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    logger.info('Avatar deleted', { key });
  }

  async getPresignedUploadUrl(
    userId: string,
    contentType: string
  ): Promise<{ url: string; key: string }> {
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new Error(
        `Invalid content type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    const key = `avatars/${userId}/${uuidv4()}.${this.getExtension(contentType)}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

    return { url, key };
  }

  async getPresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  private getPublicUrl(key: string): string {
    if (config.aws.s3Endpoint) {
      return `${config.aws.s3Endpoint}/${this.bucket}/${key}`;
    }
    return `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }

  private getExtension(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    return extensions[mimeType] ?? 'jpg';
  }
}

export const avatarService = new AvatarService();
