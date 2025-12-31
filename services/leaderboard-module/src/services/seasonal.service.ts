import { v4 as uuidv4 } from 'uuid';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import {
  SeasonNotFoundError,
  SeasonNotActiveError,
  SeasonEndedError,
  LeaderboardEntryNotFoundError,
  PlacementNotCompletedError,
} from '../utils/errors';
import {
  LeaderboardEntry,
  RankTier,
  TierDivision,
  PaginatedResponse,
  SeasonalRewardPreview,
  DecayStatus,
} from '../types';
import { config } from '../config';

interface Season {
  id: string;
  name: string;
  number: number;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  placementMatchesRequired: number;
  decayEnabled: boolean;
  decayDays: number;
  decayAmount: number;
  rewards: SeasonReward[];
  createdAt: Date;
  updatedAt: Date;
}

interface SeasonReward {
  tier: RankTier;
  rewardId: string;
  rewardName: string;
  rewardType: string;
  quantity: number;
  isExclusive: boolean;
}

interface SeasonalPlayerData {
  playerId: string;
  seasonId: string;
  entry: LeaderboardEntry;
  placementMatchesPlayed: number;
  placementMatchesWon: number;
  isPlacementComplete: boolean;
  peakRank: number;
  peakTier: RankTier;
  peakMMR: number;
  lastActivityAt: Date;
  decayWarningAt: Date | null;
  isDecayProtected: boolean;
}

class SeasonalRankingService {
  private seasons: Map<string, Season> = new Map();
  private seasonalData: Map<string, Map<string, SeasonalPlayerData>> = new Map();
  private sortedSeasonalEntries: Map<string, LeaderboardEntry[]> = new Map();
  private activeSeasonId: string | null = null;

  constructor() {
    this.initializeDefaultSeason();
  }

  private initializeDefaultSeason(): void {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + 3);

    const season: Season = {
      id: uuidv4(),
      name: 'Season 1',
      number: 1,
      startDate: now,
      endDate,
      isActive: true,
      placementMatchesRequired: 10,
      decayEnabled: config.RANK_DECAY_ENABLED,
      decayDays: config.RANK_DECAY_DAYS,
      decayAmount: config.RANK_DECAY_AMOUNT,
      rewards: this.getDefaultRewards(),
      createdAt: now,
      updatedAt: now,
    };

    this.seasons.set(season.id, season);
    this.seasonalData.set(season.id, new Map());
    this.sortedSeasonalEntries.set(season.id, []);
    this.activeSeasonId = season.id;

    logger.info(EventType.SEASON_STARTED, `Season ${season.number} initialized: ${season.name}`);
  }

  private getDefaultRewards(): SeasonReward[] {
    return [
      { tier: RankTier.CHALLENGER, rewardId: 'challenger_border', rewardName: 'Challenger Border', rewardType: 'BORDER', quantity: 1, isExclusive: true },
      { tier: RankTier.GRANDMASTER, rewardId: 'grandmaster_border', rewardName: 'Grandmaster Border', rewardType: 'BORDER', quantity: 1, isExclusive: true },
      { tier: RankTier.MASTER, rewardId: 'master_border', rewardName: 'Master Border', rewardType: 'BORDER', quantity: 1, isExclusive: false },
      { tier: RankTier.DIAMOND, rewardId: 'diamond_border', rewardName: 'Diamond Border', rewardType: 'BORDER', quantity: 1, isExclusive: false },
      { tier: RankTier.PLATINUM, rewardId: 'platinum_border', rewardName: 'Platinum Border', rewardType: 'BORDER', quantity: 1, isExclusive: false },
      { tier: RankTier.GOLD, rewardId: 'gold_border', rewardName: 'Gold Border', rewardType: 'BORDER', quantity: 1, isExclusive: false },
      { tier: RankTier.SILVER, rewardId: 'silver_icon', rewardName: 'Silver Icon', rewardType: 'ICON', quantity: 1, isExclusive: false },
      { tier: RankTier.BRONZE, rewardId: 'bronze_icon', rewardName: 'Bronze Icon', rewardType: 'ICON', quantity: 1, isExclusive: false },
    ];
  }

  public async getActiveSeason(): Promise<Season | null> {
    if (!this.activeSeasonId) return null;

    const cached = await cacheService.get<Season>(CACHE_KEYS.ACTIVE_SEASON());
    if (cached) return cached;

    const season = this.seasons.get(this.activeSeasonId);
    if (season) {
      await cacheService.set(CACHE_KEYS.ACTIVE_SEASON(), season, CACHE_TTL.ACTIVE_SEASON);
    }
    return season || null;
  }

  public async getSeasonById(seasonId: string): Promise<Season> {
    const season = this.seasons.get(seasonId);
    if (!season) {
      throw new SeasonNotFoundError(seasonId);
    }
    return season;
  }

  public async getSeasonalLeaderboard(
    seasonId?: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const season = this.seasons.get(id);
    if (!season) {
      throw new SeasonNotFoundError(id);
    }

    const cacheKey = `seasonal:${id}:page:${page}`;
    const cached = await cacheService.get<PaginatedResponse<LeaderboardEntry>>(cacheKey);
    if (cached) return cached;

    const entries = this.sortedSeasonalEntries.get(id) || [];
    const completedEntries = entries.filter((e) => {
      const playerData = this.seasonalData.get(id)?.get(e.playerId);
      return playerData?.isPlacementComplete;
    });

    const offset = (page - 1) * limit;
    const paginatedEntries = completedEntries.slice(offset, offset + limit);
    const total = completedEntries.length;
    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResponse<LeaderboardEntry> = {
      data: paginatedEntries,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };

    await cacheService.set(cacheKey, result, CACHE_TTL.LEADERBOARD);
    return result;
  }

  public async getPlayerSeasonalRank(
    playerId: string,
    seasonId?: string
  ): Promise<LeaderboardEntry | null> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const playerData = this.seasonalData.get(id)?.get(playerId);
    if (!playerData) return null;

    return playerData.entry;
  }

  public async getPlayerSeasonalData(
    playerId: string,
    seasonId?: string
  ): Promise<SeasonalPlayerData | null> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    return this.seasonalData.get(id)?.get(playerId) || null;
  }

  public async updateSeasonalRank(
    playerId: string,
    playerName: string,
    score: number,
    mmr: number,
    isWin: boolean,
    seasonId?: string,
    additionalData?: Partial<LeaderboardEntry>
  ): Promise<SeasonalPlayerData> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const season = this.seasons.get(id);
    if (!season) {
      throw new SeasonNotFoundError(id);
    }

    if (!season.isActive) {
      throw new SeasonNotActiveError(id);
    }

    if (season.endDate && new Date() > season.endDate) {
      throw new SeasonEndedError(id);
    }

    const now = new Date();
    let playerData = this.seasonalData.get(id)?.get(playerId);

    if (!playerData) {
      const entry: LeaderboardEntry = {
        id: uuidv4(),
        leaderboardId: id,
        playerId,
        playerName,
        playerAvatar: additionalData?.playerAvatar,
        rank: (this.sortedSeasonalEntries.get(id)?.length || 0) + 1,
        score,
        tier: this.calculateTier(mmr),
        division: undefined,
        mmr,
        wins: isWin ? 1 : 0,
        losses: isWin ? 0 : 1,
        draws: 0,
        winRate: isWin ? 100 : 0,
        gamesPlayed: 1,
        winStreak: isWin ? 1 : 0,
        bestWinStreak: isWin ? 1 : 0,
        region: additionalData?.region,
        gameId: additionalData?.gameId,
        seasonId: id,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      };

      playerData = {
        playerId,
        seasonId: id,
        entry,
        placementMatchesPlayed: 1,
        placementMatchesWon: isWin ? 1 : 0,
        isPlacementComplete: 1 >= season.placementMatchesRequired,
        peakRank: entry.rank,
        peakTier: entry.tier,
        peakMMR: mmr,
        lastActivityAt: now,
        decayWarningAt: null,
        isDecayProtected: false,
      };

      this.seasonalData.get(id)?.set(playerId, playerData);
    } else {
      const entry = playerData.entry;
      entry.score = score;
      entry.mmr = mmr;
      entry.wins += isWin ? 1 : 0;
      entry.losses += isWin ? 0 : 1;
      entry.gamesPlayed = entry.wins + entry.losses + entry.draws;
      entry.winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 10000) / 100 : 0;
      entry.winStreak = isWin ? entry.winStreak + 1 : 0;
      entry.bestWinStreak = Math.max(entry.bestWinStreak, entry.winStreak);
      entry.tier = this.calculateTier(mmr);
      entry.division = this.calculateDivision(mmr, entry.tier);
      entry.lastActiveAt = now;
      entry.updatedAt = now;

      if (!playerData.isPlacementComplete) {
        playerData.placementMatchesPlayed++;
        if (isWin) playerData.placementMatchesWon++;
        playerData.isPlacementComplete = playerData.placementMatchesPlayed >= season.placementMatchesRequired;
      }

      playerData.peakMMR = Math.max(playerData.peakMMR, mmr);
      if (entry.rank < playerData.peakRank) {
        playerData.peakRank = entry.rank;
      }
      if (this.getTierOrder(entry.tier) > this.getTierOrder(playerData.peakTier)) {
        playerData.peakTier = entry.tier;
      }
      playerData.lastActivityAt = now;
      playerData.decayWarningAt = null;
    }

    this.resortSeasonalLeaderboard(id);
    await this.invalidateSeasonalCache(id, playerId);

    return playerData;
  }

  public async getSeasonalRewardPreview(
    playerId: string,
    seasonId?: string
  ): Promise<SeasonalRewardPreview> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const season = this.seasons.get(id);
    if (!season) {
      throw new SeasonNotFoundError(id);
    }

    const playerData = this.seasonalData.get(id)?.get(playerId);
    if (!playerData) {
      throw new LeaderboardEntryNotFoundError(playerId, id);
    }

    if (!playerData.isPlacementComplete) {
      throw new PlacementNotCompletedError(playerId);
    }

    const currentTier = playerData.entry.tier;
    const projectedRewards = season.rewards
      .filter((r) => this.getTierOrder(r.tier) <= this.getTierOrder(currentTier))
      .map((r) => ({
        rewardId: r.rewardId,
        rewardName: r.rewardName,
        rewardType: r.rewardType,
        quantity: r.quantity,
        isGuaranteed: true,
      }));

    const nextTierReward = season.rewards.find(
      (r) => this.getTierOrder(r.tier) === this.getTierOrder(currentTier) + 1
    );

    return {
      playerId,
      seasonId: id,
      currentRank: playerData.entry.rank,
      currentTier,
      currentDivision: playerData.entry.division,
      projectedRewards,
      rankToNextReward: nextTierReward ? this.calculateRanksToNextTier(playerData.entry.mmr, currentTier) : undefined,
      nextRewardTier: nextTierReward?.tier,
    };
  }

  public async getDecayStatus(
    playerId: string,
    seasonId?: string
  ): Promise<DecayStatus> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const season = this.seasons.get(id);
    if (!season) {
      throw new SeasonNotFoundError(id);
    }

    const playerData = this.seasonalData.get(id)?.get(playerId);
    if (!playerData) {
      throw new LeaderboardEntryNotFoundError(playerId, id);
    }

    const now = new Date();
    const daysSinceActivity = Math.floor(
      (now.getTime() - playerData.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isDecaying = season.decayEnabled && 
      daysSinceActivity >= season.decayDays && 
      !playerData.isDecayProtected &&
      this.getTierOrder(playerData.entry.tier) >= this.getTierOrder(RankTier.PLATINUM);

    return {
      playerId,
      leaderboardId: id,
      isDecaying,
      decayStartAt: isDecaying ? new Date(playerData.lastActivityAt.getTime() + season.decayDays * 24 * 60 * 60 * 1000) : undefined,
      lastActivityAt: playerData.lastActivityAt,
      daysUntilDecay: Math.max(0, season.decayDays - daysSinceActivity),
      decayAmount: season.decayAmount,
      isProtected: playerData.isDecayProtected,
      protectionExpiresAt: undefined,
    };
  }

  public async getSeasonalTierDistribution(seasonId?: string): Promise<Record<RankTier, number>> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const entries = this.sortedSeasonalEntries.get(id) || [];
    const distribution: Record<RankTier, number> = {} as Record<RankTier, number>;

    for (const tier of Object.values(RankTier)) {
      distribution[tier] = entries.filter((e) => {
        const playerData = this.seasonalData.get(id)?.get(e.playerId);
        return playerData?.isPlacementComplete && e.tier === tier;
      }).length;
    }

    return distribution;
  }

  public async getPlacementStatus(
    playerId: string,
    seasonId?: string
  ): Promise<{ matchesPlayed: number; matchesRequired: number; matchesWon: number; isComplete: boolean }> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const season = this.seasons.get(id);
    if (!season) {
      throw new SeasonNotFoundError(id);
    }

    const playerData = this.seasonalData.get(id)?.get(playerId);
    if (!playerData) {
      return {
        matchesPlayed: 0,
        matchesRequired: season.placementMatchesRequired,
        matchesWon: 0,
        isComplete: false,
      };
    }

    return {
      matchesPlayed: playerData.placementMatchesPlayed,
      matchesRequired: season.placementMatchesRequired,
      matchesWon: playerData.placementMatchesWon,
      isComplete: playerData.isPlacementComplete,
    };
  }

  public async getSeasonalLeaderboardByTier(
    tier: RankTier,
    seasonId?: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const entries = this.sortedSeasonalEntries.get(id) || [];
    const tierEntries = entries.filter((e) => {
      const playerData = this.seasonalData.get(id)?.get(e.playerId);
      return playerData?.isPlacementComplete && e.tier === tier;
    });

    const offset = (page - 1) * limit;
    const paginatedEntries = tierEntries.slice(offset, offset + limit);
    const total = tierEntries.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data: paginatedEntries,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  public async getPlayerSeasonalProgression(
    playerId: string,
    seasonId?: string
  ): Promise<{ rank: number; tier: RankTier; mmr: number; timestamp: Date }[]> {
    const id = seasonId || this.activeSeasonId;
    if (!id) {
      throw new SeasonNotFoundError('active');
    }

    const playerData = this.seasonalData.get(id)?.get(playerId);
    if (!playerData) {
      return [];
    }

    return [{
      rank: playerData.entry.rank,
      tier: playerData.entry.tier,
      mmr: playerData.entry.mmr,
      timestamp: playerData.entry.updatedAt,
    }];
  }

  private resortSeasonalLeaderboard(seasonId: string): void {
    const dataMap = this.seasonalData.get(seasonId);
    if (!dataMap) return;

    const entries = Array.from(dataMap.values())
      .filter((d) => d.isPlacementComplete)
      .map((d) => d.entry)
      .sort((a, b) => {
        if (b.mmr !== a.mmr) return b.mmr - a.mmr;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    this.sortedSeasonalEntries.set(seasonId, entries);
  }

  private async invalidateSeasonalCache(seasonId: string, playerId: string): Promise<void> {
    await cacheService.deletePattern(`seasonal:${seasonId}:*`);
    await cacheService.delete(CACHE_KEYS.PLAYER_SEASONAL_RANK(playerId, seasonId));
  }

  private calculateTier(mmr: number): RankTier {
    if (mmr >= 3000) return RankTier.LEGEND;
    if (mmr >= 2700) return RankTier.CHALLENGER;
    if (mmr >= 2400) return RankTier.GRANDMASTER;
    if (mmr >= 2100) return RankTier.MASTER;
    if (mmr >= 1800) return RankTier.DIAMOND;
    if (mmr >= 1500) return RankTier.PLATINUM;
    if (mmr >= 1200) return RankTier.GOLD;
    if (mmr >= 900) return RankTier.SILVER;
    if (mmr >= 600) return RankTier.BRONZE;
    return RankTier.UNRANKED;
  }

  private calculateDivision(mmr: number, tier: RankTier): TierDivision | undefined {
    if ([RankTier.LEGEND, RankTier.CHALLENGER, RankTier.GRANDMASTER, RankTier.MASTER, RankTier.UNRANKED].includes(tier)) {
      return undefined;
    }

    const tierRanges: Record<string, { min: number; max: number }> = {
      [RankTier.DIAMOND]: { min: 1800, max: 2100 },
      [RankTier.PLATINUM]: { min: 1500, max: 1800 },
      [RankTier.GOLD]: { min: 1200, max: 1500 },
      [RankTier.SILVER]: { min: 900, max: 1200 },
      [RankTier.BRONZE]: { min: 600, max: 900 },
    };

    const range = tierRanges[tier];
    if (!range) return undefined;

    const tierRange = range.max - range.min;
    const divisionSize = tierRange / 4;
    const positionInTier = mmr - range.min;

    if (positionInTier >= divisionSize * 3) return TierDivision.I;
    if (positionInTier >= divisionSize * 2) return TierDivision.II;
    if (positionInTier >= divisionSize) return TierDivision.III;
    return TierDivision.IV;
  }

  private getTierOrder(tier: RankTier): number {
    const order: Record<RankTier, number> = {
      [RankTier.UNRANKED]: 0,
      [RankTier.BRONZE]: 1,
      [RankTier.SILVER]: 2,
      [RankTier.GOLD]: 3,
      [RankTier.PLATINUM]: 4,
      [RankTier.DIAMOND]: 5,
      [RankTier.MASTER]: 6,
      [RankTier.GRANDMASTER]: 7,
      [RankTier.CHALLENGER]: 8,
      [RankTier.LEGEND]: 9,
    };
    return order[tier] || 0;
  }

  private calculateRanksToNextTier(currentMMR: number, currentTier: RankTier): number {
    const tierThresholds: Record<RankTier, number> = {
      [RankTier.UNRANKED]: 600,
      [RankTier.BRONZE]: 900,
      [RankTier.SILVER]: 1200,
      [RankTier.GOLD]: 1500,
      [RankTier.PLATINUM]: 1800,
      [RankTier.DIAMOND]: 2100,
      [RankTier.MASTER]: 2400,
      [RankTier.GRANDMASTER]: 2700,
      [RankTier.CHALLENGER]: 3000,
      [RankTier.LEGEND]: 9999,
    };

    const nextTierMMR = tierThresholds[currentTier];
    return Math.max(0, nextTierMMR - currentMMR);
  }
}

export const seasonalRankingService = new SeasonalRankingService();
export default seasonalRankingService;
