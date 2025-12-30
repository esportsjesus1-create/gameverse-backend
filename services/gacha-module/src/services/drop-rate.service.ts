import { DropRateDisclosureRepository, BannerRepository, ItemRepository } from '../repositories';
import { DropRateDisclosure } from '../models';
import { DropRateDisclosure as DropRateDisclosureType, Rarity } from '../types';
import { config } from '../config';

export class DropRateService {
  private dropRateRepository: DropRateDisclosureRepository;
  private bannerRepository: BannerRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.dropRateRepository = new DropRateDisclosureRepository();
    this.bannerRepository = new BannerRepository();
    this.itemRepository = new ItemRepository();
  }

  async getDropRateDisclosure(bannerId: string): Promise<DropRateDisclosureType | null> {
    if (!config.regulatory.dropRateDisclosureEnabled) {
      return null;
    }

    const disclosure = await this.dropRateRepository.findByBanner(bannerId);
    if (!disclosure) {
      const banner = await this.bannerRepository.findById(bannerId);
      if (!banner) return null;

      const newDisclosure = await this.createDisclosureForBanner(bannerId);
      return newDisclosure ? this.toDropRateDisclosureType(newDisclosure) : null;
    }

    return this.toDropRateDisclosureType(disclosure);
  }

  async getAllDropRateDisclosures(): Promise<DropRateDisclosureType[]> {
    if (!config.regulatory.dropRateDisclosureEnabled) {
      return [];
    }

    const disclosures = await this.dropRateRepository.findAllActive();
    return disclosures.map((d) => this.toDropRateDisclosureType(d));
  }

  async createDisclosureForBanner(bannerId: string): Promise<DropRateDisclosure | null> {
    const banner = await this.bannerRepository.findById(bannerId);
    if (!banner) return null;

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

    return this.dropRateRepository.create({
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

  async updateDisclosure(bannerId: string): Promise<DropRateDisclosure | null> {
    return this.createDisclosureForBanner(bannerId);
  }

  async getDisclosureHistory(bannerId: string): Promise<DropRateDisclosure[]> {
    return this.dropRateRepository.findVersionHistory(bannerId);
  }

  formatDropRatesForDisplay(disclosure: DropRateDisclosureType): {
    summary: string;
    details: string[];
    warnings: string[];
  } {
    const summary = `Base rates: ${this.formatRates(disclosure.rates)}`;

    const details = [
      `Featured item rate: ${(disclosure.featuredRate * 100).toFixed(1)}%`,
      `Soft pity starts at pull ${disclosure.pitySystem.softPityStart}`,
      `Hard pity (guaranteed) at pull ${disclosure.pitySystem.hardPity}`,
      `Soft pity rate increase: ${(disclosure.pitySystem.softPityRateIncrease * 100).toFixed(1)}% per pull`,
    ];

    if (disclosure.pitySystem.guaranteedFeatured) {
      details.push('Guaranteed featured item after losing 50/50');
    }

    const warnings = [
      'Rates shown are base rates and may vary based on pity mechanics',
      'Individual item rates within each rarity tier are equally distributed',
    ];

    return { summary, details, warnings };
  }

  private formatRates(rates: Record<Rarity, number>): string {
    return Object.entries(rates)
      .filter(([_, rate]) => rate > 0)
      .map(([rarity, rate]) => `${rarity}: ${(rate * 100).toFixed(2)}%`)
      .join(', ');
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

  private toDropRateDisclosureType(disclosure: DropRateDisclosure): DropRateDisclosureType {
    return {
      bannerId: disclosure.bannerId,
      bannerName: disclosure.bannerName,
      rates: disclosure.rates,
      featuredRate: Number(disclosure.featuredRate),
      pitySystem: disclosure.pitySystem,
      featuredItems: disclosure.featuredItems.map((item) => ({
        id: item.id,
        name: item.name,
        rarity: item.rarity as Rarity,
        individualRate: item.individualRate,
      })),
      lastUpdated: disclosure.updatedAt,
    };
  }
}
