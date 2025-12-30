import { Repository } from 'typeorm';
import { PlayerPity } from '../models';
import { getDataSource } from '../config/database';
import { BannerType } from '../types';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export class PlayerPityRepository {
  private repository: Repository<PlayerPity>;

  constructor() {
    this.repository = getDataSource().getRepository(PlayerPity);
  }

  async getPityState(playerId: string, bannerType: BannerType, bannerId?: string): Promise<PlayerPity> {
    const redis = getRedisClient();
    const cacheKey = bannerId
      ? REDIS_KEYS.playerPityBanner(playerId, bannerId)
      : REDIS_KEYS.playerPity(playerId, bannerType);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.lastPullTimestamp = parsed.lastPullTimestamp ? new Date(parsed.lastPullTimestamp) : null;
        return parsed as PlayerPity;
      }
    } catch {
      // Cache miss or error, continue to database
    }

    let pity = await this.repository.findOne({
      where: bannerId
        ? { playerId, bannerId }
        : { playerId, bannerType, bannerId: undefined },
    });

    if (!pity) {
      pity = this.repository.create({
        playerId,
        bannerType,
        bannerId: bannerId || null,
        pityCounter: 0,
        guaranteedFeatured: false,
        weaponPityCounter: 0,
        totalPulls: 0,
        legendaryCount: 0,
        featuredCount: 0,
        lastPullTimestamp: null,
      });
      pity = await this.repository.save(pity);
    }

    await redis.setex(cacheKey, REDIS_TTL.pity, JSON.stringify(pity));
    return pity;
  }

  async incrementPity(
    playerId: string,
    bannerType: BannerType,
    count: number = 1,
    bannerId?: string
  ): Promise<PlayerPity> {
    let pity = await this.getPityState(playerId, bannerType, bannerId);

    pity.pityCounter += count;
    pity.totalPulls += count;
    pity.lastPullTimestamp = new Date();

    pity = await this.repository.save(pity);
    await this.updateCache(playerId, bannerType, pity, bannerId);
    return pity;
  }

  async resetPity(
    playerId: string,
    bannerType: BannerType,
    lostFiftyFifty: boolean,
    isFeatured: boolean,
    bannerId?: string
  ): Promise<PlayerPity> {
    let pity = await this.getPityState(playerId, bannerType, bannerId);

    pity.pityCounter = 0;
    pity.legendaryCount += 1;
    if (isFeatured) {
      pity.featuredCount += 1;
      pity.guaranteedFeatured = false;
    } else if (lostFiftyFifty) {
      pity.guaranteedFeatured = true;
    }
    pity.lastPullTimestamp = new Date();

    pity = await this.repository.save(pity);
    await this.updateCache(playerId, bannerType, pity, bannerId);
    return pity;
  }

  async setGuaranteedFeatured(
    playerId: string,
    bannerType: BannerType,
    guaranteed: boolean,
    bannerId?: string
  ): Promise<PlayerPity> {
    let pity = await this.getPityState(playerId, bannerType, bannerId);
    pity.guaranteedFeatured = guaranteed;
    pity = await this.repository.save(pity);
    await this.updateCache(playerId, bannerType, pity, bannerId);
    return pity;
  }

  async findByPlayer(playerId: string): Promise<PlayerPity[]> {
    return this.repository.find({
      where: { playerId },
      order: { bannerType: 'ASC' },
    });
  }

  async findByPlayerAndBanner(playerId: string, bannerId: string): Promise<PlayerPity | null> {
    return this.repository.findOne({
      where: { playerId, bannerId },
    });
  }

  async getStatistics(playerId: string): Promise<{
    totalPulls: number;
    legendaryCount: number;
    featuredCount: number;
    averagePityToLegendary: number;
  }> {
    const pities = await this.findByPlayer(playerId);
    
    const totalPulls = pities.reduce((sum, p) => sum + p.totalPulls, 0);
    const legendaryCount = pities.reduce((sum, p) => sum + p.legendaryCount, 0);
    const featuredCount = pities.reduce((sum, p) => sum + p.featuredCount, 0);
    const averagePityToLegendary = legendaryCount > 0 ? totalPulls / legendaryCount : 0;

    return {
      totalPulls,
      legendaryCount,
      featuredCount,
      averagePityToLegendary,
    };
  }

  private async updateCache(
    playerId: string,
    bannerType: BannerType,
    pity: PlayerPity,
    bannerId?: string
  ): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = bannerId
      ? REDIS_KEYS.playerPityBanner(playerId, bannerId)
      : REDIS_KEYS.playerPity(playerId, bannerType);
    await redis.setex(cacheKey, REDIS_TTL.pity, JSON.stringify(pity));
  }

  async invalidateCache(playerId: string, bannerType: BannerType, bannerId?: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = bannerId
      ? REDIS_KEYS.playerPityBanner(playerId, bannerId)
      : REDIS_KEYS.playerPity(playerId, bannerType);
    await redis.del(cacheKey);
  }
}
