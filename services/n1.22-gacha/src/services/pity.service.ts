import { BannerType, PlayerPityState, PityConfig, Rarity } from '../types';
import { PlayerPityRepository } from '../repositories';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

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

  async getPityState(playerId: string, bannerType: BannerType): Promise<PlayerPityState> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerPity(playerId, bannerType);

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PlayerPityState;
    }

    const state = await this.pityRepository.getPityState(playerId, bannerType);

    await redis.setex(cacheKey, REDIS_TTL.pity, JSON.stringify(state));

    return state;
  }

  async checkPity(
    playerId: string,
    bannerType: BannerType,
    pityConfig: PityConfig
  ): Promise<PityCheckResult> {
    const state = await this.getPityState(playerId, bannerType);

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
    count: number = 1
  ): Promise<PlayerPityState> {
    const pity = await this.pityRepository.incrementPity(playerId, bannerType, count);

    const state: PlayerPityState = {
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      lastPullTimestamp: pity.lastPullTimestamp,
    };

    await this.updateCache(playerId, bannerType, state);

    return state;
  }

  async resetPity(
    playerId: string,
    bannerType: BannerType,
    lostFiftyFifty: boolean
  ): Promise<PlayerPityState> {
    const pity = await this.pityRepository.resetPity(playerId, bannerType, lostFiftyFifty);

    const state: PlayerPityState = {
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      lastPullTimestamp: pity.lastPullTimestamp,
    };

    await this.updateCache(playerId, bannerType, state);

    return state;
  }

  async handleHighRarityPull(
    playerId: string,
    bannerType: BannerType,
    isFeatured: boolean,
    pityConfig: PityConfig
  ): Promise<PlayerPityState> {
    let lostFiftyFifty = false;

    if (!isFeatured && pityConfig.guaranteedFeaturedAfterLoss) {
      lostFiftyFifty = true;
    }

    return this.resetPity(playerId, bannerType, lostFiftyFifty);
  }

  async processPullResult(
    playerId: string,
    bannerType: BannerType,
    rarity: Rarity,
    isFeatured: boolean,
    pityConfig: PityConfig
  ): Promise<PlayerPityState> {
    if (rarity === Rarity.LEGENDARY || rarity === Rarity.MYTHIC) {
      return this.handleHighRarityPull(playerId, bannerType, isFeatured, pityConfig);
    }

    return this.incrementPity(playerId, bannerType, 1);
  }

  async getAllPityStates(playerId: string): Promise<PlayerPityState[]> {
    const pities = await this.pityRepository.findByPlayer(playerId);

    return pities.map((pity) => ({
      playerId: pity.playerId,
      bannerType: pity.bannerType,
      pityCounter: pity.pityCounter,
      guaranteedFeatured: pity.guaranteedFeatured,
      lastPullTimestamp: pity.lastPullTimestamp,
    }));
  }

  private async updateCache(
    playerId: string,
    bannerType: BannerType,
    state: PlayerPityState
  ): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerPity(playerId, bannerType);
    await redis.setex(cacheKey, REDIS_TTL.pity, JSON.stringify(state));
  }

  async invalidateCache(playerId: string, bannerType: BannerType): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerPity(playerId, bannerType);
    await redis.del(cacheKey);
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
