import {
  IFeatureFlagService,
  FeatureFlag,
  FeatureFlagContext,
  FeatureFlagFilter,
  FeatureFlagEvaluation,
  FeatureFlagCondition,
} from '../interfaces';
import { ConfigFeatureFlagError } from '../../common/errors';
import { PlatformLogger, EventTypes } from '../../common/logging';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export class FeatureFlagService implements IFeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private logger: PlatformLogger;
  private evaluationCache: Map<string, { result: boolean; expiresAt: number }> = new Map();
  private cacheTtlMs: number;

  constructor(logger: PlatformLogger, cacheTtlMs: number = 60000) {
    this.logger = logger;
    this.cacheTtlMs = cacheTtlMs;
  }

  async isEnabled(flagName: string, context?: FeatureFlagContext): Promise<boolean> {
    const evaluation = await this.evaluate(flagName, context);
    return evaluation.enabled;
  }

  async getFlag(flagName: string): Promise<FeatureFlag | null> {
    return this.flags.get(flagName) || null;
  }

  async setFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): Promise<FeatureFlag> {
    const timer = this.logger.startTimer('feature_flag_set');

    try {
      const existing = this.flags.get(flag.name);
      const now = new Date();

      const featureFlag: FeatureFlag = {
        ...flag,
        targetUsers: flag.targetUsers || [],
        targetGroups: flag.targetGroups || [],
        conditions: flag.conditions || [],
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      this.flags.set(flag.name, featureFlag);

      this.clearCacheForFlag(flag.name);

      this.logger.event(EventTypes.FEATURE_FLAG_UPDATED, {
        flagName: flag.name,
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
      });

      this.logger.audit({
        eventType: EventTypes.FEATURE_FLAG_UPDATED,
        operation: existing ? 'update' : 'create',
        resource: 'feature_flag',
        resourceId: flag.name,
        oldValue: existing
          ? { enabled: existing.enabled, rolloutPercentage: existing.rolloutPercentage }
          : undefined,
        newValue: { enabled: flag.enabled, rolloutPercentage: flag.rolloutPercentage },
        success: true,
        correlationId: uuidv4(),
      });

      timer(true, { flagName: flag.name });

      return featureFlag;
    } catch (error) {
      timer(false, {
        flagName: flag.name,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw new ConfigFeatureFlagError(
        flag.name,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async deleteFlag(flagName: string): Promise<void> {
    const existing = this.flags.get(flagName);
    if (!existing) {
      throw new ConfigFeatureFlagError(flagName, 'Flag not found');
    }

    this.flags.delete(flagName);
    this.clearCacheForFlag(flagName);

    this.logger.audit({
      eventType: EventTypes.FEATURE_FLAG_UPDATED,
      operation: 'delete',
      resource: 'feature_flag',
      resourceId: flagName,
      oldValue: { enabled: existing.enabled },
      success: true,
      correlationId: uuidv4(),
    });
  }

  async listFlags(filter?: FeatureFlagFilter): Promise<FeatureFlag[]> {
    let flags = Array.from(this.flags.values());

    if (filter?.enabled !== undefined) {
      flags = flags.filter((f) => f.enabled === filter.enabled);
    }

    if (filter?.prefix) {
      flags = flags.filter((f) => f.name.startsWith(filter.prefix!));
    }

    return flags.sort((a, b) => a.name.localeCompare(b.name));
  }

  async evaluate(flagName: string, context?: FeatureFlagContext): Promise<FeatureFlagEvaluation> {
    const timer = this.logger.startTimer('feature_flag_evaluate');

    const cacheKey = this.getCacheKey(flagName, context);
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        enabled: cached.result,
        reason: 'default',
        flagName,
        timestamp: new Date(),
      };
    }

    const flag = this.flags.get(flagName);
    if (!flag) {
      timer(false, { flagName, reason: 'not_found' });
      return {
        enabled: false,
        reason: 'default',
        flagName,
        timestamp: new Date(),
      };
    }

    if (!flag.enabled) {
      this.cacheResult(cacheKey, false);
      timer(true, { flagName, reason: 'disabled' });

      this.logger.event(EventTypes.FEATURE_FLAG_CHECKED, {
        flagName,
        enabled: false,
        reason: 'disabled',
      });

      return {
        enabled: false,
        reason: 'disabled',
        flagName,
        timestamp: new Date(),
      };
    }

    if (context?.userId && flag.targetUsers.includes(context.userId)) {
      this.cacheResult(cacheKey, true);
      timer(true, { flagName, reason: 'user_targeted' });

      this.logger.event(EventTypes.FEATURE_FLAG_CHECKED, {
        flagName,
        enabled: true,
        reason: 'user_targeted',
        userId: context.userId,
      });

      return {
        enabled: true,
        reason: 'user_targeted',
        flagName,
        timestamp: new Date(),
      };
    }

    if (context?.userGroups?.length) {
      const matchedGroup = context.userGroups.find((g) => flag.targetGroups.includes(g));
      if (matchedGroup) {
        this.cacheResult(cacheKey, true);
        timer(true, { flagName, reason: 'group_targeted' });

        this.logger.event(EventTypes.FEATURE_FLAG_CHECKED, {
          flagName,
          enabled: true,
          reason: 'group_targeted',
          group: matchedGroup,
        });

        return {
          enabled: true,
          reason: 'group_targeted',
          flagName,
          timestamp: new Date(),
        };
      }
    }

    if (flag.conditions.length > 0 && context?.attributes) {
      const conditionsMet = this.evaluateConditions(flag.conditions, context.attributes);
      if (conditionsMet) {
        this.cacheResult(cacheKey, true);
        timer(true, { flagName, reason: 'condition_matched' });

        this.logger.event(EventTypes.FEATURE_FLAG_CHECKED, {
          flagName,
          enabled: true,
          reason: 'condition_matched',
        });

        return {
          enabled: true,
          reason: 'condition_matched',
          flagName,
          timestamp: new Date(),
        };
      }
    }

    if (flag.rolloutPercentage > 0) {
      const identifier = context?.userId || uuidv4();
      const hash = this.hashIdentifier(flagName, identifier);
      const percentage = hash % 100;

      if (percentage < flag.rolloutPercentage) {
        this.cacheResult(cacheKey, true);
        timer(true, { flagName, reason: 'rollout' });

        this.logger.event(EventTypes.FEATURE_FLAG_CHECKED, {
          flagName,
          enabled: true,
          reason: 'rollout',
          percentage: flag.rolloutPercentage,
        });

        return {
          enabled: true,
          reason: 'rollout',
          flagName,
          timestamp: new Date(),
        };
      }
    }

    this.cacheResult(cacheKey, false);
    timer(true, { flagName, reason: 'default' });

    this.logger.event(EventTypes.FEATURE_FLAG_CHECKED, {
      flagName,
      enabled: false,
      reason: 'default',
    });

    return {
      enabled: false,
      reason: 'default',
      flagName,
      timestamp: new Date(),
    };
  }

  private evaluateConditions(
    conditions: FeatureFlagCondition[],
    attributes: Record<string, unknown>
  ): boolean {
    return conditions.every((condition) => {
      const attributeValue = attributes[condition.field];
      return this.evaluateCondition(condition, attributeValue);
    });
  }

  private evaluateCondition(condition: FeatureFlagCondition, attributeValue: unknown): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'eq':
        return attributeValue === value;
      case 'ne':
        return attributeValue !== value;
      case 'gt':
        return (
          typeof attributeValue === 'number' && typeof value === 'number' && attributeValue > value
        );
      case 'gte':
        return (
          typeof attributeValue === 'number' && typeof value === 'number' && attributeValue >= value
        );
      case 'lt':
        return (
          typeof attributeValue === 'number' && typeof value === 'number' && attributeValue < value
        );
      case 'lte':
        return (
          typeof attributeValue === 'number' && typeof value === 'number' && attributeValue <= value
        );
      case 'in':
        return Array.isArray(value) && value.includes(attributeValue);
      case 'nin':
        return Array.isArray(value) && !value.includes(attributeValue);
      case 'contains':
        return (
          typeof attributeValue === 'string' &&
          typeof value === 'string' &&
          attributeValue.includes(value)
        );
      case 'startsWith':
        return (
          typeof attributeValue === 'string' &&
          typeof value === 'string' &&
          attributeValue.startsWith(value)
        );
      case 'endsWith':
        return (
          typeof attributeValue === 'string' &&
          typeof value === 'string' &&
          attributeValue.endsWith(value)
        );
      default:
        return false;
    }
  }

  private hashIdentifier(flagName: string, identifier: string): number {
    const hash = crypto.createHash('md5').update(`${flagName}:${identifier}`).digest('hex');
    return parseInt(hash.substring(0, 8), 16) % 100;
  }

  private getCacheKey(flagName: string, context?: FeatureFlagContext): string {
    const contextStr = context ? JSON.stringify(context) : '';
    return `${flagName}:${contextStr}`;
  }

  private cacheResult(cacheKey: string, result: boolean): void {
    this.evaluationCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
  }

  private clearCacheForFlag(flagName: string): void {
    for (const key of this.evaluationCache.keys()) {
      if (key.startsWith(`${flagName}:`)) {
        this.evaluationCache.delete(key);
      }
    }
  }

  getFlagCount(): number {
    return this.flags.size;
  }

  clearFlags(): void {
    this.flags.clear();
    this.evaluationCache.clear();
  }

  clearCache(): void {
    this.evaluationCache.clear();
  }
}

export default FeatureFlagService;
