export interface ConfigValue {
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  isSecret: boolean;
  environment?: string;
  validFrom?: Date;
  validUntil?: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface FeatureFlag {
  name: string;
  description?: string;
  enabled: boolean;
  rolloutPercentage: number;
  targetUsers: string[];
  targetGroups: string[];
  conditions: FeatureFlagCondition[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeatureFlagCondition {
  field: string;
  operator:
    | 'eq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'nin'
    | 'contains'
    | 'startsWith'
    | 'endsWith';
  value: unknown;
}

export interface Secret {
  name: string;
  value: string;
  description?: string;
  environment?: string;
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface RotationPolicy {
  enabled: boolean;
  intervalDays?: number;
  lastRotatedAt?: Date;
  nextRotationAt?: Date;
}

export interface EnvironmentConfig {
  name: string;
  description?: string;
  variables: Record<string, ConfigValue>;
  inheritsFrom?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConfigService {
  get<T = unknown>(key: string, defaultValue?: T): Promise<T>;
  set(key: string, value: unknown, options?: ConfigSetOptions): Promise<ConfigValue>;
  delete(key: string): Promise<void>;
  list(filter?: ConfigFilter): Promise<ConfigValue[]>;
  getAll(): Promise<Record<string, unknown>>;
  reload(): Promise<void>;
}

export interface IFeatureFlagService {
  isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean>;
  getFlag(flagName: string): Promise<FeatureFlag | null>;
  setFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag>;
  deleteFlag(flagName: string): Promise<void>;
  listFlags(filter?: FeatureFlagFilter): Promise<FeatureFlag[]>;
  evaluate(flagName: string, context?: FeatureFlagContext): Promise<FeatureFlagEvaluation>;
}

export interface ISecretService {
  get(name: string): Promise<string | null>;
  set(name: string, value: string, options?: SecretSetOptions): Promise<Secret>;
  delete(name: string): Promise<void>;
  list(): Promise<Omit<Secret, 'value'>[]>;
  rotate(name: string, newValue: string): Promise<Secret>;
  getMetadata(name: string): Promise<Omit<Secret, 'value'> | null>;
}

export interface ConfigSetOptions {
  type?: 'string' | 'number' | 'boolean' | 'json' | 'array';
  description?: string;
  isSecret?: boolean;
  environment?: string;
  validFrom?: Date;
  validUntil?: Date;
  metadata?: Record<string, unknown>;
}

export interface ConfigFilter {
  environment?: string;
  isSecret?: boolean;
  prefix?: string;
}

export interface FeatureFlagContext {
  userId?: string;
  userGroups?: string[];
  attributes?: Record<string, unknown>;
}

export interface FeatureFlagFilter {
  enabled?: boolean;
  prefix?: string;
}

export interface FeatureFlagEvaluation {
  enabled: boolean;
  reason:
    | 'default'
    | 'user_targeted'
    | 'group_targeted'
    | 'condition_matched'
    | 'rollout'
    | 'disabled';
  flagName: string;
  timestamp: Date;
}

export interface SecretSetOptions {
  description?: string;
  environment?: string;
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
  metadata?: Record<string, unknown>;
}

export interface ConfigServiceOptions {
  environment?: string;
  envFilePath?: string;
  secretsProvider?: 'env' | 'vault' | 'aws' | 'mock';
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  validateOnLoad?: boolean;
}
