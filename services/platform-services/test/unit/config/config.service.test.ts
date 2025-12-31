import { ConfigService } from '../../../src/config/services/config.service';
import { FeatureFlagService } from '../../../src/config/services/feature-flag.service';
import { SecretService } from '../../../src/config/services/secret.service';
import { PlatformLogger, LogLevel } from '../../../src/common/logging';
import {
  ConfigNotFoundError,
  ConfigValidationError,
  ConfigFeatureFlagError,
} from '../../../src/common/errors';

describe('ConfigService', () => {
  let configService: ConfigService;
  let logger: PlatformLogger;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-config-service',
      level: LogLevel.ERROR,
    });

    configService = new ConfigService(logger, {
      environment: 'test',
      cacheEnabled: true,
      cacheTtlMs: 1000,
      validateOnLoad: true,
    });
  });

  afterEach(() => {
    configService.clearConfigs();
  });

  describe('initialize', () => {
    it('should initialize and load from environment', async () => {
      await configService.initialize();
      expect(configService.getConfigCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('get', () => {
    it('should get a config value', async () => {
      await configService.set('TEST_KEY', 'test-value');
      const value = await configService.get<string>('TEST_KEY');
      expect(value).toBe('test-value');
    });

    it('should return default value when config not found', async () => {
      const value = await configService.get<string>('NON_EXISTENT', 'default');
      expect(value).toBe('default');
    });

    it('should throw when config not found and no default', async () => {
      await expect(
        configService.get('NON_EXISTENT')
      ).rejects.toThrow(ConfigNotFoundError);
    });

    it('should parse number values', async () => {
      await configService.set('PORT', '3000', { type: 'number' });
      const value = await configService.get<number>('PORT');
      expect(value).toBe(3000);
    });

    it('should parse boolean values', async () => {
      await configService.set('DEBUG', 'true', { type: 'boolean' });
      const value = await configService.get<boolean>('DEBUG');
      expect(value).toBe(true);
    });

    it('should parse JSON values', async () => {
      await configService.set('SETTINGS', { nested: 'value' }, { type: 'json' });
      const value = await configService.get<{ nested: string }>('SETTINGS');
      expect(value.nested).toBe('value');
    });

    it('should use cache for repeated gets', async () => {
      await configService.set('CACHED_KEY', 'cached-value');
      
      const value1 = await configService.get<string>('CACHED_KEY');
      const value2 = await configService.get<string>('CACHED_KEY');
      
      expect(value1).toBe(value2);
    });

    it('should respect validFrom date', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      await configService.set('FUTURE_KEY', 'future-value', {
        validFrom: futureDate,
      });

      const value = await configService.get<string>('FUTURE_KEY', 'default');
      expect(value).toBe('default');
    });

    it('should respect validUntil date', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      await configService.set('EXPIRED_KEY', 'expired-value', {
        validUntil: pastDate,
      });

      const value = await configService.get<string>('EXPIRED_KEY', 'default');
      expect(value).toBe('default');
    });
  });

  describe('set', () => {
    it('should set a config value', async () => {
      const result = await configService.set('NEW_KEY', 'new-value');
      expect(result.key).toBe('NEW_KEY');
      expect(result.version).toBe(1);
    });

    it('should increment version on update', async () => {
      await configService.set('VERSION_KEY', 'v1');
      const result = await configService.set('VERSION_KEY', 'v2');
      expect(result.version).toBe(2);
    });

    it('should set config with options', async () => {
      const result = await configService.set('OPTION_KEY', 'value', {
        type: 'string',
        description: 'Test config',
        isSecret: false,
        environment: 'test',
        metadata: { owner: 'test' },
      });

      expect(result.description).toBe('Test config');
      expect(result.isSecret).toBe(false);
    });

    it('should auto-detect type', async () => {
      const stringResult = await configService.set('STRING_KEY', 'value');
      expect(stringResult.type).toBe('string');

      const numberResult = await configService.set('NUMBER_KEY', 123);
      expect(numberResult.type).toBe('number');

      const boolResult = await configService.set('BOOL_KEY', true);
      expect(boolResult.type).toBe('boolean');
    });

    it('should invalidate cache on set', async () => {
      await configService.set('CACHE_KEY', 'original');
      await configService.get<string>('CACHE_KEY');
      
      await configService.set('CACHE_KEY', 'updated');
      const value = await configService.get<string>('CACHE_KEY');
      
      expect(value).toBe('updated');
    });
  });

  describe('delete', () => {
    it('should delete a config value', async () => {
      await configService.set('DELETE_KEY', 'value');
      await configService.delete('DELETE_KEY');

      await expect(
        configService.get('DELETE_KEY')
      ).rejects.toThrow(ConfigNotFoundError);
    });

    it('should throw when deleting non-existent config', async () => {
      await expect(
        configService.delete('NON_EXISTENT')
      ).rejects.toThrow(ConfigNotFoundError);
    });
  });

  describe('list', () => {
    it('should list all configs', async () => {
      await configService.set('KEY1', 'value1');
      await configService.set('KEY2', 'value2');

      const configs = await configService.list();
      expect(configs.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by environment', async () => {
      await configService.set('ENV_KEY', 'value', { environment: 'test' });

      const configs = await configService.list({ environment: 'test' });
      expect(configs.some(c => c.key === 'ENV_KEY')).toBe(true);
    });

    it('should filter by isSecret', async () => {
      await configService.set('SECRET_KEY', 'secret', { isSecret: true });
      await configService.set('PUBLIC_KEY', 'public', { isSecret: false });

      const secrets = await configService.list({ isSecret: true });
      const publics = await configService.list({ isSecret: false });

      expect(secrets.some(c => c.key === 'SECRET_KEY')).toBe(true);
      expect(publics.some(c => c.key === 'PUBLIC_KEY')).toBe(true);
    });

    it('should filter by prefix', async () => {
      await configService.set('APP_NAME', 'test');
      await configService.set('APP_VERSION', '1.0');
      await configService.set('DB_HOST', 'localhost');

      const appConfigs = await configService.list({ prefix: 'APP_' });
      expect(appConfigs.every(c => c.key.startsWith('APP_'))).toBe(true);
    });

    it('should mask secret values in list', async () => {
      await configService.set('SECRET_VALUE', 'super-secret', { isSecret: true });

      const configs = await configService.list({ isSecret: true });
      const secretConfig = configs.find(c => c.key === 'SECRET_VALUE');
      
      expect(secretConfig?.value).toBe('********');
    });
  });

  describe('getAll', () => {
    it('should get all non-secret configs', async () => {
      await configService.set('PUBLIC1', 'value1');
      await configService.set('PUBLIC2', 'value2');
      await configService.set('SECRET', 'secret', { isSecret: true });

      const all = await configService.getAll();
      
      expect(all['PUBLIC1']).toBe('value1');
      expect(all['PUBLIC2']).toBe('value2');
      expect(all['SECRET']).toBeUndefined();
    });
  });

  describe('reload', () => {
    it('should reload configs and clear cache', async () => {
      await configService.set('RELOAD_KEY', 'value');
      await configService.reload();
      
      expect(configService.getConfigCount()).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('FeatureFlagService', () => {
  let featureFlagService: FeatureFlagService;
  let logger: PlatformLogger;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-feature-flag-service',
      level: LogLevel.ERROR,
    });

    featureFlagService = new FeatureFlagService(logger, 1000);
  });

  afterEach(() => {
    featureFlagService.clearFlags();
  });

  describe('setFlag', () => {
    it('should create a feature flag', async () => {
      const flag = await featureFlagService.setFlag({
        name: 'new-feature',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      expect(flag.name).toBe('new-feature');
      expect(flag.enabled).toBe(true);
    });

    it('should update an existing flag', async () => {
      await featureFlagService.setFlag({
        name: 'update-feature',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const updated = await featureFlagService.setFlag({
        name: 'update-feature',
        enabled: true,
        rolloutPercentage: 50,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      expect(updated.enabled).toBe(true);
      expect(updated.rolloutPercentage).toBe(50);
    });
  });

  describe('getFlag', () => {
    it('should get a flag by name', async () => {
      await featureFlagService.setFlag({
        name: 'get-feature',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const flag = await featureFlagService.getFlag('get-feature');
      expect(flag).toBeDefined();
      expect(flag?.name).toBe('get-feature');
    });

    it('should return null for non-existent flag', async () => {
      const flag = await featureFlagService.getFlag('non-existent');
      expect(flag).toBeNull();
    });
  });

  describe('deleteFlag', () => {
    it('should delete a flag', async () => {
      await featureFlagService.setFlag({
        name: 'delete-feature',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      await featureFlagService.deleteFlag('delete-feature');

      const flag = await featureFlagService.getFlag('delete-feature');
      expect(flag).toBeNull();
    });

    it('should throw for non-existent flag', async () => {
      await expect(
        featureFlagService.deleteFlag('non-existent')
      ).rejects.toThrow(ConfigFeatureFlagError);
    });
  });

  describe('listFlags', () => {
    it('should list all flags', async () => {
      await featureFlagService.setFlag({
        name: 'flag1',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      await featureFlagService.setFlag({
        name: 'flag2',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const flags = await featureFlagService.listFlags();
      expect(flags.length).toBe(2);
    });

    it('should filter by enabled status', async () => {
      await featureFlagService.setFlag({
        name: 'enabled-flag',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      await featureFlagService.setFlag({
        name: 'disabled-flag',
        enabled: false,
        rolloutPercentage: 0,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const enabledFlags = await featureFlagService.listFlags({ enabled: true });
      expect(enabledFlags.every(f => f.enabled)).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return true for enabled flag', async () => {
      await featureFlagService.setFlag({
        name: 'enabled-feature',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const enabled = await featureFlagService.isEnabled('enabled-feature');
      expect(enabled).toBe(true);
    });

    it('should return false for disabled flag', async () => {
      await featureFlagService.setFlag({
        name: 'disabled-feature',
        enabled: false,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const enabled = await featureFlagService.isEnabled('disabled-feature');
      expect(enabled).toBe(false);
    });

    it('should return false for non-existent flag', async () => {
      const enabled = await featureFlagService.isEnabled('non-existent');
      expect(enabled).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('should return disabled for disabled flag', async () => {
      await featureFlagService.setFlag({
        name: 'disabled-flag',
        enabled: false,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const result = await featureFlagService.evaluate('disabled-flag');
      expect(result.enabled).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    it('should enable for targeted user', async () => {
      await featureFlagService.setFlag({
        name: 'user-targeted',
        enabled: true,
        rolloutPercentage: 0,
        targetUsers: ['user-123'],
        targetGroups: [],
        conditions: [],
      });

      const result = await featureFlagService.evaluate('user-targeted', {
        userId: 'user-123',
      });

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('user_targeted');
    });

    it('should enable for targeted group', async () => {
      await featureFlagService.setFlag({
        name: 'group-targeted',
        enabled: true,
        rolloutPercentage: 0,
        targetUsers: [],
        targetGroups: ['beta-testers'],
        conditions: [],
      });

      const result = await featureFlagService.evaluate('group-targeted', {
        userGroups: ['beta-testers'],
      });

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('group_targeted');
    });

    it('should evaluate conditions', async () => {
      await featureFlagService.setFlag({
        name: 'condition-flag',
        enabled: true,
        rolloutPercentage: 0,
        targetUsers: [],
        targetGroups: [],
        conditions: [
          { field: 'country', operator: 'eq', value: 'US' },
        ],
      });

      const result = await featureFlagService.evaluate('condition-flag', {
        attributes: { country: 'US' },
      });

      expect(result.enabled).toBe(true);
      expect(result.reason).toBe('condition_matched');
    });

    it('should use rollout percentage', async () => {
      await featureFlagService.setFlag({
        name: 'rollout-flag',
        enabled: true,
        rolloutPercentage: 100,
        targetUsers: [],
        targetGroups: [],
        conditions: [],
      });

      const result = await featureFlagService.evaluate('rollout-flag', {
        userId: 'test-user',
      });

      expect(result.enabled).toBe(true);
    });
  });
});

describe('SecretService', () => {
  let secretService: SecretService;
  let logger: PlatformLogger;

  beforeEach(() => {
    logger = new PlatformLogger({
      serviceName: 'test-secret-service',
      level: LogLevel.ERROR,
    });

    secretService = new SecretService(logger, undefined, 'test');
  });

  afterEach(() => {
    secretService.clearSecrets();
  });

  describe('set', () => {
    it('should set a secret', async () => {
      const result = await secretService.set('DB_PASSWORD', 'super-secret');
      expect(result.name).toBe('DB_PASSWORD');
      expect(result.value).toBe('********');
      expect(result.version).toBe(1);
    });

    it('should set secret with options', async () => {
      const result = await secretService.set('API_KEY', 'secret-key', {
        description: 'External API key',
        environment: 'production',
        expiresAt: new Date(Date.now() + 86400000),
        metadata: { service: 'external' },
      });

      expect(result.description).toBe('External API key');
      expect(result.environment).toBe('production');
    });

    it('should increment version on update', async () => {
      await secretService.set('VERSION_SECRET', 'v1');
      const result = await secretService.set('VERSION_SECRET', 'v2');
      expect(result.version).toBe(2);
    });
  });

  describe('get', () => {
    it('should get a secret value', async () => {
      await secretService.set('GET_SECRET', 'secret-value');
      const value = await secretService.get('GET_SECRET');
      expect(value).toBe('secret-value');
    });

    it('should return null for non-existent secret', async () => {
      const value = await secretService.get('NON_EXISTENT');
      expect(value).toBeNull();
    });

    it('should return null for expired secret', async () => {
      await secretService.set('EXPIRED_SECRET', 'value', {
        expiresAt: new Date(Date.now() - 1000),
      });

      const value = await secretService.get('EXPIRED_SECRET');
      expect(value).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete a secret', async () => {
      await secretService.set('DELETE_SECRET', 'value');
      await secretService.delete('DELETE_SECRET');

      const value = await secretService.get('DELETE_SECRET');
      expect(value).toBeNull();
    });

    it('should throw for non-existent secret', async () => {
      await expect(
        secretService.delete('NON_EXISTENT')
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list all secrets without values', async () => {
      await secretService.set('SECRET1', 'value1');
      await secretService.set('SECRET2', 'value2');

      const secrets = await secretService.list();
      expect(secrets.length).toBe(2);
      expect(secrets.every(s => !('value' in s && s.value !== undefined))).toBe(true);
    });
  });

  describe('rotate', () => {
    it('should rotate a secret', async () => {
      await secretService.set('ROTATE_SECRET', 'old-value', {
        rotationPolicy: {
          enabled: true,
          intervalDays: 30,
        },
      });

      const result = await secretService.rotate('ROTATE_SECRET', 'new-value');
      expect(result.version).toBe(2);

      const value = await secretService.get('ROTATE_SECRET');
      expect(value).toBe('new-value');
    });

    it('should throw for non-existent secret', async () => {
      await expect(
        secretService.rotate('NON_EXISTENT', 'new-value')
      ).rejects.toThrow();
    });
  });

  describe('getMetadata', () => {
    it('should get secret metadata without value', async () => {
      await secretService.set('META_SECRET', 'value', {
        description: 'Test secret',
      });

      const metadata = await secretService.getMetadata('META_SECRET');
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('META_SECRET');
      expect(metadata?.description).toBe('Test secret');
    });

    it('should return null for non-existent secret', async () => {
      const metadata = await secretService.getMetadata('NON_EXISTENT');
      expect(metadata).toBeNull();
    });
  });

  describe('checkRotationDue', () => {
    it('should return secrets due for rotation', async () => {
      await secretService.set('DUE_SECRET', 'value', {
        rotationPolicy: {
          enabled: true,
          intervalDays: 30,
          nextRotationAt: new Date(Date.now() - 1000),
        },
      });

      const dueSecrets = await secretService.checkRotationDue();
      expect(dueSecrets).toContain('DUE_SECRET');
    });
  });

  describe('checkExpired', () => {
    it('should return expired secrets', async () => {
      await secretService.set('EXPIRED', 'value', {
        expiresAt: new Date(Date.now() - 1000),
      });

      const expiredSecrets = await secretService.checkExpired();
      expect(expiredSecrets).toContain('EXPIRED');
    });
  });
});
