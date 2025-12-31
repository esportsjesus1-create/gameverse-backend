import { v4 as uuidv4 } from 'uuid';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import {
  LeaderboardNotFoundError,
  RegionNotSupportedError,
  RegionMismatchError,
} from '../utils/errors';
import {
  LeaderboardEntry,
  RankTier,
  TierDivision,
  Region,
  PaginatedResponse,
} from '../types';

interface RegionalLeaderboard {
  region: Region;
  entries: Map<string, LeaderboardEntry>;
  sortedEntries: LeaderboardEntry[];
  statistics: RegionalStatistics;
}

interface RegionalStatistics {
  region: Region;
  totalPlayers: number;
  activePlayers: number;
  averageMMR: number;
  averageScore: number;
  tierDistribution: Record<RankTier, number>;
  lastUpdatedAt: Date;
}

interface CrossRegionComparison {
  playerId: string;
  playerName: string;
  homeRegion: Region;
  homeRegionRank: number;
  globalRank: number;
  regionalRanks: Record<Region, number | null>;
  percentileByRegion: Record<Region, number | null>;
}

class RegionalRankingService {
  private regionalLeaderboards: Map<Region, RegionalLeaderboard> = new Map();
  private supportedRegions: Region[] = [
    Region.NA,
    Region.EU,
    Region.ASIA,
    Region.OCE,
    Region.SA,
    Region.MENA,
    Region.SEA,
    Region.JP,
    Region.KR,
    Region.CN,
  ];

  constructor() {
    this.initializeRegionalLeaderboards();
  }

  private initializeRegionalLeaderboards(): void {
    for (const region of this.supportedRegions) {
      this.regionalLeaderboards.set(region, {
        region,
        entries: new Map(),
        sortedEntries: [],
        statistics: {
          region,
          totalPlayers: 0,
          activePlayers: 0,
          averageMMR: 0,
          averageScore: 0,
          tierDistribution: this.initializeTierDistribution(),
          lastUpdatedAt: new Date(),
        },
      });
    }
    logger.info(EventType.LEADERBOARD_CREATED, `Regional leaderboards initialized for ${this.supportedRegions.length} regions`);
  }

  private initializeTierDistribution(): Record<RankTier, number> {
    const distribution: Record<RankTier, number> = {} as Record<RankTier, number>;
    for (const tier of Object.values(RankTier)) {
      distribution[tier] = 0;
    }
    return distribution;
  }

  public getSupportedRegions(): Region[] {
    return [...this.supportedRegions];
  }

  public isRegionSupported(region: Region): boolean {
    return this.supportedRegions.includes(region);
  }

  public async getRegionalLeaderboard(
    region: Region,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const cacheKey = `regional:${region}:page:${page}`;
    const cached = await cacheService.get<PaginatedResponse<LeaderboardEntry>>(cacheKey);
    if (cached) return cached;

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    const entries = leaderboard.sortedEntries;
    const offset = (page - 1) * limit;
    const paginatedEntries = entries.slice(offset, offset + limit);
    const total = entries.length;
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

  public async getPlayerRegionalRank(
    playerId: string,
    region: Region
  ): Promise<LeaderboardEntry | null> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const cacheKey = CACHE_KEYS.PLAYER_REGIONAL_RANK(playerId, region);
    const cached = await cacheService.get<LeaderboardEntry>(cacheKey);
    if (cached) return cached;

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    const entry = leaderboard.entries.get(playerId);
    if (entry) {
      await cacheService.set(cacheKey, entry, CACHE_TTL.PLAYER_RANK);
    }
    return entry || null;
  }

  public async updateRegionalRank(
    playerId: string,
    playerName: string,
    region: Region,
    score: number,
    mmr: number,
    additionalData?: Partial<LeaderboardEntry>
  ): Promise<LeaderboardEntry> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    const now = new Date();
    let entry = leaderboard.entries.get(playerId);

    if (entry) {
      if (entry.region && entry.region !== region) {
        throw new RegionMismatchError(entry.region, region);
      }

      entry.previousRank = entry.rank;
      entry.score = score;
      entry.mmr = mmr;
      entry.tier = this.calculateTier(mmr);
      entry.division = this.calculateDivision(mmr, entry.tier);
      entry.lastActiveAt = now;
      entry.updatedAt = now;

      if (additionalData) {
        if (additionalData.wins !== undefined) entry.wins = additionalData.wins;
        if (additionalData.losses !== undefined) entry.losses = additionalData.losses;
        if (additionalData.draws !== undefined) entry.draws = additionalData.draws;
        entry.gamesPlayed = entry.wins + entry.losses + entry.draws;
        entry.winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 10000) / 100 : 0;
        if (additionalData.winStreak !== undefined) entry.winStreak = additionalData.winStreak;
        if (additionalData.bestWinStreak !== undefined) entry.bestWinStreak = additionalData.bestWinStreak;
      }
    } else {
      entry = {
        id: uuidv4(),
        leaderboardId: `regional:${region}`,
        playerId,
        playerName,
        playerAvatar: additionalData?.playerAvatar,
        rank: leaderboard.sortedEntries.length + 1,
        score,
        tier: this.calculateTier(mmr),
        division: undefined,
        mmr,
        wins: additionalData?.wins || 0,
        losses: additionalData?.losses || 0,
        draws: additionalData?.draws || 0,
        winRate: 0,
        gamesPlayed: 0,
        winStreak: additionalData?.winStreak || 0,
        bestWinStreak: additionalData?.bestWinStreak || 0,
        region,
        gameId: additionalData?.gameId,
        seasonId: additionalData?.seasonId,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      };

      entry.gamesPlayed = entry.wins + entry.losses + entry.draws;
      entry.winRate = entry.gamesPlayed > 0 ? Math.round((entry.wins / entry.gamesPlayed) * 10000) / 100 : 0;
      entry.division = this.calculateDivision(mmr, entry.tier);

      leaderboard.entries.set(playerId, entry);
    }

    this.resortRegionalLeaderboard(region);
    this.updateRegionalStatistics(region);
    await this.invalidateRegionalCache(region, playerId);

    return entry;
  }

  public async getRegionalStatistics(region: Region): Promise<RegionalStatistics> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    return leaderboard.statistics;
  }

  public async getAllRegionalStatistics(): Promise<RegionalStatistics[]> {
    return Array.from(this.regionalLeaderboards.values()).map((lb) => lb.statistics);
  }

  public async getCrossRegionComparison(playerId: string): Promise<CrossRegionComparison | null> {
    let homeRegion: Region | null = null;
    let homeEntry: LeaderboardEntry | null = null;

    for (const [region, leaderboard] of this.regionalLeaderboards) {
      const entry = leaderboard.entries.get(playerId);
      if (entry) {
        homeRegion = region;
        homeEntry = entry;
        break;
      }
    }

    if (!homeRegion || !homeEntry) {
      return null;
    }

    const regionalRanks: Record<Region, number | null> = {} as Record<Region, number | null>;
    const percentileByRegion: Record<Region, number | null> = {} as Record<Region, number | null>;

    for (const region of this.supportedRegions) {
      const leaderboard = this.regionalLeaderboards.get(region);
      if (!leaderboard) {
        regionalRanks[region] = null;
        percentileByRegion[region] = null;
        continue;
      }

      if (region === homeRegion) {
        regionalRanks[region] = homeEntry.rank;
        percentileByRegion[region] = leaderboard.sortedEntries.length > 0
          ? Math.round(((leaderboard.sortedEntries.length - homeEntry.rank) / leaderboard.sortedEntries.length) * 10000) / 100
          : 0;
      } else {
        const hypotheticalRank = this.calculateHypotheticalRank(homeEntry.mmr, leaderboard.sortedEntries);
        regionalRanks[region] = hypotheticalRank;
        percentileByRegion[region] = leaderboard.sortedEntries.length > 0
          ? Math.round(((leaderboard.sortedEntries.length - hypotheticalRank) / leaderboard.sortedEntries.length) * 10000) / 100
          : 0;
      }
    }

    let globalRank = 0;
    let totalPlayersAcrossRegions = 0;
    for (const leaderboard of this.regionalLeaderboards.values()) {
      const betterPlayers = leaderboard.sortedEntries.filter((e) => e.mmr > homeEntry.mmr).length;
      globalRank += betterPlayers;
      totalPlayersAcrossRegions += leaderboard.sortedEntries.length;
    }
    globalRank += 1;

    return {
      playerId,
      playerName: homeEntry.playerName,
      homeRegion,
      homeRegionRank: homeEntry.rank,
      globalRank,
      regionalRanks,
      percentileByRegion,
    };
  }

  public async getRegionalTopPerformers(
    region: Region,
    limit = 10
  ): Promise<LeaderboardEntry[]> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    return leaderboard.sortedEntries.slice(0, limit);
  }

  public async getRegionalLeaderboardByTier(
    region: Region,
    tier: RankTier,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    const tierEntries = leaderboard.sortedEntries.filter((e) => e.tier === tier);
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

  public async getRegionalTierDistribution(region: Region): Promise<Record<RankTier, number>> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    return leaderboard.statistics.tierDistribution;
  }

  public async searchPlayersInRegion(
    region: Region,
    query: string,
    limit = 20
  ): Promise<LeaderboardEntry[]> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    const searchLower = query.toLowerCase();
    return leaderboard.sortedEntries
      .filter((e) => e.playerName.toLowerCase().includes(searchLower))
      .slice(0, limit);
  }

  public async removePlayerFromRegion(playerId: string, region: Region): Promise<boolean> {
    if (!this.isRegionSupported(region)) {
      throw new RegionNotSupportedError(region);
    }

    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) {
      throw new LeaderboardNotFoundError(`regional:${region}`);
    }

    const deleted = leaderboard.entries.delete(playerId);
    if (deleted) {
      this.resortRegionalLeaderboard(region);
      this.updateRegionalStatistics(region);
      await this.invalidateRegionalCache(region, playerId);
    }

    return deleted;
  }

  private resortRegionalLeaderboard(region: Region): void {
    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) return;

    leaderboard.sortedEntries = Array.from(leaderboard.entries.values()).sort((a, b) => {
      if (b.mmr !== a.mmr) return b.mmr - a.mmr;
      if (b.score !== a.score) return b.score - a.score;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    leaderboard.sortedEntries.forEach((entry, index) => {
      const newRank = index + 1;
      if (entry.rank !== newRank) {
        entry.previousRank = entry.rank;
        entry.rankChange = entry.rank - newRank;
        entry.rank = newRank;
      }
    });
  }

  private updateRegionalStatistics(region: Region): void {
    const leaderboard = this.regionalLeaderboards.get(region);
    if (!leaderboard) return;

    const entries = leaderboard.sortedEntries;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const tierDistribution = this.initializeTierDistribution();
    let totalMMR = 0;
    let totalScore = 0;
    let activePlayers = 0;

    for (const entry of entries) {
      tierDistribution[entry.tier]++;
      totalMMR += entry.mmr;
      totalScore += entry.score;
      if (entry.lastActiveAt >= oneDayAgo) {
        activePlayers++;
      }
    }

    leaderboard.statistics = {
      region,
      totalPlayers: entries.length,
      activePlayers,
      averageMMR: entries.length > 0 ? Math.round(totalMMR / entries.length) : 0,
      averageScore: entries.length > 0 ? Math.round(totalScore / entries.length) : 0,
      tierDistribution,
      lastUpdatedAt: now,
    };
  }

  private calculateHypotheticalRank(mmr: number, sortedEntries: LeaderboardEntry[]): number {
    let rank = 1;
    for (const entry of sortedEntries) {
      if (entry.mmr > mmr) {
        rank++;
      } else {
        break;
      }
    }
    return rank;
  }

  private async invalidateRegionalCache(region: Region, playerId: string): Promise<void> {
    await cacheService.deletePattern(`regional:${region}:*`);
    await cacheService.delete(CACHE_KEYS.PLAYER_REGIONAL_RANK(playerId, region));
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
}

export const regionalRankingService = new RegionalRankingService();
export default regionalRankingService;
