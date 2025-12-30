import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { Banner } from '../models';
import { getDataSource } from '../config/database';
import { CreateBannerRequest, BannerType, CurrencyType, Rarity } from '../types';
import { config } from '../config';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export class BannerRepository {
  private repository: Repository<Banner>;

  constructor() {
    this.repository = getDataSource().getRepository(Banner);
  }

  async create(data: CreateBannerRequest): Promise<Banner> {
    const banner = this.repository.create({
      name: data.name,
      description: data.description || '',
      type: data.type,
      baseRates: data.baseRates
        ? {
            [Rarity.COMMON]: data.baseRates[Rarity.COMMON] ?? config.gacha.defaultRates[Rarity.COMMON],
            [Rarity.RARE]: data.baseRates[Rarity.RARE] ?? config.gacha.defaultRates[Rarity.RARE],
            [Rarity.EPIC]: data.baseRates[Rarity.EPIC] ?? config.gacha.defaultRates[Rarity.EPIC],
            [Rarity.LEGENDARY]: data.baseRates[Rarity.LEGENDARY] ?? config.gacha.defaultRates[Rarity.LEGENDARY],
            [Rarity.MYTHIC]: data.baseRates[Rarity.MYTHIC] ?? config.gacha.defaultRates[Rarity.MYTHIC],
          }
        : config.gacha.defaultRates,
      pityConfig: {
        softPityStart: data.pityConfig?.softPityStart ?? config.gacha.defaultSoftPityStart,
        hardPity: data.pityConfig?.hardPity ?? config.gacha.defaultHardPity,
        softPityRateIncrease: data.pityConfig?.softPityRateIncrease ?? config.gacha.defaultSoftPityRateIncrease,
        guaranteedFeaturedAfterLoss: data.pityConfig?.guaranteedFeaturedAfterLoss ?? true,
      },
      featuredItems: data.featuredItems,
      itemPool: data.itemPool,
      featuredRate: data.featuredRate ?? config.gacha.defaultFeaturedRate,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      pullCost: data.pullCost,
      currencyType: data.currencyType ?? CurrencyType.PREMIUM,
      multiPullDiscount: data.multiPullDiscount ?? config.gacha.defaultMultiPullDiscount,
      multiPullCount: data.multiPullCount ?? config.gacha.defaultMultiPullCount,
      guaranteedRarityOnMulti: data.guaranteedRarityOnMulti ?? null,
      maxPullsPerDay: data.maxPullsPerDay ?? null,
      requiresAgeVerification: data.requiresAgeVerification ?? config.regulatory.requireAgeVerification,
      nftRewardsEnabled: data.nftRewardsEnabled ?? false,
      imageUrl: data.imageUrl,
      metadata: data.metadata,
      isActive: true,
    });

    const saved = await this.repository.save(banner);
    await this.invalidateCache();
    return saved;
  }

  async findById(id: string): Promise<Banner | null> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.banner(id);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.startDate = new Date(parsed.startDate);
        parsed.endDate = parsed.endDate ? new Date(parsed.endDate) : null;
        return parsed as Banner;
      }
    } catch {
      // Cache miss or error, continue to database
    }

    const banner = await this.repository.findOne({ where: { id } });
    if (banner) {
      await redis.setex(cacheKey, REDIS_TTL.banner, JSON.stringify(banner));
    }
    return banner;
  }

  async findActive(): Promise<Banner[]> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.activeBanners();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Banner[];
        return parsed.map((b) => ({
          ...b,
          startDate: new Date(b.startDate),
          endDate: b.endDate ? new Date(b.endDate) : null,
        }));
      }
    } catch {
      // Cache miss or error, continue to database
    }

    const now = new Date();
    const banners = await this.repository.find({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: Or(IsNull(), MoreThanOrEqual(now)),
      },
      order: { type: 'ASC', startDate: 'DESC' },
    });

    await redis.setex(cacheKey, REDIS_TTL.activeBanners, JSON.stringify(banners));
    return banners;
  }

  async findByType(type: BannerType): Promise<Banner[]> {
    return this.repository.find({
      where: { type, isActive: true },
      order: { startDate: 'DESC' },
    });
  }

  async findAll(): Promise<Banner[]> {
    return this.repository.find({
      order: { type: 'ASC', startDate: 'DESC' },
    });
  }

  async update(id: string, data: Partial<CreateBannerRequest>): Promise<Banner | null> {
    const banner = await this.repository.findOne({ where: { id } });
    if (!banner) return null;

    if (data.name !== undefined) banner.name = data.name;
    if (data.description !== undefined) banner.description = data.description;
    if (data.type !== undefined) banner.type = data.type;
    if (data.featuredItems !== undefined) banner.featuredItems = data.featuredItems;
    if (data.itemPool !== undefined) banner.itemPool = data.itemPool;
    if (data.featuredRate !== undefined) banner.featuredRate = data.featuredRate;
    if (data.startDate !== undefined) banner.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) banner.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.pullCost !== undefined) banner.pullCost = data.pullCost;
    if (data.currencyType !== undefined) banner.currencyType = data.currencyType;
    if (data.multiPullDiscount !== undefined) banner.multiPullDiscount = data.multiPullDiscount;
    if (data.multiPullCount !== undefined) banner.multiPullCount = data.multiPullCount;
    if (data.guaranteedRarityOnMulti !== undefined) banner.guaranteedRarityOnMulti = data.guaranteedRarityOnMulti ?? null;
    if (data.maxPullsPerDay !== undefined) banner.maxPullsPerDay = data.maxPullsPerDay ?? null;
    if (data.requiresAgeVerification !== undefined) banner.requiresAgeVerification = data.requiresAgeVerification;
    if (data.nftRewardsEnabled !== undefined) banner.nftRewardsEnabled = data.nftRewardsEnabled;
    if (data.imageUrl !== undefined) banner.imageUrl = data.imageUrl;
    if (data.metadata !== undefined) banner.metadata = data.metadata;

    if (data.baseRates) {
      banner.baseRates = {
        [Rarity.COMMON]: data.baseRates[Rarity.COMMON] ?? banner.baseRates[Rarity.COMMON],
        [Rarity.RARE]: data.baseRates[Rarity.RARE] ?? banner.baseRates[Rarity.RARE],
        [Rarity.EPIC]: data.baseRates[Rarity.EPIC] ?? banner.baseRates[Rarity.EPIC],
        [Rarity.LEGENDARY]: data.baseRates[Rarity.LEGENDARY] ?? banner.baseRates[Rarity.LEGENDARY],
        [Rarity.MYTHIC]: data.baseRates[Rarity.MYTHIC] ?? banner.baseRates[Rarity.MYTHIC],
      };
    }

    if (data.pityConfig) {
      banner.pityConfig = {
        softPityStart: data.pityConfig.softPityStart ?? banner.pityConfig.softPityStart,
        hardPity: data.pityConfig.hardPity ?? banner.pityConfig.hardPity,
        softPityRateIncrease: data.pityConfig.softPityRateIncrease ?? banner.pityConfig.softPityRateIncrease,
        guaranteedFeaturedAfterLoss: data.pityConfig.guaranteedFeaturedAfterLoss ?? banner.pityConfig.guaranteedFeaturedAfterLoss,
      };
    }

    const saved = await this.repository.save(banner);
    await this.invalidateCache(id);
    return saved;
  }

  async incrementTotalPulls(id: string, count: number = 1): Promise<void> {
    await this.repository.increment({ id }, 'totalPulls', count);
  }

  async delete(id: string): Promise<boolean> {
    const banner = await this.repository.findOne({ where: { id } });
    if (!banner) return false;

    banner.isActive = false;
    await this.repository.save(banner);
    await this.invalidateCache(id);
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    await this.invalidateCache(id);
    return (result.affected ?? 0) > 0;
  }

  private async invalidateCache(bannerId?: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(REDIS_KEYS.activeBanners());
    if (bannerId) {
      await redis.del(REDIS_KEYS.banner(bannerId));
    }
  }
}
