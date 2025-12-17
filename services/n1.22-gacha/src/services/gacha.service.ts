import { v4 as uuidv4 } from 'uuid';
import { ProbabilityService } from './probability.service';
import { PityService } from './pity.service';
import { BannerService } from './banner.service';
import { PlayerPullRepository, ItemRepository } from '../repositories';
import {
  PullRequest,
  PullResponse,
  PullResult,
  Rarity,
  BannerConfig,
  PlayerPityState,
} from '../types';
import { Item } from '../models';

export class GachaService {
  private probabilityService: ProbabilityService;
  private pityService: PityService;
  private bannerService: BannerService;
  private pullRepository: PlayerPullRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.probabilityService = new ProbabilityService();
    this.pityService = new PityService();
    this.bannerService = new BannerService();
    this.pullRepository = new PlayerPullRepository();
    this.itemRepository = new ItemRepository();
  }

  async executePull(request: PullRequest): Promise<PullResponse> {
    const { playerId, bannerId, count = 1 } = request;

    if (count < 1 || count > 10) {
      throw new Error('Pull count must be between 1 and 10');
    }

    const banner = await this.bannerService.getBannerById(bannerId);
    if (!banner) {
      throw new Error('Banner not found');
    }

    if (!this.isBannerActive(banner)) {
      throw new Error('Banner is not currently active');
    }

    const results: PullResult[] = [];
    let currentPityState = await this.pityService.getPityState(playerId, banner.type);

    for (let i = 0; i < count; i++) {
      const result = await this.executeSinglePull(
        playerId,
        banner,
        currentPityState.pityCounter,
        currentPityState.guaranteedFeatured
      );

      results.push(result);

      currentPityState = await this.pityService.processPullResult(
        playerId,
        banner.type,
        result.rarity,
        result.isFeatured,
        banner.pityConfig
      );
    }

    await this.savePullHistory(playerId, bannerId, results);

    const totalCost = this.calculateTotalCost(banner, count);

    return {
      success: true,
      results,
      updatedPity: currentPityState,
      totalCost,
    };
  }

  private async executeSinglePull(
    _playerId: string,
    banner: BannerConfig,
    currentPity: number,
    guaranteedFeatured: boolean
  ): Promise<PullResult> {
    const adjustedRates = this.probabilityService.calculateAdjustedRates(
      banner.baseRates,
      banner.pityConfig,
      currentPity
    );

    const { rarity } = this.probabilityService.rollRarity(adjustedRates);

    let selectedItem: Item;
    let isFeatured = false;
    let isGuaranteed = false;

    if (rarity === Rarity.LEGENDARY || rarity === Rarity.MYTHIC) {
      const shouldBeFeatured = this.probabilityService.rollFeatured(
        banner.featuredRate,
        guaranteedFeatured
      );

      if (shouldBeFeatured && banner.featuredItems.length > 0) {
        const featuredItems = await this.itemRepository.findByIds(banner.featuredItems);
        const eligibleFeatured = featuredItems.filter((item) => item.rarity === rarity);

        if (eligibleFeatured.length > 0) {
          selectedItem = this.probabilityService.selectRandomItem(eligibleFeatured);
          isFeatured = true;
          isGuaranteed = guaranteedFeatured;
        } else {
          selectedItem = await this.selectFromPool(banner.itemPool, rarity);
        }
      } else {
        selectedItem = await this.selectFromPool(banner.itemPool, rarity);
      }

      if (currentPity >= banner.pityConfig.hardPity - 1) {
        isGuaranteed = true;
      }
    } else {
      selectedItem = await this.selectFromPool(banner.itemPool, rarity);
    }

    return {
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      rarity: selectedItem.rarity,
      isFeatured,
      pityCount: currentPity + 1,
      isGuaranteed,
    };
  }

  private async selectFromPool(itemPool: string[], rarity: Rarity): Promise<Item> {
    const items = await this.itemRepository.findByIdsAndRarity(itemPool, rarity);

    if (items.length === 0) {
      const allPoolItems = await this.itemRepository.findByIds(itemPool);
      if (allPoolItems.length === 0) {
        throw new Error('No items available in pool');
      }
      return this.probabilityService.selectRandomItem(allPoolItems);
    }

    return this.probabilityService.selectRandomItem(items);
  }

  private async savePullHistory(
    playerId: string,
    bannerId: string,
    results: PullResult[]
  ): Promise<void> {
    const pullRecords = results.map((result) => ({
      id: uuidv4(),
      playerId,
      bannerId,
      itemId: result.itemId,
      itemName: result.itemName,
      rarity: result.rarity,
      isFeatured: result.isFeatured,
      pityCount: result.pityCount,
      isGuaranteed: result.isGuaranteed,
      timestamp: new Date(),
    }));

    await this.pullRepository.createMany(pullRecords);
  }

  private calculateTotalCost(banner: BannerConfig, count: number): number {
    const baseCost = banner.pullCost * count;

    if (count === 10 && banner.multiPullDiscount > 0) {
      return Math.floor(baseCost * (1 - banner.multiPullDiscount));
    }

    return baseCost;
  }

  private isBannerActive(banner: BannerConfig): boolean {
    const now = new Date();

    if (banner.startDate > now) {
      return false;
    }

    if (banner.endDate && banner.endDate < now) {
      return false;
    }

    return true;
  }

  async getPullHistory(
    playerId: string,
    bannerId?: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{
    history: PullResult[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { pulls, total } = await this.pullRepository.getHistory({
      playerId,
      bannerId,
      page,
      pageSize,
    });

    const history = pulls.map((pull) => ({
      itemId: pull.itemId,
      itemName: pull.itemName,
      rarity: pull.rarity,
      isFeatured: pull.isFeatured,
      pityCount: pull.pityCount,
      isGuaranteed: pull.isGuaranteed,
    }));

    return { history, total, page, pageSize };
  }

  async getPityStatus(playerId: string): Promise<PlayerPityState[]> {
    return this.pityService.getAllPityStates(playerId);
  }

  async simulatePulls(
    bannerId: string,
    count: number
  ): Promise<{ rarityDistribution: Record<Rarity, number>; featuredCount: number }> {
    const banner = await this.bannerService.getBannerById(bannerId);
    if (!banner) {
      throw new Error('Banner not found');
    }

    const distribution: Record<Rarity, number> = {
      [Rarity.COMMON]: 0,
      [Rarity.RARE]: 0,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
      [Rarity.MYTHIC]: 0,
    };

    let featuredCount = 0;
    let simulatedPity = 0;
    let simulatedGuaranteed = false;

    for (let i = 0; i < count; i++) {
      const adjustedRates = this.probabilityService.calculateAdjustedRates(
        banner.baseRates,
        banner.pityConfig,
        simulatedPity
      );

      const { rarity } = this.probabilityService.rollRarity(adjustedRates);
      distribution[rarity]++;

      if (rarity === Rarity.LEGENDARY || rarity === Rarity.MYTHIC) {
        const isFeatured = this.probabilityService.rollFeatured(
          banner.featuredRate,
          simulatedGuaranteed
        );

        if (isFeatured) {
          featuredCount++;
          simulatedGuaranteed = false;
        } else {
          simulatedGuaranteed = banner.pityConfig.guaranteedFeaturedAfterLoss;
        }

        simulatedPity = 0;
      } else {
        simulatedPity++;
      }
    }

    return { rarityDistribution: distribution, featuredCount };
  }
}
