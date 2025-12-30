import { Repository } from 'typeorm';
import { PlayerSpending } from '../models';
import { getDataSource } from '../config/database';
import { config } from '../config';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export class PlayerSpendingRepository {
  private repository: Repository<PlayerSpending>;

  constructor() {
    this.repository = getDataSource().getRepository(PlayerSpending);
  }

  async getSpending(playerId: string): Promise<PlayerSpending> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerSpending(playerId);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          lastDailyReset: new Date(parsed.lastDailyReset),
          lastWeeklyReset: new Date(parsed.lastWeeklyReset),
          lastMonthlyReset: new Date(parsed.lastMonthlyReset),
          limitReachedAt: parsed.limitReachedAt ? new Date(parsed.limitReachedAt) : null,
          createdAt: new Date(parsed.createdAt),
          updatedAt: new Date(parsed.updatedAt),
        } as PlayerSpending;
      }
    } catch {
      // Cache miss or error, continue to database
    }

    let spending = await this.repository.findOne({ where: { playerId } });

    if (!spending) {
      const now = new Date();
      spending = this.repository.create({
        playerId,
        dailySpent: 0,
        weeklySpent: 0,
        monthlySpent: 0,
        totalLifetimeSpent: 0,
        dailyPullCount: 0,
        weeklyPullCount: 0,
        monthlyPullCount: 0,
        totalLifetimePulls: 0,
        lastDailyReset: now,
        lastWeeklyReset: now,
        lastMonthlyReset: now,
        dailyLimit: config.regulatory.spendingLimits.daily,
        weeklyLimit: config.regulatory.spendingLimits.weekly,
        monthlyLimit: config.regulatory.spendingLimits.monthly,
        hasCustomLimits: false,
        isLimitReached: false,
        limitReachedAt: null,
      });
      spending = await this.repository.save(spending);
    }

    spending = await this.resetPeriodsIfNeeded(spending);
    await redis.setex(cacheKey, REDIS_TTL.spending, JSON.stringify(spending));
    return spending;
  }

  private async resetPeriodsIfNeeded(spending: PlayerSpending): Promise<PlayerSpending> {
    const now = new Date();
    let needsSave = false;

    const lastDailyReset = new Date(spending.lastDailyReset);
    const daysSinceDaily = Math.floor((now.getTime() - lastDailyReset.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceDaily >= 1) {
      spending.dailySpent = 0;
      spending.dailyPullCount = 0;
      spending.lastDailyReset = now;
      needsSave = true;
    }

    const lastWeeklyReset = new Date(spending.lastWeeklyReset);
    const daysSinceWeekly = Math.floor((now.getTime() - lastWeeklyReset.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceWeekly >= 7) {
      spending.weeklySpent = 0;
      spending.weeklyPullCount = 0;
      spending.lastWeeklyReset = now;
      needsSave = true;
    }

    const lastMonthlyReset = new Date(spending.lastMonthlyReset);
    const daysSinceMonthly = Math.floor((now.getTime() - lastMonthlyReset.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceMonthly >= 30) {
      spending.monthlySpent = 0;
      spending.monthlyPullCount = 0;
      spending.lastMonthlyReset = now;
      needsSave = true;
    }

    if (needsSave) {
      spending.isLimitReached = false;
      spending.limitReachedAt = null;
      spending = await this.repository.save(spending);
    }

    return spending;
  }

  async recordSpending(
    playerId: string,
    amount: number,
    pullCount: number = 1
  ): Promise<{ spending: PlayerSpending; limitReached: boolean; limitType?: string }> {
    let spending = await this.getSpending(playerId);

    spending.dailySpent = Number(spending.dailySpent) + amount;
    spending.weeklySpent = Number(spending.weeklySpent) + amount;
    spending.monthlySpent = Number(spending.monthlySpent) + amount;
    spending.totalLifetimeSpent = Number(spending.totalLifetimeSpent) + amount;
    spending.dailyPullCount += pullCount;
    spending.weeklyPullCount += pullCount;
    spending.monthlyPullCount += pullCount;
    spending.totalLifetimePulls += pullCount;

    let limitReached = false;
    let limitType: string | undefined;

    if (Number(spending.dailySpent) >= Number(spending.dailyLimit)) {
      limitReached = true;
      limitType = 'daily';
    } else if (Number(spending.weeklySpent) >= Number(spending.weeklyLimit)) {
      limitReached = true;
      limitType = 'weekly';
    } else if (Number(spending.monthlySpent) >= Number(spending.monthlyLimit)) {
      limitReached = true;
      limitType = 'monthly';
    }

    if (limitReached && !spending.isLimitReached) {
      spending.isLimitReached = true;
      spending.limitReachedAt = new Date();
    }

    spending = await this.repository.save(spending);
    await this.updateCache(playerId, spending);

    return { spending, limitReached, limitType };
  }

  async checkSpendingLimit(
    playerId: string,
    amount: number
  ): Promise<{ canSpend: boolean; limitType?: string; remaining: number }> {
    const spending = await this.getSpending(playerId);

    const dailyRemaining = Number(spending.dailyLimit) - Number(spending.dailySpent);
    const weeklyRemaining = Number(spending.weeklyLimit) - Number(spending.weeklySpent);
    const monthlyRemaining = Number(spending.monthlyLimit) - Number(spending.monthlySpent);

    if (dailyRemaining < amount) {
      return { canSpend: false, limitType: 'daily', remaining: dailyRemaining };
    }
    if (weeklyRemaining < amount) {
      return { canSpend: false, limitType: 'weekly', remaining: weeklyRemaining };
    }
    if (monthlyRemaining < amount) {
      return { canSpend: false, limitType: 'monthly', remaining: monthlyRemaining };
    }

    return { canSpend: true, remaining: Math.min(dailyRemaining, weeklyRemaining, monthlyRemaining) };
  }

  async setCustomLimits(
    playerId: string,
    dailyLimit?: number,
    weeklyLimit?: number,
    monthlyLimit?: number
  ): Promise<PlayerSpending> {
    let spending = await this.getSpending(playerId);

    if (dailyLimit !== undefined) spending.dailyLimit = dailyLimit;
    if (weeklyLimit !== undefined) spending.weeklyLimit = weeklyLimit;
    if (monthlyLimit !== undefined) spending.monthlyLimit = monthlyLimit;
    spending.hasCustomLimits = true;

    spending = await this.repository.save(spending);
    await this.updateCache(playerId, spending);
    return spending;
  }

  async resetLimits(playerId: string): Promise<PlayerSpending> {
    let spending = await this.getSpending(playerId);

    spending.dailyLimit = config.regulatory.spendingLimits.daily;
    spending.weeklyLimit = config.regulatory.spendingLimits.weekly;
    spending.monthlyLimit = config.regulatory.spendingLimits.monthly;
    spending.hasCustomLimits = false;

    spending = await this.repository.save(spending);
    await this.updateCache(playerId, spending);
    return spending;
  }

  async getSpendingStatus(playerId: string): Promise<{
    dailySpent: number;
    dailyLimit: number;
    dailyRemaining: number;
    weeklySpent: number;
    weeklyLimit: number;
    weeklyRemaining: number;
    monthlySpent: number;
    monthlyLimit: number;
    monthlyRemaining: number;
    isLimitReached: boolean;
    nextResetTime: Date;
  }> {
    const spending = await this.getSpending(playerId);

    const nextDailyReset = new Date(spending.lastDailyReset);
    nextDailyReset.setDate(nextDailyReset.getDate() + 1);

    return {
      dailySpent: Number(spending.dailySpent),
      dailyLimit: Number(spending.dailyLimit),
      dailyRemaining: Math.max(0, Number(spending.dailyLimit) - Number(spending.dailySpent)),
      weeklySpent: Number(spending.weeklySpent),
      weeklyLimit: Number(spending.weeklyLimit),
      weeklyRemaining: Math.max(0, Number(spending.weeklyLimit) - Number(spending.weeklySpent)),
      monthlySpent: Number(spending.monthlySpent),
      monthlyLimit: Number(spending.monthlyLimit),
      monthlyRemaining: Math.max(0, Number(spending.monthlyLimit) - Number(spending.monthlySpent)),
      isLimitReached: spending.isLimitReached,
      nextResetTime: nextDailyReset,
    };
  }

  private async updateCache(playerId: string, spending: PlayerSpending): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerSpending(playerId);
    await redis.setex(cacheKey, REDIS_TTL.spending, JSON.stringify(spending));
  }

  async invalidateCache(playerId: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerSpending(playerId);
    await redis.del(cacheKey);
  }
}
