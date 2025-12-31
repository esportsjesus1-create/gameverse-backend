import {
  IConfigService,
  ConfigValue,
  ConfigSetOptions,
  ConfigFilter,
  ConfigServiceOptions,
} from '../interfaces';
import { ConfigNotFoundError, ConfigValidationError, ConfigUpdateError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

export class ConfigService implements IConfigService {
  private configs: Map<string, ConfigValue> = new Map();
  private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();
  private logger: PlatformLogger;
  private options: ConfigServiceOptions;
  private environment: string;

  constructor(logger: PlatformLogger, options?: ConfigServiceOptions) {
    this.logger = logger;
    this.options = {
      environment: process.env.NODE_ENV || 'development',
      cacheEnabled: true,
      cacheTtlMs: 60000,
      validateOnLoad: true,
      ...options,
    };
    this.environment = this.options.environment!;
  }

  async initialize(): Promise<void> {
    await this.loadFromEnv();

    if (this.options.envFilePath) {
      await this.loadFromFile(this.options.envFilePath);
    }

    this.logger.event(EventTypes.CONFIG_LOADED, {
      environment: this.environment,
      configCount: this.configs.size,
    });
  }

  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    if (this.options.cacheEnabled) {
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.value as T;
      }
    }

    const config = this.configs.get(key);
    if (!config) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new ConfigNotFoundError(key);
    }

    if (config.validFrom && new Date() < config.validFrom) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new ConfigNotFoundError(key);
    }

    if (config.validUntil && new Date() > config.validUntil) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new ConfigNotFoundError(key);
    }

    const value = this.parseValue(config.value, config.type);

    if (this.options.cacheEnabled) {
      this.cache.set(key, {
        value,
        expiresAt: Date.now() + this.options.cacheTtlMs!,
      });
    }

    return value as T;
  }

  async set(key: string, value: unknown, options?: ConfigSetOptions): Promise<ConfigValue> {
    const timer = this.logger.startTimer('config_set');

    try {
      const type = options?.type || this.inferType(value);
      const serializedValue = this.serializeValue(value, type);

      if (this.options.validateOnLoad) {
        this.validateValue(serializedValue, type);
      }

      const existing = this.configs.get(key);
      const now = new Date();

      const configValue: ConfigValue = {
        key,
        value: serializedValue,
        type,
        description: options?.description,
        isSecret: options?.isSecret || false,
        environment: options?.environment || this.environment,
        validFrom: options?.validFrom,
        validUntil: options?.validUntil,
        version: existing ? existing.version + 1 : 1,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        metadata: options?.metadata,
      };

      this.configs.set(key, configValue);

      this.cache.delete(key);

      this.logger.event(EventTypes.CONFIG_UPDATED, {
        key,
        type,
        version: configValue.version,
        isSecret: configValue.isSecret,
      });

      this.logger.audit({
        eventType: EventTypes.CONFIG_UPDATED,
        operation: existing ? 'update' : 'create',
        resource: 'config',
        resourceId: key,
        oldValue: existing ? { version: existing.version } : undefined,
        newValue: { version: configValue.version, type },
        success: true,
        correlationId: uuidv4(),
      });

      timer(true, { key, version: configValue.version });

      return configValue;
    } catch (error) {
      timer(false, { key, error: error instanceof Error ? error.message : 'Unknown' });
      throw new ConfigUpdateError(key, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async delete(key: string): Promise<void> {
    const existing = this.configs.get(key);
    if (!existing) {
      throw new ConfigNotFoundError(key);
    }

    this.configs.delete(key);
    this.cache.delete(key);

    this.logger.audit({
      eventType: EventTypes.CONFIG_UPDATED,
      operation: 'delete',
      resource: 'config',
      resourceId: key,
      oldValue: { version: existing.version },
      success: true,
      correlationId: uuidv4(),
    });
  }

  async list(filter?: ConfigFilter): Promise<ConfigValue[]> {
    let configs = Array.from(this.configs.values());

    if (filter?.environment) {
      configs = configs.filter((c) => c.environment === filter.environment);
    }

    if (filter?.isSecret !== undefined) {
      configs = configs.filter((c) => c.isSecret === filter.isSecret);
    }

    if (filter?.prefix) {
      configs = configs.filter((c) => c.key.startsWith(filter.prefix!));
    }

    return configs.map((c) => ({
      ...c,
      value: c.isSecret ? '********' : c.value,
    }));
  }

  async getAll(): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, config] of this.configs) {
      if (!config.isSecret) {
        result[key] = this.parseValue(config.value, config.type);
      }
    }

    return result;
  }

  async reload(): Promise<void> {
    this.cache.clear();
    this.configs.clear();
    await this.initialize();

    this.logger.event(EventTypes.CONFIG_LOADED, {
      environment: this.environment,
      configCount: this.configs.size,
      reloaded: true,
    });
  }

  private async loadFromEnv(): Promise<void> {
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        const type = this.inferType(value);
        this.configs.set(key, {
          key,
          value,
          type,
          isSecret: this.isSecretKey(key),
          environment: this.environment,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  private async loadFromFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      this.logger.warn(`Config file not found: ${absolutePath}`);
      return;
    }

    const result = dotenv.config({ path: absolutePath });

    if (result.error) {
      this.logger.error(`Failed to load config file: ${absolutePath}`, result.error);
      return;
    }

    if (result.parsed) {
      for (const [key, value] of Object.entries(result.parsed)) {
        const type = this.inferType(value);
        this.configs.set(key, {
          key,
          value,
          type,
          isSecret: this.isSecretKey(key),
          environment: this.environment,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }
  }

  private inferType(value: unknown): 'string' | 'number' | 'boolean' | 'json' | 'array' {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'json';

    if (typeof value === 'string') {
      if (value === 'true' || value === 'false') return 'boolean';
      if (!isNaN(Number(value)) && value.trim() !== '') return 'number';
      if (value.startsWith('[') || value.startsWith('{')) {
        try {
          JSON.parse(value);
          return value.startsWith('[') ? 'array' : 'json';
        } catch {
          return 'string';
        }
      }
    }

    return 'string';
  }

  private parseValue(value: unknown, type: string): unknown {
    if (typeof value !== 'string') return value;

    switch (type) {
      case 'boolean':
        return value === 'true' || value === '1';
      case 'number':
        return Number(value);
      case 'json':
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  private serializeValue(value: unknown, type: string): unknown {
    switch (type) {
      case 'json':
      case 'array':
        return typeof value === 'string' ? value : JSON.stringify(value);
      default:
        return value;
    }
  }

  private validateValue(value: unknown, type: string): void {
    switch (type) {
      case 'number':
        if (typeof value === 'string' && isNaN(Number(value))) {
          throw new ConfigValidationError('value', 'Invalid number format');
        }
        break;
      case 'boolean':
        if (typeof value === 'string' && !['true', 'false', '1', '0'].includes(value)) {
          throw new ConfigValidationError('value', 'Invalid boolean format');
        }
        break;
      case 'json':
      case 'array':
        if (typeof value === 'string') {
          try {
            JSON.parse(value);
          } catch {
            throw new ConfigValidationError('value', 'Invalid JSON format');
          }
        }
        break;
    }
  }

  private isSecretKey(key: string): boolean {
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

    return secretPatterns.some((pattern) => pattern.test(key));
  }

  getConfigCount(): number {
    return this.configs.size;
  }

  clearConfigs(): void {
    this.configs.clear();
    this.cache.clear();
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export default ConfigService;
