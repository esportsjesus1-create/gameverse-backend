import { BannerRepository, ItemRepository, DropRateDisclosureRepository } from '../repositories';
import { Banner } from '../models';
import {
  BannerConfig,
  BannerType,
  CreateBannerRequest,
} from '../types';
import { config } from '../config';

export class BannerService {
  private bannerRepository: BannerRepository;
  private itemRepository: ItemRepository;
  private dropRateDisclosureRepository: DropRateDisclosureRepository;

  constructor() {
    this.bannerRepository = new BannerRepository();
    this.itemRepository = new ItemRepository();
    this.dropRateDisclosureRepository = new DropRateDisclosureRepository();
  }

  async createBanner(data: CreateBannerRequest): Promise<BannerConfig> {
    const banner = await this.bannerRepository.create(data);

    if (config.regulatory.dropRateDisclosureEnabled) {
      await this.createDropRateDisclosure(banner);
    }

    return this.toBannerConfig(banner);
  }

  async getBannerById(id: string): Promise<BannerConfig | null> {
    const banner = await this.bannerRepository.findById(id);
    if (!banner) return null;
    return this.toBannerConfig(banner);
  }

  async getActiveBanners(): Promise<BannerConfig[]> {
    const banners = await this.bannerRepository.findActive();
    return banners.map((banner) => this.toBannerConfig(banner));
  }

  async getBannersByType(type: BannerType): Promise<BannerConfig[]> {
    const banners = await this.bannerRepository.findByType(type);
    return banners.map((banner) => this.toBannerConfig(banner));
  }

  async getAllBanners(): Promise<BannerConfig[]> {
    const banners = await this.bannerRepository.findAll();
    return banners.map((banner) => this.toBannerConfig(banner));
  }

  async updateBanner(id: string, data: Partial<CreateBannerRequest>): Promise<BannerConfig | null> {
    const banner = await this.bannerRepository.update(id, data);
    if (!banner) return null;

    if (config.regulatory.dropRateDisclosureEnabled) {
      await this.updateDropRateDisclosure(banner);
    }

    return this.toBannerConfig(banner);
  }

  async deleteBanner(id: string): Promise<boolean> {
    const deleted = await this.bannerRepository.delete(id);
    if (deleted) {
      await this.dropRateDisclosureRepository.deactivate(id);
    }
    return deleted;
  }

  async incrementTotalPulls(id: string, count: number = 1): Promise<void> {
    await this.bannerRepository.incrementTotalPulls(id, count);
  }

  async isBannerActive(banner: BannerConfig): Promise<boolean> {
    const now = new Date();

    if (banner.startDate > now) {
      return false;
    }

    if (banner.endDate && banner.endDate < now) {
      return false;
    }

    return true;
  }

  async validateBannerForPull(bannerId: string): Promise<{
    valid: boolean;
    banner?: BannerConfig;
    error?: string;
  }> {
    const banner = await this.getBannerById(bannerId);
    
    if (!banner) {
      return { valid: false, error: 'Banner not found' };
    }

    const isActive = await this.isBannerActive(banner);
    if (!isActive) {
      return { valid: false, error: 'Banner is not currently active' };
    }

    if (banner.itemPool.length === 0) {
      return { valid: false, error: 'Banner has no items in pool' };
    }

    return { valid: true, banner };
  }

  private async createDropRateDisclosure(banner: Banner): Promise<void> {
    const featuredItems = await this.itemRepository.findByIds(banner.featuredItems);
    const poolItems = await this.itemRepository.findByIds(banner.itemPool);

    const featuredItemsData = featuredItems.map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      individualRate: this.calculateIndividualRate(
        banner.baseRates[item.rarity],
        featuredItems.filter((i) => i.rarity === item.rarity).length,
        Number(banner.featuredRate)
      ),
    }));

    const poolItemsData = poolItems.map((item) => ({
      id: item.id,
      name: item.name,
      rarity: item.rarity,
      individualRate: this.calculateIndividualRate(
        banner.baseRates[item.rarity],
        poolItems.filter((i) => i.rarity === item.rarity).length,
        1 - Number(banner.featuredRate)
      ),
    }));

    await this.dropRateDisclosureRepository.create({
      bannerId: banner.id,
      bannerName: banner.name,
      rates: banner.baseRates,
      featuredRate: Number(banner.featuredRate),
      pitySystem: {
        softPityStart: banner.pityConfig.softPityStart,
        hardPity: banner.pityConfig.hardPity,
        softPityRateIncrease: banner.pityConfig.softPityRateIncrease,
        guaranteedFeatured: banner.pityConfig.guaranteedFeaturedAfterLoss,
      },
      featuredItems: featuredItemsData,
      poolItems: poolItemsData,
      legalDisclaimer: this.getDefaultLegalDisclaimer(),
    });
  }

  private async updateDropRateDisclosure(banner: Banner): Promise<void> {
    await this.createDropRateDisclosure(banner);
  }

  private calculateIndividualRate(
    rarityRate: number,
    itemCount: number,
    poolShare: number
  ): number {
    if (itemCount === 0) return 0;
    return (rarityRate * poolShare) / itemCount;
  }

  private getDefaultLegalDisclaimer(): string {
    return `Drop rates are displayed as probabilities and may vary based on pity system mechanics. ` +
      `Soft pity increases legendary rates starting at the specified pull count. ` +
      `Hard pity guarantees a legendary item at the specified pull count. ` +
      `The 50/50 system applies to featured items - if you don't get the featured item, ` +
      `your next legendary is guaranteed to be featured. ` +
      `These rates are subject to regulatory compliance and may vary by region.`;
  }

  private toBannerConfig(banner: Banner): BannerConfig {
    return {
      id: banner.id,
      name: banner.name,
      description: banner.description,
      type: banner.type,
      baseRates: banner.baseRates,
      pityConfig: banner.pityConfig,
      featuredItems: banner.featuredItems,
      itemPool: banner.itemPool,
      featuredRate: Number(banner.featuredRate),
      startDate: banner.startDate,
      endDate: banner.endDate,
      pullCost: banner.pullCost,
      currencyType: banner.currencyType,
      multiPullDiscount: Number(banner.multiPullDiscount),
      multiPullCount: banner.multiPullCount,
      guaranteedRarityOnMulti: banner.guaranteedRarityOnMulti || undefined,
      maxPullsPerDay: banner.maxPullsPerDay || undefined,
      requiresAgeVerification: banner.requiresAgeVerification,
      nftRewardsEnabled: banner.nftRewardsEnabled,
      imageUrl: banner.imageUrl,
      metadata: banner.metadata,
    };
  }
}
