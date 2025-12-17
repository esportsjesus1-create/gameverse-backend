import { config, mmrConfig } from '../config';
import { getRedisClient, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger } from '../utils/logger';
import {
  MMRCalculationParams,
  MMRCalculationResult,
  SoftResetParams,
} from '../types';

export class MMRService {
  private calculateExpectedScore(playerMmr: number, opponentMmr: number): number {
    const exponent = (opponentMmr - playerMmr) / 400;
    return 1 / (1 + Math.pow(10, exponent));
  }

  private calculateKFactor(gamesPlayed: number, currentMmr: number): number {
    let kFactor = mmrConfig.baseKFactor;

    if (gamesPlayed < mmrConfig.newPlayerGamesThreshold) {
      kFactor = mmrConfig.maxKFactor;
    } else if (currentMmr >= 2400) {
      kFactor = mmrConfig.minKFactor;
    }

    return kFactor;
  }

  private calculateStreakBonus(winStreak: number, lossStreak: number, isWin: boolean): number {
    if (isWin && winStreak >= 3) {
      return Math.min(winStreak * mmrConfig.streakBonus, mmrConfig.maxStreakBonus);
    }
    if (!isWin && lossStreak >= 3) {
      return -Math.min(lossStreak * mmrConfig.streakBonus, mmrConfig.maxStreakBonus);
    }
    return 0;
  }

  public calculateMMRChange(params: MMRCalculationParams): MMRCalculationResult {
    const { playerMmr, opponentMmr, isWin, gamesPlayed, winStreak, lossStreak } = params;

    const expectedScore = this.calculateExpectedScore(playerMmr, opponentMmr);
    const actualScore = isWin ? 1 : 0;

    const kFactor = params.kFactor || this.calculateKFactor(gamesPlayed, playerMmr);
    const streakBonus = this.calculateStreakBonus(winStreak, lossStreak, isWin);

    let mmrChange = Math.round(kFactor * (actualScore - expectedScore));
    mmrChange += streakBonus;

    if (isWin && mmrChange < 1) {
      mmrChange = 1;
    }
    if (!isWin && mmrChange > -1) {
      mmrChange = -1;
    }

    let newMmr = playerMmr + mmrChange;
    newMmr = Math.max(config.MIN_MMR, Math.min(config.MAX_MMR, newMmr));

    return {
      newMmr,
      mmrChange,
      expectedScore,
      actualScore,
    };
  }

  public calculateSoftReset(params: SoftResetParams): number {
    const { currentMmr, baseMmr, resetFactor } = params;

    const newMmr = Math.round(currentMmr * resetFactor + baseMmr * (1 - resetFactor));

    return Math.max(config.MIN_MMR, Math.min(config.MAX_MMR, newMmr));
  }

  public calculatePlacementMMR(
    wins: number,
    losses: number,
    previousSeasonMmr: number | null
  ): number {
    const baseMMR = previousSeasonMmr
      ? this.calculateSoftReset({
          currentMmr: previousSeasonMmr,
          baseMmr: config.DEFAULT_MMR,
          resetFactor: config.SOFT_RESET_FACTOR,
        })
      : config.DEFAULT_MMR;

    const winRate = wins / (wins + losses);
    const placementBonus = Math.round((winRate - 0.5) * 400);

    let finalMmr = baseMMR + placementBonus;
    finalMmr = Math.max(config.MIN_MMR, Math.min(config.MAX_MMR, finalMmr));

    return finalMmr;
  }

  public async cachePlayerMMR(
    playerId: string,
    seasonId: string,
    mmr: number
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = CACHE_KEYS.PLAYER_MMR(playerId, seasonId);
      await redis.setex(key, CACHE_TTL.PLAYER_MMR, mmr.toString());
      logger.debug(`Cached MMR for player ${playerId}: ${mmr}`);
    } catch (error) {
      logger.error('Failed to cache player MMR:', error);
    }
  }

  public async getCachedPlayerMMR(
    playerId: string,
    seasonId: string
  ): Promise<number | null> {
    try {
      const redis = getRedisClient();
      const key = CACHE_KEYS.PLAYER_MMR(playerId, seasonId);
      const cached = await redis.get(key);
      if (cached) {
        return parseInt(cached, 10);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached player MMR:', error);
      return null;
    }
  }

  public async invalidatePlayerMMRCache(
    playerId: string,
    seasonId: string
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = CACHE_KEYS.PLAYER_MMR(playerId, seasonId);
      await redis.del(key);
      logger.debug(`Invalidated MMR cache for player ${playerId}`);
    } catch (error) {
      logger.error('Failed to invalidate player MMR cache:', error);
    }
  }
}

export const mmrService = new MMRService();
