import { ISecretService, Secret, SecretSetOptions, RotationPolicy } from '../interfaces';
import { ConfigSecretError, ConfigNotFoundError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class SecretService implements ISecretService {
  private secrets: Map<string, Secret> = new Map();
  private logger: PlatformLogger;
  private encryptionKey: Buffer;
  private environment: string;

  constructor(logger: PlatformLogger, encryptionKey?: string, environment?: string) {
    this.logger = logger;
    this.encryptionKey = encryptionKey ? Buffer.from(encryptionKey, 'hex') : crypto.randomBytes(32);
    this.environment = environment || process.env.NODE_ENV || 'development';
  }

  async initialize(): Promise<void> {
    await this.loadFromEnv();

    this.logger.event(EventTypes.CONFIG_LOADED, {
      environment: this.environment,
      secretCount: this.secrets.size,
      type: 'secrets',
    });
  }

  async get(name: string): Promise<string | null> {
    const secret = this.secrets.get(name);
    if (!secret) {
      return null;
    }

    if (secret.expiresAt && new Date() > secret.expiresAt) {
      this.logger.warn(`Secret ${name} has expired`);
      return null;
    }

    secret.lastAccessedAt = new Date();

    this.logger.event(EventTypes.CONFIG_SECRET_ACCESSED, {
      secretName: name,
      environment: secret.environment,
    });

    return this.decrypt(secret.value);
  }

  async set(name: string, value: string, options?: SecretSetOptions): Promise<Secret> {
    const timer = this.logger.startTimer('secret_set');

    try {
      const existing = this.secrets.get(name);
      const now = new Date();
      const encryptedValue = this.encrypt(value);

      const secret: Secret = {
        name,
        value: encryptedValue,
        description: options?.description,
        environment: options?.environment || this.environment,
        expiresAt: options?.expiresAt,
        rotationPolicy: options?.rotationPolicy,
        version: existing ? existing.version + 1 : 1,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        metadata: options?.metadata,
      };

      this.secrets.set(name, secret);

      this.logger.audit({
        eventType: EventTypes.CONFIG_SECRET_UPDATED,
        operation: existing ? 'update' : 'create',
        resource: 'secret',
        resourceId: name,
        oldValue: existing ? { version: existing.version } : undefined,
        newValue: { version: secret.version },
        success: true,
        correlationId: uuidv4(),
      });

      timer(true, { secretName: name, version: secret.version });

      return {
        ...secret,
        value: '********',
      };
    } catch (error) {
      timer(false, { secretName: name, error: error instanceof Error ? error.message : 'Unknown' });
      throw new ConfigSecretError(name, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async delete(name: string): Promise<void> {
    const existing = this.secrets.get(name);
    if (!existing) {
      throw new ConfigNotFoundError(name);
    }

    this.secrets.delete(name);

    this.logger.audit({
      eventType: EventTypes.CONFIG_SECRET_UPDATED,
      operation: 'delete',
      resource: 'secret',
      resourceId: name,
      oldValue: { version: existing.version },
      success: true,
      correlationId: uuidv4(),
    });
  }

  async list(): Promise<Omit<Secret, 'value'>[]> {
    return Array.from(this.secrets.values()).map((secret) => ({
      name: secret.name,
      description: secret.description,
      environment: secret.environment,
      expiresAt: secret.expiresAt,
      rotationPolicy: secret.rotationPolicy,
      version: secret.version,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      lastAccessedAt: secret.lastAccessedAt,
      metadata: secret.metadata,
    }));
  }

  async rotate(name: string, newValue: string): Promise<Secret> {
    const existing = this.secrets.get(name);
    if (!existing) {
      throw new ConfigNotFoundError(name);
    }

    const now = new Date();
    const encryptedValue = this.encrypt(newValue);

    const rotationPolicy: RotationPolicy | undefined = existing.rotationPolicy
      ? {
          ...existing.rotationPolicy,
          lastRotatedAt: now,
          nextRotationAt: existing.rotationPolicy.intervalDays
            ? new Date(now.getTime() + existing.rotationPolicy.intervalDays * 24 * 60 * 60 * 1000)
            : undefined,
        }
      : undefined;

    const secret: Secret = {
      ...existing,
      value: encryptedValue,
      version: existing.version + 1,
      updatedAt: now,
      rotationPolicy,
    };

    this.secrets.set(name, secret);

    this.logger.audit({
      eventType: EventTypes.CONFIG_SECRET_ROTATED,
      operation: 'rotate',
      resource: 'secret',
      resourceId: name,
      oldValue: { version: existing.version },
      newValue: { version: secret.version },
      success: true,
      correlationId: uuidv4(),
    });

    this.logger.event(EventTypes.CONFIG_SECRET_ROTATED, {
      secretName: name,
      version: secret.version,
      nextRotationAt: rotationPolicy?.nextRotationAt,
    });

    return {
      ...secret,
      value: '********',
    };
  }

  async getMetadata(name: string): Promise<Omit<Secret, 'value'> | null> {
    const secret = this.secrets.get(name);
    if (!secret) {
      return null;
    }

    return {
      name: secret.name,
      description: secret.description,
      environment: secret.environment,
      expiresAt: secret.expiresAt,
      rotationPolicy: secret.rotationPolicy,
      version: secret.version,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      lastAccessedAt: secret.lastAccessedAt,
      metadata: secret.metadata,
    };
  }

  async checkRotationDue(): Promise<string[]> {
    const dueForRotation: string[] = [];
    const now = new Date();

    for (const [name, secret] of this.secrets) {
      if (
        secret.rotationPolicy?.enabled &&
        secret.rotationPolicy.nextRotationAt &&
        secret.rotationPolicy.nextRotationAt <= now
      ) {
        dueForRotation.push(name);
      }
    }

    if (dueForRotation.length > 0) {
      this.logger.warn(`Secrets due for rotation: ${dueForRotation.join(', ')}`);
    }

    return dueForRotation;
  }

  async checkExpired(): Promise<string[]> {
    const expired: string[] = [];
    const now = new Date();

    for (const [name, secret] of this.secrets) {
      if (secret.expiresAt && secret.expiresAt <= now) {
        expired.push(name);
      }
    }

    if (expired.length > 0) {
      this.logger.warn(`Expired secrets: ${expired.join(', ')}`);
    }

    return expired;
  }

  private async loadFromEnv(): Promise<void> {
    const secretPatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /api_key/i,
      /apikey/i,
      /auth/i,
      /credential/i,
      /private/i,
    ];

    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined && secretPatterns.some((pattern) => pattern.test(key))) {
        const encryptedValue = this.encrypt(value);
        this.secrets.set(key, {
          name: key,
          value: encryptedValue,
          environment: this.environment,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  private encrypt(value: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      return encryptedValue;
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  getSecretCount(): number {
    return this.secrets.size;
  }

  clearSecrets(): void {
    this.secrets.clear();
  }
}

export default SecretService;
