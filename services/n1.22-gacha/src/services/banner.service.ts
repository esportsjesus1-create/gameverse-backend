import { BannerRepository, ItemRepository } from '../repositories';
import { Banner } from '../models';
import {
  BannerConfig,
  BannerType,
  CreateBannerRequest,
  Rarity,
  RarityRates,
  PityConfig,
} from '../types';
import config from '../config';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export class BannerService {
  private bannerRepository: BannerRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.bannerRepository = new BannerRepository();
    this.itemRepository = new ItemRepository();
  }

  async getActiveBanners(): Promise<BannerConfig[]> {
    const banners = await this.bannerRepository.findActive();
    return banners.map((banner) => this.toBannerConfig(banner));
  }

  async getActiveBannersByType(type: BannerType): Promise<BannerConfig[]> {
    const banners = await this.bannerRepository.findActiveByType(type);
    return banners.map((banner) => this.toBannerConfig(banner));
  }

  async getBannerById(id: string): Promise<BannerConfig | null> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.bannerConfig(id);

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as BannerConfig;
    }

    const banner = await this.bannerRepository.findById(id);
    if (!banner) {
      return null;
    }

    const bannerConfig = this.toBannerConfig(banner);

    await redis.setex(cacheKey, REDIS_TTL.banner, JSON.stringify(bannerConfig));

    return bannerConfig;
  }

  async createBanner(request: CreateBannerRequest): Promise<BannerConfig> {
    const baseRates = this.mergeRates(request.baseRates);
    const pityConfig = this.mergePityConfig(request.pityConfig);

    await this.validateItemPool(request.itemPool);
    await this.validateFeaturedItems(request.featuredItems, request.itemPool);

    const banner = await this.bannerRepository.create({
      name: request.name,
      type: request.type,
      baseRates,
      pityConfig,
      featuredItems: request.featuredItems,
      itemPool: request.itemPool,
      featuredRate: request.featuredRate ?? config.gachaDefaults.featuredRate,
      startDate: new Date(request.startDate),
      endDate: request.endDate ? new Date(request.endDate) : null,
      pullCost: request.pullCost,
      multiPullDiscount: request.multiPullDiscount ?? 0,
      isActive: true,
    });

    return this.toBannerConfig(banner);
  }

  async updateBanner(
    id: string,
    updates: Partial<CreateBannerRequest>
  ): Promise<BannerConfig | null> {
    const existing = await this.bannerRepository.findById(id);
    if (!existing) {
      return null;
    }

    const updateData: Partial<Banner> = {};

    if (updates.name) updateData.name = updates.name;
    if (updates.type) updateData.type = updates.type;
    if (updates.baseRates) updateData.baseRates = this.mergeRates(updates.baseRates);
    if (updates.pityConfig) updateData.pityConfig = this.mergePityConfig(updates.pityConfig);
    if (updates.featuredItems) {
      await this.validateFeaturedItems(updates.featuredItems, updates.itemPool ?? existing.itemPool);
      updateData.featuredItems = updates.featuredItems;
    }
    if (updates.itemPool) {
      await this.validateItemPool(updates.itemPool);
      updateData.itemPool = updates.itemPool;
    }
    if (updates.featuredRate !== undefined) updateData.featuredRate = updates.featuredRate;
    if (updates.startDate) updateData.startDate = new Date(updates.startDate);
    if (updates.endDate) updateData.endDate = new Date(updates.endDate);
    if (updates.pullCost !== undefined) updateData.pullCost = updates.pullCost;
    if (updates.multiPullDiscount !== undefined) updateData.multiPullDiscount = updates.multiPullDiscount;

    const updated = await this.bannerRepository.update(id, updateData);
    if (!updated) {
      return null;
    }

    await this.invalidateBannerCache(id);

    return this.toBannerConfig(updated);
  }

  async deleteBanner(id: string): Promise<boolean> {
    const result = await this.bannerRepository.delete(id);
    if (result) {
      await this.invalidateBannerCache(id);
    }
    return result;
  }

  async getItemsForBanner(bannerId: string): Promise<{
    featuredItems: { id: string; name: string; rarity: Rarity }[];
    poolItems: { id: string; name: string; rarity: Rarity }[];
  }> {
    const banner = await this.bannerRepository.findById(bannerId);
    if (!banner) {
      throw new Error('Banner not found');
    }

    const featuredItemEntities = await this.itemRepository.findByIds(banner.featuredItems);
    const poolItemEntities = await this.itemRepository.findByIds(banner.itemPool);

    return {
      featuredItems: featuredItemEntities.map((item) => ({
        id: item.id,
        name: item.name,
        rarity: item.rarity,
      })),
      poolItems: poolItemEntities.map((item) => ({
        id: item.id,
        name: item.name,
        rarity: item.rarity,
      })),
    };
  }

  async getItemsByRarityFromPool(
    itemPool: string[],
    rarity: Rarity
  ): Promise<{ id: string; name: string }[]> {
    const items = await this.itemRepository.findByIdsAndRarity(itemPool, rarity);
    return items.map((item) => ({ id: item.id, name: item.name }));
  }

  private mergeRates(partialRates?: Partial<RarityRates>): RarityRates {
    return {
      ...config.gachaDefaults.baseRates,
      ...partialRates,
    };
  }

  private mergePityConfig(partialConfig?: Partial<PityConfig>): PityConfig {
    return {
      ...config.gachaDefaults.pityConfig,
      ...partialConfig,
    };
  }

  private async validateItemPool(itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) {
      throw new Error('Item pool cannot be empty');
    }

    const items = await this.itemRepository.findByIds(itemIds);
    if (items.length !== itemIds.length) {
      const foundIds = new Set(items.map((i) => i.id));
      const missingIds = itemIds.filter((id) => !foundIds.has(id));
      throw new Error(`Items not found: ${missingIds.join(', ')}`);
    }
  }

  private async validateFeaturedItems(
    featuredIds: string[],
    poolIds: string[]
  ): Promise<void> {
    const poolSet = new Set(poolIds);
    const invalidFeatured = featuredIds.filter((id) => !poolSet.has(id));

    if (invalidFeatured.length > 0) {
      throw new Error(
        `Featured items must be in the item pool: ${invalidFeatured.join(', ')}`
      );
    }
  }

  private toBannerConfig(banner: Banner): BannerConfig {
    return {
      id: banner.id,
      name: banner.name,
      type: banner.type,
      baseRates: banner.baseRates,
      pityConfig: banner.pityConfig,
      featuredItems: banner.featuredItems,
      itemPool: banner.itemPool,
      featuredRate: Number(banner.featuredRate),
      startDate: banner.startDate,
      endDate: banner.endDate,
      pullCost: banner.pullCost,
      multiPullDiscount: Number(banner.multiPullDiscount),
    };
  }

  private async invalidateBannerCache(bannerId: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.bannerConfig(bannerId);
    await redis.del(cacheKey);
  }
}
