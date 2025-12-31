import { v4 as uuidv4 } from 'uuid';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger, EventType } from '../utils/logger';
import {
  LeaderboardNotFoundError,
  LeaderboardEntryNotFoundError,
  LeaderboardInactiveError,
  LeaderboardFullError,
  InvalidPaginationError,
} from '../utils/errors';
import {
  LeaderboardEntry,
  Leaderboard,
  LeaderboardQuery,
  LeaderboardType,
  RankingPeriod,
  RankTier,
  TierDivision,
  Region,
  SortField,
  SortOrder,
  PaginatedResponse,
  LeaderboardStatistics,
  PlayerContext,
} from '../types';
import { config } from '../config';

interface InMemoryLeaderboard {
  leaderboard: Leaderboard;
  entries: Map<string, LeaderboardEntry>;
  sortedEntries: LeaderboardEntry[];
}

class LeaderboardService {
  private leaderboards: Map<string, InMemoryLeaderboard> = new Map();
  private globalLeaderboardId: string | null = null;

  constructor() {
    this.initializeDefaultLeaderboards();
  }

  private initializeDefaultLeaderboards(): void {
    const globalLeaderboard = this.createLeaderboardInternal({
      name: 'Global Leaderboard',
      type: LeaderboardType.GLOBAL,
      period: RankingPeriod.ALL_TIME,
      isActive: true,
      isPublic: true,
    });
    this.globalLeaderboardId = globalLeaderboard.id;

    logger.info(EventType.LEADERBOARD_CREATED, 'Default leaderboards initialized');
  }

  private createLeaderboardInternal(data: Partial<Leaderboard>): Leaderboard {
    const now = new Date();
    const leaderboard: Leaderboard = {
      id: uuidv4(),
      name: data.name || 'Unnamed Leaderboard',
      description: data.description,
      type: data.type || LeaderboardType.GLOBAL,
      period: data.period || RankingPeriod.ALL_TIME,
      gameId: data.gameId,
      seasonId: data.seasonId,
      region: data.region,
      gameMode: data.gameMode,
      isActive: data.isActive ?? true,
      isPublic: data.isPublic ?? true,
      maxEntries: data.maxEntries || config.MAX_LEADERBOARD_ENTRIES,
      resetSchedule: data.resetSchedule,
      lastResetAt: data.lastResetAt,
      nextResetAt: data.nextResetAt,
      metadata: data.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.leaderboards.set(leaderboard.id, {
      leaderboard,
      entries: new Map(),
      sortedEntries: [],
    });

    return leaderboard;
  }

  public async createLeaderboard(data: Partial<Leaderboard>): Promise<Leaderboard> {
    const leaderboard = this.createLeaderboardInternal(data);
    logger.logLeaderboardCreated(leaderboard.id, leaderboard.name);
    return leaderboard;
  }

  public async getLeaderboard(leaderboardId: string): Promise<Leaderboard> {
    const data = this.leaderboards.get(leaderboardId);
    if (!data) {
      throw new LeaderboardNotFoundError(leaderboardId);
    }
    return data.leaderboard;
  }

  public async getLeaderboardEntries(
    query: LeaderboardQuery
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    const startTime = Date.now();
    const leaderboardId = query.leaderboardId || this.globalLeaderboardId;

    if (!leaderboardId) {
      throw new LeaderboardNotFoundError('default');
    }

    const cacheKey = CACHE_KEYS.LEADERBOARD(leaderboardId, query.page || 1);
    const cached = await cacheService.get<PaginatedResponse<LeaderboardEntry>>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = this.leaderboards.get(leaderboardId);
    if (!data) {
      throw new LeaderboardNotFoundError(leaderboardId);
    }

    if (!data.leaderboard.isActive) {
      throw new LeaderboardInactiveError(leaderboardId);
    }

    const page = query.page || 1;
    const limit = Math.min(query.limit || config.DEFAULT_PAGE_SIZE, config.MAX_PAGE_SIZE);
    const offset = query.offset ?? (page - 1) * limit;

    if (page < 1 || limit < 1) {
      throw new InvalidPaginationError('Page and limit must be positive integers');
    }

    let entries = [...data.sortedEntries];

    if (query.tier) {
      entries = entries.filter((e) => e.tier === query.tier);
    }
    if (query.region) {
      entries = entries.filter((e) => e.region === query.region);
    }
    if (query.gameMode) {
      entries = entries.filter((e) => e.gameId === query.gameId);
    }
    if (query.minScore !== undefined) {
      entries = entries.filter((e) => e.score >= query.minScore!);
    }
    if (query.maxScore !== undefined) {
      entries = entries.filter((e) => e.score <= query.maxScore!);
    }
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      entries = entries.filter((e) => e.playerName.toLowerCase().includes(searchLower));
    }

    entries = this.sortEntries(entries, query.sortBy || SortField.RANK, query.sortOrder || SortOrder.ASC);

    const total = entries.length;
    const paginatedEntries = entries.slice(offset, offset + limit);
    const totalPages = Math.ceil(total / limit);

    const result: PaginatedResponse<LeaderboardEntry> = {
      data: paginatedEntries,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };

    const duration = Date.now() - startTime;
    if (duration > config.QUERY_TIMEOUT_MS) {
      logger.warn(EventType.QUERY_SLOW, `Leaderboard query took ${duration}ms`, { leaderboardId, duration });
    }

    await cacheService.set(cacheKey, result, CACHE_TTL.LEADERBOARD);
    logger.logQueryExecuted('getLeaderboardEntries', duration, { leaderboardId });

    return result;
  }

  public async getTop100(leaderboardId?: string): Promise<LeaderboardEntry[]> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const cached = await cacheService.getTop100(id);
    if (cached) {
      return cached as LeaderboardEntry[];
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const top100 = data.sortedEntries.slice(0, 100);
    await cacheService.setTop100(id, top100);

    return top100;
  }

  public async getPlayerRank(
    playerId: string,
    leaderboardId?: string
  ): Promise<LeaderboardEntry | null> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const cacheKey = CACHE_KEYS.PLAYER_RANK(playerId, id);
    const cached = await cacheService.get<LeaderboardEntry>(cacheKey);
    if (cached) {
      return cached;
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const entry = data.entries.get(playerId);
    if (!entry) {
      return null;
    }

    await cacheService.set(cacheKey, entry, CACHE_TTL.PLAYER_RANK);
    return entry;
  }

  public async getPlayerContext(
    playerId: string,
    leaderboardId?: string,
    contextSize = 5
  ): Promise<PlayerContext> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const entry = data.entries.get(playerId);
    if (!entry) {
      throw new LeaderboardEntryNotFoundError(playerId, id);
    }

    const playerIndex = data.sortedEntries.findIndex((e) => e.playerId === playerId);
    const startIndex = Math.max(0, playerIndex - contextSize);
    const endIndex = Math.min(data.sortedEntries.length, playerIndex + contextSize + 1);

    const above = data.sortedEntries.slice(startIndex, playerIndex);
    const below = data.sortedEntries.slice(playerIndex + 1, endIndex);

    const totalPlayers = data.sortedEntries.length;
    const percentile = totalPlayers > 0 ? ((totalPlayers - entry.rank) / totalPlayers) * 100 : 0;

    return {
      player: entry,
      above,
      below,
      totalPlayers,
      percentile: Math.round(percentile * 100) / 100,
    };
  }

  public async updateOrCreateEntry(
    playerId: string,
    playerName: string,
    score: number,
    leaderboardId?: string,
    additionalData?: Partial<LeaderboardEntry>
  ): Promise<LeaderboardEntry> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    if (!data.leaderboard.isActive) {
      throw new LeaderboardInactiveError(id);
    }

    const now = new Date();
    let entry = data.entries.get(playerId);
    const previousRank = entry?.rank;

    if (entry) {
      entry.previousRank = entry.rank;
      entry.score = score;
      entry.rankChange = previousRank ? previousRank - entry.rank : 0;
      entry.updatedAt = now;
      entry.lastActiveAt = now;

      if (additionalData) {
        Object.assign(entry, additionalData);
      }

      this.recalculateStats(entry);
    } else {
      if (data.entries.size >= data.leaderboard.maxEntries) {
        throw new LeaderboardFullError(id);
      }

      entry = {
        id: uuidv4(),
        leaderboardId: id,
        playerId,
        playerName,
        playerAvatar: additionalData?.playerAvatar,
        rank: data.sortedEntries.length + 1,
        previousRank: undefined,
        rankChange: undefined,
        score,
        tier: additionalData?.tier || RankTier.UNRANKED,
        division: additionalData?.division,
        mmr: additionalData?.mmr || 1000,
        wins: additionalData?.wins || 0,
        losses: additionalData?.losses || 0,
        draws: additionalData?.draws || 0,
        winRate: 0,
        gamesPlayed: additionalData?.gamesPlayed || 0,
        winStreak: additionalData?.winStreak || 0,
        bestWinStreak: additionalData?.bestWinStreak || 0,
        region: additionalData?.region,
        gameId: additionalData?.gameId,
        seasonId: additionalData?.seasonId,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
      };

      this.recalculateStats(entry);
      data.entries.set(playerId, entry);
    }

    this.resortLeaderboard(id);

    await cacheService.invalidateLeaderboard(id);
    await cacheService.invalidatePlayerRanks(playerId);

    logger.logScoreSubmitted(playerId, id, score, { leaderboardId: id });

    if (previousRank && entry.rank !== previousRank) {
      logger.logRankChange(playerId, id, previousRank, entry.rank);
    }

    return entry;
  }

  public async removeEntry(playerId: string, leaderboardId?: string): Promise<boolean> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const deleted = data.entries.delete(playerId);
    if (deleted) {
      this.resortLeaderboard(id);
      await cacheService.invalidateLeaderboard(id);
      await cacheService.invalidatePlayerRanks(playerId);
    }

    return deleted;
  }

  public async getLeaderboardStatistics(leaderboardId?: string): Promise<LeaderboardStatistics> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const cached = await cacheService.getLeaderboardStats(id);
    if (cached) {
      return cached as LeaderboardStatistics;
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const entries = data.sortedEntries;
    const scores = entries.map((e) => e.score);
    const mmrs = entries.map((e) => e.mmr);

    const tierDistribution: Record<RankTier, number> = {} as Record<RankTier, number>;
    const regionDistribution: Record<Region, number> = {} as Record<Region, number>;

    for (const tier of Object.values(RankTier)) {
      tierDistribution[tier] = entries.filter((e) => e.tier === tier).length;
    }

    for (const region of Object.values(Region)) {
      regionDistribution[region] = entries.filter((e) => e.region === region).length;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const activePlayers = entries.filter((e) => e.lastActiveAt >= oneDayAgo).length;

    const stats: LeaderboardStatistics = {
      leaderboardId: id,
      totalPlayers: entries.length,
      activePlayers,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      medianScore: this.calculateMedian(scores),
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      averageMMR: mmrs.length > 0 ? mmrs.reduce((a, b) => a + b, 0) / mmrs.length : 0,
      tierDistribution,
      regionDistribution,
      lastUpdatedAt: now,
    };

    await cacheService.setLeaderboardStats(id, stats);
    return stats;
  }

  public async resetLeaderboard(leaderboardId: string): Promise<void> {
    const data = this.leaderboards.get(leaderboardId);
    if (!data) {
      throw new LeaderboardNotFoundError(leaderboardId);
    }

    const entriesCount = data.entries.size;
    data.entries.clear();
    data.sortedEntries = [];
    data.leaderboard.lastResetAt = new Date();
    data.leaderboard.updatedAt = new Date();

    await cacheService.invalidateLeaderboard(leaderboardId);
    logger.logLeaderboardReset(leaderboardId, entriesCount);
  }

  public async searchPlayers(
    query: string,
    leaderboardId?: string,
    limit = 20
  ): Promise<LeaderboardEntry[]> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const searchLower = query.toLowerCase();
    return data.sortedEntries
      .filter((e) => e.playerName.toLowerCase().includes(searchLower))
      .slice(0, limit);
  }

  public async getEntriesByTier(
    tier: RankTier,
    leaderboardId?: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const tierEntries = data.sortedEntries.filter((e) => e.tier === tier);
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

  public async getEntriesByRegion(
    region: Region,
    leaderboardId?: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    const id = leaderboardId || this.globalLeaderboardId;
    if (!id) {
      throw new LeaderboardNotFoundError('default');
    }

    const data = this.leaderboards.get(id);
    if (!data) {
      throw new LeaderboardNotFoundError(id);
    }

    const regionEntries = data.sortedEntries.filter((e) => e.region === region);
    const offset = (page - 1) * limit;
    const paginatedEntries = regionEntries.slice(offset, offset + limit);
    const total = regionEntries.length;
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

  public getGlobalLeaderboardId(): string | null {
    return this.globalLeaderboardId;
  }

  public async getAllLeaderboards(): Promise<Leaderboard[]> {
    return Array.from(this.leaderboards.values()).map((d) => d.leaderboard);
  }

  private sortEntries(
    entries: LeaderboardEntry[],
    sortBy: SortField,
    sortOrder: SortOrder
  ): LeaderboardEntry[] {
    const multiplier = sortOrder === SortOrder.ASC ? 1 : -1;

    return entries.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case SortField.RANK:
          comparison = a.rank - b.rank;
          break;
        case SortField.SCORE:
          comparison = b.score - a.score;
          break;
        case SortField.WINS:
          comparison = b.wins - a.wins;
          break;
        case SortField.WIN_RATE:
          comparison = b.winRate - a.winRate;
          break;
        case SortField.MMR:
          comparison = b.mmr - a.mmr;
          break;
        case SortField.GAMES_PLAYED:
          comparison = b.gamesPlayed - a.gamesPlayed;
          break;
        case SortField.LAST_ACTIVE:
          comparison = b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
          break;
        default:
          comparison = a.rank - b.rank;
      }
      return comparison * multiplier;
    });
  }

  private resortLeaderboard(leaderboardId: string): void {
    const data = this.leaderboards.get(leaderboardId);
    if (!data) return;

    data.sortedEntries = Array.from(data.entries.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.mmr !== a.mmr) return b.mmr - a.mmr;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    data.sortedEntries.forEach((entry, index) => {
      const newRank = index + 1;
      if (entry.rank !== newRank) {
        entry.previousRank = entry.rank;
        entry.rankChange = entry.rank - newRank;
        entry.rank = newRank;
      }
    });
  }

  private recalculateStats(entry: LeaderboardEntry): void {
    entry.gamesPlayed = entry.wins + entry.losses + entry.draws;
    entry.winRate = entry.gamesPlayed > 0
      ? Math.round((entry.wins / entry.gamesPlayed) * 10000) / 100
      : 0;
    entry.tier = this.calculateTier(entry.mmr);
    entry.division = this.calculateDivision(entry.mmr, entry.tier);
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

    const tierRanges: Record<RankTier, { min: number; max: number }> = {
      [RankTier.DIAMOND]: { min: 1800, max: 2100 },
      [RankTier.PLATINUM]: { min: 1500, max: 1800 },
      [RankTier.GOLD]: { min: 1200, max: 1500 },
      [RankTier.SILVER]: { min: 900, max: 1200 },
      [RankTier.BRONZE]: { min: 600, max: 900 },
      [RankTier.UNRANKED]: { min: 0, max: 600 },
      [RankTier.LEGEND]: { min: 3000, max: 9999 },
      [RankTier.CHALLENGER]: { min: 2700, max: 3000 },
      [RankTier.GRANDMASTER]: { min: 2400, max: 2700 },
      [RankTier.MASTER]: { min: 2100, max: 2400 },
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

  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
}

export const leaderboardService = new LeaderboardService();
export default leaderboardService;
