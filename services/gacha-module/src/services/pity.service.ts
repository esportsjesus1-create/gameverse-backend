import { BannerType, PlayerPityState, PityConfig, Rarity } from '../types';
import { PlayerPityRepository } from '../repositories';

export interface PityCheckResult {
  isHardPity: boolean;
  isSoftPity: boolean;
  currentPity: number;
  pullsUntilHardPity: number;
  pullsUntilSoftPity: number;
  guaranteedFeatured: boolean;
}

export class PityService {
  private pityRepository: PlayerPityRepository;

  constructor() {
    this.pityRepository = new PlayerPityRepository();
  }

  async getPityState(playerId: string, bannerType: BannerType, bannerId?: string): Promise<PlayerPityState> {
    const pity = await this.pityRepository.getPityState(playerId, bannerType, bannerId);

    return {
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      bannerId: pity.bannerId || undefined,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      weaponPityCounter: pity.weaponPityCounter,
      lastPullTimestamp: pity.lastPullTimestamp,
    };
  }

  async checkPity(
    playerId: string,
    bannerType: BannerType,
    pityConfig: PityConfig,
    bannerId?: string
  ): Promise<PityCheckResult> {
    const state = await this.getPityState(playerId, bannerType, bannerId);

    const isHardPity = state.pityCounter >= pityConfig.hardPity - 1;
    const isSoftPity = state.pityCounter >= pityConfig.softPityStart;
    const pullsUntilHardPity = Math.max(0, pityConfig.hardPity - state.pityCounter - 1);
    const pullsUntilSoftPity = Math.max(0, pityConfig.softPityStart - state.pityCounter);

    return {
      isHardPity,
      isSoftPity,
      currentPity: state.pityCounter,
      pullsUntilHardPity,
      pullsUntilSoftPity,
      guaranteedFeatured: state.guaranteedFeatured,
    };
  }

  async incrementPity(
    playerId: string,
    bannerType: BannerType,
    count: number = 1,
    bannerId?: string
  ): Promise<PlayerPityState> {
    const pity = await this.pityRepository.incrementPity(playerId, bannerType, count, bannerId);

    return {
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      bannerId: pity.bannerId || undefined,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      weaponPityCounter: pity.weaponPityCounter,
      lastPullTimestamp: pity.lastPullTimestamp,
    };
  }

  async resetPity(
    playerId: string,
    bannerType: BannerType,
    lostFiftyFifty: boolean,
    isFeatured: boolean,
    bannerId?: string
  ): Promise<PlayerPityState> {
    const pity = await this.pityRepository.resetPity(playerId, bannerType, lostFiftyFifty, isFeatured, bannerId);

    return {
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      bannerId: pity.bannerId || undefined,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      weaponPityCounter: pity.weaponPityCounter,
      lastPullTimestamp: pity.lastPullTimestamp,
    };
  }

  async handleHighRarityPull(
    playerId: string,
    bannerType: BannerType,
    isFeatured: boolean,
    pityConfig: PityConfig,
    bannerId?: string
  ): Promise<PlayerPityState> {
    let lostFiftyFifty = false;

    if (!isFeatured && pityConfig.guaranteedFeaturedAfterLoss) {
      lostFiftyFifty = true;
    }

    return this.resetPity(playerId, bannerType, lostFiftyFifty, isFeatured, bannerId);
  }

  async processPullResult(
    playerId: string,
    bannerType: BannerType,
    rarity: Rarity,
    isFeatured: boolean,
    pityConfig: PityConfig,
    bannerId?: string
  ): Promise<PlayerPityState> {
    if (rarity === Rarity.LEGENDARY || rarity === Rarity.MYTHIC) {
      return this.handleHighRarityPull(playerId, bannerType, isFeatured, pityConfig, bannerId);
    }

    return this.incrementPity(playerId, bannerType, 1, bannerId);
  }

  async getAllPityStates(playerId: string): Promise<PlayerPityState[]> {
    const pities = await this.pityRepository.findByPlayer(playerId);

    return pities.map((pity) => ({
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      bannerId: pity.bannerId || undefined,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      weaponPityCounter: pity.weaponPityCounter,
      lastPullTimestamp: pity.lastPullTimestamp,
    }));
  }

  async getStatistics(playerId: string): Promise<{
    totalPulls: number;
    legendaryCount: number;
    featuredCount: number;
    averagePityToLegendary: number;
  }> {
    return this.pityRepository.getStatistics(playerId);
  }

  calculatePityProgress(currentPity: number, pityConfig: PityConfig): {
    softPityProgress: number;
    hardPityProgress: number;
    inSoftPity: boolean;
  } {
    const softPityProgress = Math.min(
      (currentPity / pityConfig.softPityStart) * 100,
      100
    );
    const hardPityProgress = Math.min(
      (currentPity / pityConfig.hardPity) * 100,
      100
    );
    const inSoftPity = currentPity >= pityConfig.softPityStart;

    return { softPityProgress, hardPityProgress, inSoftPity };
  }
}
