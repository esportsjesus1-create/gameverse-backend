import { tierThresholds, mmrConfig } from '../config';
import { getRedisClient, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger } from '../utils/logger';
import {
  RankedTier,
  TierDivision,
  PlayerRank,
  TierThreshold,
} from '../types';

export class TierService {
  private readonly tierOrder: RankedTier[] = [
    RankedTier.BRONZE,
    RankedTier.SILVER,
    RankedTier.GOLD,
    RankedTier.PLATINUM,
    RankedTier.DIAMOND,
    RankedTier.MASTER,
    RankedTier.GRANDMASTER,
    RankedTier.CHALLENGER,
  ];

  public getTierFromMMR(mmr: number): { tier: RankedTier; division: TierDivision | null } {
    for (const threshold of tierThresholds) {
      if (mmr >= threshold.minMMR && mmr <= threshold.maxMMR) {
        const tier = threshold.tier as RankedTier;
        let division: TierDivision | null = null;

        if (threshold.hasDivisions) {
          const tierRange = threshold.maxMMR - threshold.minMMR + 1;
          const divisionSize = tierRange / 4;
          const positionInTier = mmr - threshold.minMMR;
          const divisionIndex = Math.floor(positionInTier / divisionSize);
          division = (4 - divisionIndex) as TierDivision;
          division = Math.max(1, Math.min(4, division)) as TierDivision;
        }

        return { tier, division };
      }
    }

    return { tier: RankedTier.BRONZE, division: TierDivision.IV };
  }

  public getTierThreshold(tier: RankedTier): TierThreshold | undefined {
    const threshold = tierThresholds.find((t) => t.tier === tier);
    if (threshold) {
      return {
        tier: threshold.tier as RankedTier,
        minMMR: threshold.minMMR,
        maxMMR: threshold.maxMMR,
        hasDivisions: threshold.hasDivisions,
      };
    }
    return undefined;
  }

  public getDivisionMMRRange(
    tier: RankedTier,
    division: TierDivision
  ): { minMMR: number; maxMMR: number } | null {
    const threshold = this.getTierThreshold(tier);
    if (!threshold || !threshold.hasDivisions) {
      return null;
    }

    const tierRange = threshold.maxMMR - threshold.minMMR + 1;
    const divisionSize = tierRange / 4;
    const divisionIndex = 4 - division;

    const minMMR = Math.floor(threshold.minMMR + divisionIndex * divisionSize);
    const maxMMR = Math.floor(threshold.minMMR + (divisionIndex + 1) * divisionSize - 1);

    return { minMMR, maxMMR };
  }

  public calculateLeaguePoints(mmr: number, tier: RankedTier, division: TierDivision | null): number {
    const threshold = this.getTierThreshold(tier);
    if (!threshold) {
      return 0;
    }

    if (!threshold.hasDivisions || division === null) {
      return Math.min(mmr - threshold.minMMR, 999);
    }

    const divisionRange = this.getDivisionMMRRange(tier, division);
    if (!divisionRange) {
      return 0;
    }

    const positionInDivision = mmr - divisionRange.minMMR;
    const divisionSize = divisionRange.maxMMR - divisionRange.minMMR + 1;
    const lp = Math.floor((positionInDivision / divisionSize) * 100);

    return Math.max(0, Math.min(100, lp));
  }

  public shouldPromote(leaguePoints: number, isInPromos: boolean, promoWins: number): boolean {
    if (!isInPromos && leaguePoints >= mmrConfig.divisionLpThreshold) {
      return true;
    }
    if (isInPromos && promoWins >= mmrConfig.promoWinsRequired) {
      return true;
    }
    return false;
  }

  public shouldDemote(leaguePoints: number, tier: RankedTier, division: TierDivision | null): boolean {
    if (tier === RankedTier.BRONZE && division === TierDivision.IV) {
      return false;
    }
    return leaguePoints <= 0;
  }

  public getNextTierDivision(
    currentTier: RankedTier,
    currentDivision: TierDivision | null
  ): { tier: RankedTier; division: TierDivision | null } | null {
    const threshold = this.getTierThreshold(currentTier);
    if (!threshold) {
      return null;
    }

    if (threshold.hasDivisions && currentDivision !== null) {
      if (currentDivision > TierDivision.I) {
        return { tier: currentTier, division: (currentDivision - 1) as TierDivision };
      }
    }

    const currentIndex = this.tierOrder.indexOf(currentTier);
    if (currentIndex < this.tierOrder.length - 1) {
      const nextTier = this.tierOrder[currentIndex + 1];
      const nextThreshold = this.getTierThreshold(nextTier);
      return {
        tier: nextTier,
        division: nextThreshold?.hasDivisions ? TierDivision.IV : null,
      };
    }

    return null;
  }

  public getPreviousTierDivision(
    currentTier: RankedTier,
    currentDivision: TierDivision | null
  ): { tier: RankedTier; division: TierDivision | null } | null {
    const threshold = this.getTierThreshold(currentTier);
    if (!threshold) {
      return null;
    }

    if (threshold.hasDivisions && currentDivision !== null) {
      if (currentDivision < TierDivision.IV) {
        return { tier: currentTier, division: (currentDivision + 1) as TierDivision };
      }
    }

    const currentIndex = this.tierOrder.indexOf(currentTier);
    if (currentIndex > 0) {
      const prevTier = this.tierOrder[currentIndex - 1];
      const prevThreshold = this.getTierThreshold(prevTier);
      return {
        tier: prevTier,
        division: prevThreshold?.hasDivisions ? TierDivision.I : null,
      };
    }

    return null;
  }

  public compareTiers(
    tier1: RankedTier,
    division1: TierDivision | null,
    tier2: RankedTier,
    division2: TierDivision | null
  ): number {
    const tierIndex1 = this.tierOrder.indexOf(tier1);
    const tierIndex2 = this.tierOrder.indexOf(tier2);

    if (tierIndex1 !== tierIndex2) {
      return tierIndex1 - tierIndex2;
    }

    if (division1 === null && division2 === null) {
      return 0;
    }
    if (division1 === null) {
      return 1;
    }
    if (division2 === null) {
      return -1;
    }

    return division2 - division1;
  }

  public formatRank(tier: RankedTier, division: TierDivision | null): string {
    const divisionRoman: Record<TierDivision, string> = {
      [TierDivision.I]: 'I',
      [TierDivision.II]: 'II',
      [TierDivision.III]: 'III',
      [TierDivision.IV]: 'IV',
    };

    if (division === null) {
      return tier;
    }

    return `${tier} ${divisionRoman[division]}`;
  }

  public async cachePlayerRank(
    playerId: string,
    seasonId: string,
    rank: PlayerRank
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = CACHE_KEYS.PLAYER_RANK(playerId, seasonId);
      await redis.setex(key, CACHE_TTL.PLAYER_RANK, JSON.stringify(rank));
      logger.debug(`Cached rank for player ${playerId}`);
    } catch (error) {
      logger.error('Failed to cache player rank:', error);
    }
  }

  public async getCachedPlayerRank(
    playerId: string,
    seasonId: string
  ): Promise<PlayerRank | null> {
    try {
      const redis = getRedisClient();
      const key = CACHE_KEYS.PLAYER_RANK(playerId, seasonId);
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as PlayerRank;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached player rank:', error);
      return null;
    }
  }

  public async invalidatePlayerRankCache(
    playerId: string,
    seasonId: string
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      const key = CACHE_KEYS.PLAYER_RANK(playerId, seasonId);
      await redis.del(key);
    } catch (error) {
      logger.error('Failed to invalidate player rank cache:', error);
    }
  }
}

export const tierService = new TierService();
