import { v4 as uuidv4 } from 'uuid';
import { ProbabilityService } from './probability.service';
import { PityService } from './pity.service';
import { BannerService } from './banner.service';
import { CurrencyService } from './currency.service';
import { InventoryService } from './inventory.service';
import { NFTService } from './nft.service';
import { ComplianceService } from './compliance.service';
import { PlayerPullRepository, ItemRepository } from '../repositories';
import {
  PullRequest,
  PullResponse,
  PullResult,
  Rarity,
  BannerConfig,
  PlayerPityState,
  TransactionType,
  NFTRewardInfo,
  NFTRewardStatus,
  StatisticalValidationResult,
} from '../types';
import { Item } from '../models';
import { config } from '../config';
import { getRedisClient, REDIS_KEYS } from '../config/redis';

export class GachaService {
  private probabilityService: ProbabilityService;
  private pityService: PityService;
  private bannerService: BannerService;
  private currencyService: CurrencyService;
  private inventoryService: InventoryService;
  private nftService: NFTService;
  private complianceService: ComplianceService;
  private pullRepository: PlayerPullRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.probabilityService = new ProbabilityService();
    this.pityService = new PityService();
    this.bannerService = new BannerService();
    this.currencyService = new CurrencyService();
    this.inventoryService = new InventoryService();
    this.nftService = new NFTService();
    this.complianceService = new ComplianceService();
    this.pullRepository = new PlayerPullRepository();
    this.itemRepository = new ItemRepository();
  }

  async executePull(request: PullRequest): Promise<PullResponse> {
    const { playerId, bannerId, count = 1 } = request;

    if (count < 1 || count > config.gacha.maxPullsPerRequest) {
      throw new Error(`Pull count must be between 1 and ${config.gacha.maxPullsPerRequest}`);
    }

    const bannerValidation = await this.bannerService.validateBannerForPull(bannerId);
    if (!bannerValidation.valid || !bannerValidation.banner) {
      throw new Error(bannerValidation.error || 'Banner validation failed');
    }

    const banner = bannerValidation.banner;

    if (banner.requiresAgeVerification) {
      const complianceCheck = await this.complianceService.checkCompliance(
        playerId,
        this.calculateTotalCost(banner, count),
        true
      );

      if (!complianceCheck.canProceed) {
        throw new Error(complianceCheck.errors.join('; '));
      }
    }

    const totalCost = this.calculateTotalCost(banner, count);

    const hasBalance = await this.currencyService.hasEnoughBalance(
      playerId,
      banner.currencyType,
      totalCost
    );

    if (!hasBalance) {
      throw new Error(`Insufficient ${banner.currencyType} balance`);
    }

    const lock = await this.acquirePullLock(playerId);
    if (!lock) {
      throw new Error('Another pull is in progress. Please wait.');
    }

    try {
      const deductResult = await this.currencyService.deductCurrency(
        playerId,
        banner.currencyType,
        totalCost,
        TransactionType.PULL,
        undefined,
        `Pull x${count} on ${banner.name}`
      );

      if (!deductResult.success) {
        throw new Error(deductResult.error || 'Failed to deduct currency');
      }

      const results: PullResult[] = [];
      const newItems: string[] = [];
      const nftRewards: NFTRewardInfo[] = [];
      let currentPityState = await this.pityService.getPityState(playerId, banner.type, bannerId);

      for (let i = 0; i < count; i++) {
        const result = await this.executeSinglePull(
          playerId,
          banner,
          currentPityState.pityCounter,
          currentPityState.guaranteedFeatured
        );

        results.push(result);

        if (result.isNew) {
          newItems.push(result.itemId);
        }

        if (result.nftReward) {
          nftRewards.push(result.nftReward);
        }

        currentPityState = await this.pityService.processPullResult(
          playerId,
          banner.type,
          result.rarity,
          result.isFeatured,
          banner.pityConfig,
          bannerId
        );
      }

      await this.savePullHistory(playerId, banner, results);
      await this.bannerService.incrementTotalPulls(bannerId, count);

      await this.currencyService.recordPullSpending(playerId, totalCost, count);

      const balance = await this.currencyService.getBalance(playerId, banner.currencyType);

      return {
        success: true,
        results,
        updatedPity: currentPityState,
        totalCost,
        currencyType: banner.currencyType,
        remainingBalance: Number(balance.balance),
        newItems,
        nftRewards,
      };
    } finally {
      await this.releasePullLock(playerId);
    }
  }

  private async executeSinglePull(
    playerId: string,
    banner: BannerConfig,
    currentPity: number,
    guaranteedFeatured: boolean
  ): Promise<PullResult> {
    const { rates: adjustedRates, isSoftPity, isHardPity } = this.probabilityService.calculateAdjustedRates(
      banner.baseRates,
      banner.pityConfig,
      currentPity
    );

    const { rarity } = this.probabilityService.rollRarity(adjustedRates, isSoftPity, isHardPity);

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

      if (isHardPity) {
        isGuaranteed = true;
      }
    } else {
      selectedItem = await this.selectFromPool(banner.itemPool, rarity);
    }

    const inventoryResult = await this.inventoryService.addItem(
      playerId,
      selectedItem.id,
      `banner:${banner.id}`,
      1
    );

    let nftReward: NFTRewardInfo | undefined;
    if (banner.nftRewardsEnabled && selectedItem.isNFT && config.gamerstake.enabled) {
      const pullId = uuidv4();
      const reward = await this.nftService.createNFTReward(
        playerId,
        pullId,
        selectedItem.id,
        undefined,
        selectedItem.nftMetadata
      );

      nftReward = {
        status: NFTRewardStatus.PENDING,
        contractAddress: reward.contractAddress,
        metadata: selectedItem.nftMetadata,
      };
    }

    return {
      id: uuidv4(),
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      itemType: selectedItem.type,
      rarity: selectedItem.rarity,
      isFeatured,
      pityCount: currentPity + 1,
      isGuaranteed,
      isNew: inventoryResult.isNew,
      nftReward,
      timestamp: new Date(),
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
    banner: BannerConfig,
    results: PullResult[]
  ): Promise<void> {
    const pullRecords = results.map((result) => ({
      playerId,
      bannerId: banner.id,
      bannerName: banner.name,
      itemId: result.itemId,
      itemName: result.itemName,
      itemType: result.itemType,
      rarity: result.rarity,
      isFeatured: result.isFeatured,
      pityCount: result.pityCount,
      isGuaranteed: result.isGuaranteed,
      isSoftPity: result.pityCount >= banner.pityConfig.softPityStart,
      isHardPity: result.pityCount >= banner.pityConfig.hardPity,
      cost: banner.pullCost,
      currencyType: banner.currencyType,
      nftTokenId: result.nftReward?.tokenId,
      nftTransactionHash: result.nftReward?.transactionHash,
    }));

    await this.pullRepository.createMany(pullRecords);
  }

  private calculateTotalCost(banner: BannerConfig, count: number): number {
    const baseCost = banner.pullCost * count;

    if (count === banner.multiPullCount && banner.multiPullDiscount > 0) {
      return Math.floor(baseCost * (1 - banner.multiPullDiscount));
    }

    return baseCost;
  }

  private async acquirePullLock(playerId: string): Promise<boolean> {
    const redis = getRedisClient();
    const lockKey = REDIS_KEYS.pullLock(playerId);
    const result = await redis.set(lockKey, '1', 'EX', 30, 'NX');
    return result === 'OK';
  }

  private async releasePullLock(playerId: string): Promise<void> {
    const redis = getRedisClient();
    const lockKey = REDIS_KEYS.pullLock(playerId);
    await redis.del(lockKey);
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
      id: pull.id,
      itemId: pull.itemId,
      itemName: pull.itemName,
      itemType: pull.itemType,
      rarity: pull.rarity,
      isFeatured: pull.isFeatured,
      pityCount: pull.pityCount,
      isGuaranteed: pull.isGuaranteed,
      isNew: false,
      timestamp: pull.timestamp,
    }));

    return { history, total, page, pageSize };
  }

  async getPityStatus(playerId: string): Promise<PlayerPityState[]> {
    return this.pityService.getAllPityStates(playerId);
  }

  async simulatePulls(
    bannerId: string,
    count: number
  ): Promise<StatisticalValidationResult> {
    if (count > config.gacha.maxSimulationPulls) {
      throw new Error(`Simulation count cannot exceed ${config.gacha.maxSimulationPulls}`);
    }

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
    let softPityTriggers = 0;
    let hardPityTriggers = 0;
    let simulatedPity = 0;
    let simulatedGuaranteed = false;
    const pullsToLegendary: number[] = [];
    let pullsSinceLastLegendary = 0;

    for (let i = 0; i < count; i++) {
      const { rates: adjustedRates, isSoftPity, isHardPity } = this.probabilityService.calculateAdjustedRates(
        banner.baseRates,
        banner.pityConfig,
        simulatedPity
      );

      const { rarity } = this.probabilityService.rollRarity(adjustedRates, isSoftPity, isHardPity);
      distribution[rarity]++;
      pullsSinceLastLegendary++;

      if (rarity === Rarity.LEGENDARY || rarity === Rarity.MYTHIC) {
        pullsToLegendary.push(pullsSinceLastLegendary);
        pullsSinceLastLegendary = 0;

        if (isSoftPity) softPityTriggers++;
        if (isHardPity) hardPityTriggers++;

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

    pullsToLegendary.sort((a, b) => a - b);
    const averagePullsToLegendary = pullsToLegendary.length > 0
      ? pullsToLegendary.reduce((sum, val) => sum + val, 0) / pullsToLegendary.length
      : 0;
    const medianPullsToLegendary = pullsToLegendary.length > 0
      ? pullsToLegendary[Math.floor(pullsToLegendary.length / 2)]
      : 0;
    const percentile90PullsToLegendary = pullsToLegendary.length > 0
      ? pullsToLegendary[Math.floor(pullsToLegendary.length * 0.9)]
      : 0;

    const legendaryCount = distribution[Rarity.LEGENDARY] + distribution[Rarity.MYTHIC];
    const actualFeaturedRate = legendaryCount > 0 ? featuredCount / legendaryCount : 0;
    const pityTriggerRate = legendaryCount > 0 ? (softPityTriggers + hardPityTriggers) / legendaryCount : 0;

    const { chiSquare, pValue, isWithinTolerance } = this.probabilityService.calculateChiSquare(
      distribution,
      banner.baseRates,
      count
    );

    return {
      totalPulls: count,
      rarityDistribution: distribution,
      expectedDistribution: banner.baseRates,
      chiSquareValue: chiSquare,
      pValue,
      isWithinTolerance,
      averagePullsToLegendary,
      medianPullsToLegendary,
      percentile90PullsToLegendary,
      featuredRate: actualFeaturedRate,
      expectedFeaturedRate: banner.featuredRate,
      pityTriggerRate,
      softPityTriggerRate: legendaryCount > 0 ? softPityTriggers / legendaryCount : 0,
      hardPityTriggerRate: legendaryCount > 0 ? hardPityTriggers / legendaryCount : 0,
      timestamp: new Date(),
    };
  }
}
