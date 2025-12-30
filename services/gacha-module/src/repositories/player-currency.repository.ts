import { Repository } from 'typeorm';
import { PlayerCurrency } from '../models';
import { getDataSource } from '../config/database';
import { CurrencyType } from '../types';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export class PlayerCurrencyRepository {
  private repository: Repository<PlayerCurrency>;

  constructor() {
    this.repository = getDataSource().getRepository(PlayerCurrency);
  }

  async getBalance(playerId: string, currencyType: CurrencyType): Promise<PlayerCurrency> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerCurrency(playerId, currencyType);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as PlayerCurrency;
      }
    } catch {
      // Cache miss or error, continue to database
    }

    let currency = await this.repository.findOne({
      where: { playerId, currencyType },
    });

    if (!currency) {
      currency = this.repository.create({
        playerId,
        currencyType,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        pendingBalance: 0,
      });
      currency = await this.repository.save(currency);
    }

    await redis.setex(cacheKey, REDIS_TTL.currency, JSON.stringify(currency));
    return currency;
  }

  async getAllBalances(playerId: string): Promise<PlayerCurrency[]> {
    const currencies = await this.repository.find({
      where: { playerId },
    });

    const allTypes = Object.values(CurrencyType);
    const existingTypes = currencies.map((c) => c.currencyType);
    const missingTypes = allTypes.filter((t) => !existingTypes.includes(t));

    for (const type of missingTypes) {
      const newCurrency = this.repository.create({
        playerId,
        currencyType: type,
        balance: 0,
        lifetimeEarned: 0,
        lifetimeSpent: 0,
        pendingBalance: 0,
      });
      currencies.push(await this.repository.save(newCurrency));
    }

    return currencies;
  }

  async addBalance(
    playerId: string,
    currencyType: CurrencyType,
    amount: number
  ): Promise<PlayerCurrency> {
    const currency = await this.getBalance(playerId, currencyType);
    
    currency.balance = Number(currency.balance) + amount;
    currency.lifetimeEarned = Number(currency.lifetimeEarned) + amount;

    const saved = await this.repository.save(currency);
    await this.updateCache(playerId, currencyType, saved);
    return saved;
  }

  async deductBalance(
    playerId: string,
    currencyType: CurrencyType,
    amount: number
  ): Promise<{ success: boolean; currency: PlayerCurrency; error?: string }> {
    const currency = await this.getBalance(playerId, currencyType);
    
    if (Number(currency.balance) < amount) {
      return {
        success: false,
        currency,
        error: `Insufficient ${currencyType} balance. Required: ${amount}, Available: ${currency.balance}`,
      };
    }

    currency.balance = Number(currency.balance) - amount;
    currency.lifetimeSpent = Number(currency.lifetimeSpent) + amount;

    const saved = await this.repository.save(currency);
    await this.updateCache(playerId, currencyType, saved);
    return { success: true, currency: saved };
  }

  async setBalance(
    playerId: string,
    currencyType: CurrencyType,
    amount: number
  ): Promise<PlayerCurrency> {
    const currency = await this.getBalance(playerId, currencyType);
    currency.balance = amount;

    const saved = await this.repository.save(currency);
    await this.updateCache(playerId, currencyType, saved);
    return saved;
  }

  async transferBalance(
    fromPlayerId: string,
    toPlayerId: string,
    currencyType: CurrencyType,
    amount: number
  ): Promise<{ success: boolean; error?: string }> {
    const deductResult = await this.deductBalance(fromPlayerId, currencyType, amount);
    if (!deductResult.success) {
      return { success: false, error: deductResult.error };
    }

    await this.addBalance(toPlayerId, currencyType, amount);
    return { success: true };
  }

  async hasEnoughBalance(
    playerId: string,
    currencyType: CurrencyType,
    amount: number
  ): Promise<boolean> {
    const currency = await this.getBalance(playerId, currencyType);
    return Number(currency.balance) >= amount;
  }

  private async updateCache(
    playerId: string,
    currencyType: CurrencyType,
    currency: PlayerCurrency
  ): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerCurrency(playerId, currencyType);
    await redis.setex(cacheKey, REDIS_TTL.currency, JSON.stringify(currency));
  }

  async invalidateCache(playerId: string, currencyType: CurrencyType): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerCurrency(playerId, currencyType);
    await redis.del(cacheKey);
  }
}
