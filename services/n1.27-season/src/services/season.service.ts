import { PrismaClient, RankedTier as PrismaRankedTier, SeasonState as PrismaSeasonState, SeasonType as PrismaSeasonType, ResetType as PrismaResetType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { getRedisClient, CACHE_KEYS, CACHE_TTL } from '../config/redis';
import { logger } from '../utils/logger';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';
import { mmrService } from './mmr.service';
import { tierService } from './tier.service';
import {
  Season,
  PlayerSeason,
  MatchResult,
  CreateSeasonDTO,
  UpdateMMRDTO,
  LeaderboardEntry,
  SeasonResetResult,
  PaginatedResponse,
  RankedTier,
  TierDivision,
  PlayerRank,
  SeasonState,
  SeasonType,
  ResetType,
  SeasonMetadata,
  SeasonTemplate,
  SeasonPreview,
  CreateSeasonMetadataDTO,
  CreateSeasonTemplateDTO,
  LocalizedContent,
} from '../types';

export class SeasonService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private mapPrismaTier(tier: PrismaRankedTier): RankedTier {
    return tier as RankedTier;
  }

  private mapToRankedTier(tier: RankedTier): PrismaRankedTier {
    return tier as PrismaRankedTier;
  }

  public async createSeason(data: CreateSeasonDTO): Promise<Season> {
    const existingSeason = await this.prisma.season.findUnique({
      where: { number: data.number },
    });

    if (existingSeason) {
      throw new ConflictError(`Season ${data.number} already exists`);
    }

    const activeSeason = await this.prisma.season.findFirst({
      where: { isActive: true },
    });

    if (activeSeason) {
      throw new ConflictError('An active season already exists. End it before creating a new one.');
    }

    const season = await this.prisma.season.create({
      data: {
        id: uuidv4(),
        name: data.name,
        number: data.number,
        startDate: data.startDate,
        isActive: true,
        softResetFactor: data.softResetFactor ?? config.SOFT_RESET_FACTOR,
        placementMatchesRequired: data.placementMatchesRequired ?? config.PLACEMENT_MATCHES_REQUIRED,
      },
    });

    await this.cacheActiveSeason(season as Season);

    logger.info(`Created season ${season.number}: ${season.name}`);
    return season as Season;
  }

  public async getActiveSeason(): Promise<Season | null> {
    const cached = await this.getCachedActiveSeason();
    if (cached) {
      return cached;
    }

    const season = await this.prisma.season.findFirst({
      where: { isActive: true },
    });

    if (season) {
      await this.cacheActiveSeason(season as Season);
    }

    return season as Season | null;
  }

  public async getSeasonById(seasonId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    return season as Season;
  }

  public async getSeasonByNumber(number: number): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { number },
    });

    if (!season) {
      throw new NotFoundError(`Season ${number} not found`);
    }

    return season as Season;
  }

  public async endSeason(seasonId: string): Promise<Season> {
    const season = await this.getSeasonById(seasonId);

    if (!season.isActive) {
      throw new BadRequestError('Season is already ended');
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        isActive: false,
        endDate: new Date(),
      },
    });

    await this.archiveSeasonData(seasonId);
    await this.invalidateActiveSeasonCache();

    logger.info(`Ended season ${season.number}: ${season.name}`);
    return updatedSeason as Season;
  }

  public async getOrCreatePlayerSeason(
    playerId: string,
    seasonId: string
  ): Promise<PlayerSeason> {
    let playerSeason = await this.prisma.playerSeason.findUnique({
      where: {
        playerId_seasonId: { playerId, seasonId },
      },
    });

    if (!playerSeason) {
      const previousSeason = await this.getPlayerPreviousSeasonData(playerId);
      const initialMmr = previousSeason
        ? mmrService.calculateSoftReset({
            currentMmr: previousSeason.mmr,
            baseMmr: config.DEFAULT_MMR,
            resetFactor: config.SOFT_RESET_FACTOR,
          })
        : config.DEFAULT_MMR;

      const { tier, division } = tierService.getTierFromMMR(initialMmr);

      playerSeason = await this.prisma.playerSeason.create({
        data: {
          id: uuidv4(),
          playerId,
          seasonId,
          mmr: initialMmr,
          peakMmr: initialMmr,
          tier: this.mapToRankedTier(tier),
          division,
          leaguePoints: tierService.calculateLeaguePoints(initialMmr, tier, division),
        },
      });

      logger.info(`Created player season for ${playerId} with initial MMR ${initialMmr}`);
    }

    return {
      ...playerSeason,
      tier: this.mapPrismaTier(playerSeason.tier),
      division: playerSeason.division as TierDivision | null,
    } as PlayerSeason;
  }

  public async getPlayerRank(playerId: string, seasonId: string): Promise<PlayerRank> {
    const cached = await tierService.getCachedPlayerRank(playerId, seasonId);
    if (cached) {
      return cached;
    }

    const playerSeason = await this.getOrCreatePlayerSeason(playerId, seasonId);

    const rank: PlayerRank = {
      tier: playerSeason.tier,
      division: playerSeason.division,
      mmr: playerSeason.mmr,
      leaguePoints: playerSeason.leaguePoints,
      wins: playerSeason.wins,
      losses: playerSeason.losses,
      winStreak: playerSeason.winStreak,
      lossStreak: playerSeason.lossStreak,
      isInPromos: playerSeason.isInPromos,
      promoWins: playerSeason.promoWins,
      promoLosses: playerSeason.promoLosses,
    };

    await tierService.cachePlayerRank(playerId, seasonId, rank);
    return rank;
  }

  public async updateMMR(data: UpdateMMRDTO): Promise<{
    player: PlayerSeason;
    opponent: PlayerSeason;
    matchResult: MatchResult;
  }> {
    const activeSeason = await this.getActiveSeason();
    if (!activeSeason) {
      throw new BadRequestError('No active season');
    }

    const [playerSeason, opponentSeason] = await Promise.all([
      this.getOrCreatePlayerSeason(data.playerId, activeSeason.id),
      this.getOrCreatePlayerSeason(data.opponentId, activeSeason.id),
    ]);

    const isPlacementMatch = !playerSeason.isPlacementComplete;

    const playerResult = mmrService.calculateMMRChange({
      playerMmr: playerSeason.mmr,
      opponentMmr: opponentSeason.mmr,
      isWin: data.isWin,
      kFactor: 0,
      gamesPlayed: playerSeason.wins + playerSeason.losses,
      winStreak: playerSeason.winStreak,
      lossStreak: playerSeason.lossStreak,
    });

    const opponentResult = mmrService.calculateMMRChange({
      playerMmr: opponentSeason.mmr,
      opponentMmr: playerSeason.mmr,
      isWin: !data.isWin,
      kFactor: 0,
      gamesPlayed: opponentSeason.wins + opponentSeason.losses,
      winStreak: opponentSeason.winStreak,
      lossStreak: opponentSeason.lossStreak,
    });

    const playerTierData = tierService.getTierFromMMR(playerResult.newMmr);
    const opponentTierData = tierService.getTierFromMMR(opponentResult.newMmr);

    const [updatedPlayer, updatedOpponent, matchResult] = await this.prisma.$transaction([
      this.prisma.playerSeason.update({
        where: { id: playerSeason.id },
        data: {
          mmr: playerResult.newMmr,
          peakMmr: Math.max(playerSeason.peakMmr, playerResult.newMmr),
          tier: this.mapToRankedTier(playerTierData.tier),
          division: playerTierData.division,
          leaguePoints: tierService.calculateLeaguePoints(
            playerResult.newMmr,
            playerTierData.tier,
            playerTierData.division
          ),
          wins: data.isWin ? playerSeason.wins + 1 : playerSeason.wins,
          losses: data.isWin ? playerSeason.losses : playerSeason.losses + 1,
          winStreak: data.isWin ? playerSeason.winStreak + 1 : 0,
          lossStreak: data.isWin ? 0 : playerSeason.lossStreak + 1,
          placementMatchesPlayed: isPlacementMatch
            ? playerSeason.placementMatchesPlayed + 1
            : playerSeason.placementMatchesPlayed,
          placementMatchesWon:
            isPlacementMatch && data.isWin
              ? playerSeason.placementMatchesWon + 1
              : playerSeason.placementMatchesWon,
          isPlacementComplete:
            playerSeason.placementMatchesPlayed + 1 >= activeSeason.placementMatchesRequired,
        },
      }),
      this.prisma.playerSeason.update({
        where: { id: opponentSeason.id },
        data: {
          mmr: opponentResult.newMmr,
          peakMmr: Math.max(opponentSeason.peakMmr, opponentResult.newMmr),
          tier: this.mapToRankedTier(opponentTierData.tier),
          division: opponentTierData.division,
          leaguePoints: tierService.calculateLeaguePoints(
            opponentResult.newMmr,
            opponentTierData.tier,
            opponentTierData.division
          ),
          wins: !data.isWin ? opponentSeason.wins + 1 : opponentSeason.wins,
          losses: !data.isWin ? opponentSeason.losses : opponentSeason.losses + 1,
          winStreak: !data.isWin ? opponentSeason.winStreak + 1 : 0,
          lossStreak: !data.isWin ? 0 : opponentSeason.lossStreak + 1,
        },
      }),
      this.prisma.matchResult.create({
        data: {
          id: uuidv4(),
          playerId: data.playerId,
          seasonId: activeSeason.id,
          opponentId: data.opponentId,
          playerMmrBefore: playerSeason.mmr,
          playerMmrAfter: playerResult.newMmr,
          opponentMmrBefore: opponentSeason.mmr,
          opponentMmrAfter: opponentResult.newMmr,
          isWin: data.isWin,
          mmrChange: playerResult.mmrChange,
          isPlacementMatch,
          gameMode: data.gameMode ?? 'ranked',
        },
      }),
    ]);

    await Promise.all([
      mmrService.invalidatePlayerMMRCache(data.playerId, activeSeason.id),
      mmrService.invalidatePlayerMMRCache(data.opponentId, activeSeason.id),
      tierService.invalidatePlayerRankCache(data.playerId, activeSeason.id),
      tierService.invalidatePlayerRankCache(data.opponentId, activeSeason.id),
      this.invalidateLeaderboardCache(activeSeason.id),
    ]);

    logger.info(
      `Updated MMR: Player ${data.playerId} ${playerResult.mmrChange > 0 ? '+' : ''}${playerResult.mmrChange} (${playerResult.newMmr})`
    );

    return {
      player: {
        ...updatedPlayer,
        tier: this.mapPrismaTier(updatedPlayer.tier),
        division: updatedPlayer.division as TierDivision | null,
      } as PlayerSeason,
      opponent: {
        ...updatedOpponent,
        tier: this.mapPrismaTier(updatedOpponent.tier),
        division: updatedOpponent.division as TierDivision | null,
      } as PlayerSeason,
      matchResult: matchResult as MatchResult,
    };
  }

  public async getLeaderboard(
    seasonId: string,
    page = 1,
    limit = 50
  ): Promise<PaginatedResponse<LeaderboardEntry>> {
    const cached = await this.getCachedLeaderboard(seasonId, page);
    if (cached) {
      return cached;
    }

    const skip = (page - 1) * limit;

    const [players, total] = await Promise.all([
      this.prisma.playerSeason.findMany({
        where: { seasonId, isPlacementComplete: true },
        orderBy: [{ mmr: 'desc' }, { wins: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.playerSeason.count({
        where: { seasonId, isPlacementComplete: true },
      }),
    ]);

    const leaderboard: LeaderboardEntry[] = players.map((player, index) => ({
      rank: skip + index + 1,
      playerId: player.playerId,
      playerName: `Player_${player.playerId.slice(0, 8)}`,
      tier: this.mapPrismaTier(player.tier),
      division: player.division as TierDivision | null,
      leaguePoints: player.leaguePoints,
      mmr: player.mmr,
      wins: player.wins,
      losses: player.losses,
      winRate: player.wins + player.losses > 0
        ? Math.round((player.wins / (player.wins + player.losses)) * 100)
        : 0,
    }));

    const result: PaginatedResponse<LeaderboardEntry> = {
      data: leaderboard,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    await this.cacheLeaderboard(seasonId, page, result);
    return result;
  }

  public async getTierLeaderboard(
    seasonId: string,
    tier: RankedTier,
    page = 1,
    limit = 50
  ): Promise<{ tier: RankedTier; entries: LeaderboardEntry[]; total: number }> {
    const skip = (page - 1) * limit;

    const [players, total] = await Promise.all([
      this.prisma.playerSeason.findMany({
        where: {
          seasonId,
          isPlacementComplete: true,
          tier: this.mapToRankedTier(tier),
        },
        orderBy: [{ mmr: 'desc' }, { wins: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.playerSeason.count({
        where: {
          seasonId,
          isPlacementComplete: true,
          tier: this.mapToRankedTier(tier),
        },
      }),
    ]);

    const entries: LeaderboardEntry[] = players.map((player, index) => ({
      rank: skip + index + 1,
      playerId: player.playerId,
      playerName: `Player_${player.playerId.slice(0, 8)}`,
      tier: this.mapPrismaTier(player.tier),
      division: player.division as TierDivision | null,
      leaguePoints: player.leaguePoints,
      mmr: player.mmr,
      wins: player.wins,
      losses: player.losses,
      winRate: player.wins + player.losses > 0
        ? Math.round((player.wins / (player.wins + player.losses)) * 100)
        : 0,
    }));

    return { tier, entries, total };
  }

  public async getTopPlayersByTier(
    seasonId: string,
    limit = 10
  ): Promise<Record<RankedTier, LeaderboardEntry[]>> {
    const tiers = Object.values(RankedTier);
    const result: Record<RankedTier, LeaderboardEntry[]> = {} as Record<RankedTier, LeaderboardEntry[]>;

    for (const tier of tiers) {
      const players = await this.prisma.playerSeason.findMany({
        where: {
          seasonId,
          isPlacementComplete: true,
          tier: this.mapToRankedTier(tier),
        },
        orderBy: [{ mmr: 'desc' }, { wins: 'desc' }],
        take: limit,
      });

      result[tier] = players.map((player, index) => ({
        rank: index + 1,
        playerId: player.playerId,
        playerName: `Player_${player.playerId.slice(0, 8)}`,
        tier: this.mapPrismaTier(player.tier),
        division: player.division as TierDivision | null,
        leaguePoints: player.leaguePoints,
        mmr: player.mmr,
        wins: player.wins,
        losses: player.losses,
        winRate: player.wins + player.losses > 0
          ? Math.round((player.wins / (player.wins + player.losses)) * 100)
          : 0,
      }));
    }

    return result;
  }

  public async performSoftReset(seasonId: string): Promise<SeasonResetResult[]> {
    const season = await this.getSeasonById(seasonId);
    
    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId },
    });

    const results: SeasonResetResult[] = [];

    for (const player of players) {
      const newMmr = mmrService.calculateSoftReset({
        currentMmr: player.mmr,
        baseMmr: config.DEFAULT_MMR,
        resetFactor: season.softResetFactor,
      });

      const { tier: newTier, division: newDivision } = tierService.getTierFromMMR(newMmr);

      results.push({
        playerId: player.playerId,
        previousMmr: player.mmr,
        newMmr,
        previousTier: this.mapPrismaTier(player.tier),
        newTier,
        previousDivision: player.division as TierDivision | null,
        newDivision,
      });
    }

    logger.info(`Calculated soft reset for ${results.length} players in season ${season.number}`);
    return results;
  }

  public async getPlayerMatchHistory(
    playerId: string,
    seasonId: string,
    page = 1,
    limit = 20
  ): Promise<PaginatedResponse<MatchResult>> {
    const skip = (page - 1) * limit;

    const [matches, total] = await Promise.all([
      this.prisma.matchResult.findMany({
        where: { playerId, seasonId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.matchResult.count({
        where: { playerId, seasonId },
      }),
    ]);

    return {
      data: matches as MatchResult[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async getPlayerPreviousSeasonData(playerId: string): Promise<{ mmr: number } | null> {
    const previousSeason = await this.prisma.seasonArchive.findFirst({
      where: { playerId },
      orderBy: { seasonNumber: 'desc' },
    });

    if (previousSeason) {
      return { mmr: previousSeason.finalMmr };
    }

    return null;
  }

  private async archiveSeasonData(seasonId: string): Promise<void> {
    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId },
      orderBy: { mmr: 'desc' },
    });

    const season = await this.getSeasonById(seasonId);

    const archiveData = players.map((player, index) => ({
      id: uuidv4(),
      playerId: player.playerId,
      seasonId,
      seasonNumber: season.number,
      finalMmr: player.mmr,
      peakMmr: player.peakMmr,
      finalTier: player.tier,
      finalDivision: player.division,
      totalWins: player.wins,
      totalLosses: player.losses,
      finalRank: index + 1,
    }));

    await this.prisma.seasonArchive.createMany({
      data: archiveData,
    });

    logger.info(`Archived ${archiveData.length} player records for season ${season.number}`);
  }

  private async cacheActiveSeason(season: Season): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(
        CACHE_KEYS.ACTIVE_SEASON(),
        CACHE_TTL.ACTIVE_SEASON,
        JSON.stringify(season)
      );
    } catch (error) {
      logger.error('Failed to cache active season:', error);
    }
  }

  private async getCachedActiveSeason(): Promise<Season | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(CACHE_KEYS.ACTIVE_SEASON());
      if (cached) {
        return JSON.parse(cached) as Season;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached active season:', error);
      return null;
    }
  }

  private async invalidateActiveSeasonCache(): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.del(CACHE_KEYS.ACTIVE_SEASON());
    } catch (error) {
      logger.error('Failed to invalidate active season cache:', error);
    }
  }

  private async cacheLeaderboard(
    seasonId: string,
    page: number,
    data: PaginatedResponse<LeaderboardEntry>
  ): Promise<void> {
    try {
      const redis = getRedisClient();
      await redis.setex(
        CACHE_KEYS.LEADERBOARD(seasonId, page),
        CACHE_TTL.LEADERBOARD,
        JSON.stringify(data)
      );
    } catch (error) {
      logger.error('Failed to cache leaderboard:', error);
    }
  }

  private async getCachedLeaderboard(
    seasonId: string,
    page: number
  ): Promise<PaginatedResponse<LeaderboardEntry> | null> {
    try {
      const redis = getRedisClient();
      const cached = await redis.get(CACHE_KEYS.LEADERBOARD(seasonId, page));
      if (cached) {
        return JSON.parse(cached) as PaginatedResponse<LeaderboardEntry>;
      }
      return null;
    } catch (error) {
      logger.error('Failed to get cached leaderboard:', error);
      return null;
    }
  }

  private async invalidateLeaderboardCache(seasonId: string): Promise<void> {
    try {
      const redis = getRedisClient();
      const keys = await redis.keys(`leaderboard:${seasonId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      logger.error('Failed to invalidate leaderboard cache:', error);
    }
  }

  public async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private mapPrismaSeasonState(state: PrismaSeasonState): SeasonState {
    return state as SeasonState;
  }

  private mapToSeasonState(state: SeasonState): PrismaSeasonState {
    return state as PrismaSeasonState;
  }

  private mapPrismaSeasonType(type: PrismaSeasonType): SeasonType {
    return type as SeasonType;
  }

  private mapToSeasonType(type: SeasonType): PrismaSeasonType {
    return type as PrismaSeasonType;
  }

  private mapPrismaResetType(type: PrismaResetType): ResetType {
    return type as ResetType;
  }

  private mapToResetType(type: ResetType): PrismaResetType {
    return type as PrismaResetType;
  }

  public async createSeasonWithMetadata(
    data: CreateSeasonDTO & {
      type?: SeasonType;
      resetType?: ResetType;
      gameIds?: string[];
      timezone?: string;
      mmrFloor?: number;
      mmrCeiling?: number;
      demotionProtection?: number;
      decayEnabled?: boolean;
      decayDays?: number;
      decayAmount?: number;
      promoWinsRequired?: number;
      promoGamesMax?: number;
      demotionShieldGames?: number;
      skillGroupRestriction?: number;
      gamerstakeEventId?: string;
    },
    metadata?: CreateSeasonMetadataDTO
  ): Promise<Season> {
    const existingSeason = await this.prisma.season.findUnique({
      where: { number: data.number },
    });

    if (existingSeason) {
      throw new ConflictError(`Season ${data.number} already exists`);
    }

    const season = await this.prisma.season.create({
      data: {
        id: uuidv4(),
        name: data.name,
        number: data.number,
        startDate: data.startDate,
        isActive: false,
        state: this.mapToSeasonState(SeasonState.DRAFT),
        type: data.type ? this.mapToSeasonType(data.type) : this.mapToSeasonType(SeasonType.RANKED),
        resetType: data.resetType ? this.mapToResetType(data.resetType) : this.mapToResetType(ResetType.SOFT),
        softResetFactor: data.softResetFactor ?? config.SOFT_RESET_FACTOR,
        placementMatchesRequired: data.placementMatchesRequired ?? config.PLACEMENT_MATCHES_REQUIRED,
        gameIds: data.gameIds || [],
        timezone: data.timezone || 'UTC',
        mmrFloor: data.mmrFloor ?? 0,
        mmrCeiling: data.mmrCeiling ?? 5000,
        demotionProtection: data.demotionProtection ?? 1,
        decayEnabled: data.decayEnabled ?? true,
        decayDays: data.decayDays ?? 14,
        decayAmount: data.decayAmount ?? 25,
        promoWinsRequired: data.promoWinsRequired ?? 2,
        promoGamesMax: data.promoGamesMax ?? 3,
        demotionShieldGames: data.demotionShieldGames ?? 3,
        skillGroupRestriction: data.skillGroupRestriction ?? 2,
        gamerstakeEventId: data.gamerstakeEventId,
      },
    });

    if (metadata) {
      await this.prisma.seasonMetadata.create({
        data: {
          id: uuidv4(),
          seasonId: season.id,
          theme: metadata.theme,
          description: metadata.description,
          bannerImageUrl: metadata.bannerImageUrl,
          thumbnailUrl: metadata.thumbnailUrl,
          promoVideoUrl: metadata.promoVideoUrl,
          colorPrimary: metadata.colorPrimary,
          colorSecondary: metadata.colorSecondary,
          localizations: (metadata.localizations || {}) as unknown as Prisma.InputJsonValue,
          customData: (metadata.customData || {}) as unknown as Prisma.InputJsonValue,
        },
      });
    }

    logger.info(`Created season ${season.number}: ${season.name} with state ${season.state}`);
    return season as unknown as Season;
  }

  public async getSeasonMetadata(seasonId: string): Promise<SeasonMetadata | null> {
    const metadata = await this.prisma.seasonMetadata.findUnique({
      where: { seasonId },
    });

    if (!metadata) {
      return null;
    }

    return {
      ...metadata,
      localizations: metadata.localizations as unknown as Record<string, LocalizedContent>,
      customData: metadata.customData as Record<string, unknown>,
    } as SeasonMetadata;
  }

  public async updateSeasonMetadata(
    seasonId: string,
    updates: Partial<CreateSeasonMetadataDTO>
  ): Promise<SeasonMetadata> {
    const existing = await this.prisma.seasonMetadata.findUnique({
      where: { seasonId },
    });

    if (!existing) {
      const metadata = await this.prisma.seasonMetadata.create({
        data: {
          id: uuidv4(),
          seasonId,
          theme: updates.theme,
          description: updates.description,
          bannerImageUrl: updates.bannerImageUrl,
          thumbnailUrl: updates.thumbnailUrl,
          promoVideoUrl: updates.promoVideoUrl,
          colorPrimary: updates.colorPrimary,
          colorSecondary: updates.colorSecondary,
          localizations: (updates.localizations || {}) as unknown as Prisma.InputJsonValue,
          customData: (updates.customData || {}) as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        ...metadata,
        localizations: metadata.localizations as unknown as Record<string, LocalizedContent>,
        customData: metadata.customData as Record<string, unknown>,
      } as SeasonMetadata;
    }

    const metadata = await this.prisma.seasonMetadata.update({
      where: { seasonId },
      data: {
        theme: updates.theme,
        description: updates.description,
        bannerImageUrl: updates.bannerImageUrl,
        thumbnailUrl: updates.thumbnailUrl,
        promoVideoUrl: updates.promoVideoUrl,
        colorPrimary: updates.colorPrimary,
        colorSecondary: updates.colorSecondary,
        localizations: updates.localizations as Prisma.InputJsonValue | undefined,
        customData: updates.customData as Prisma.InputJsonValue | undefined,
      },
    });

    logger.info(`Updated metadata for season ${seasonId}`);

    return {
      ...metadata,
      localizations: metadata.localizations as unknown as Record<string, LocalizedContent>,
      customData: metadata.customData as Record<string, unknown>,
    } as SeasonMetadata;
  }

  public async createSeasonTemplate(data: CreateSeasonTemplateDTO): Promise<SeasonTemplate> {
    const template = await this.prisma.seasonTemplate.create({
      data: {
        id: uuidv4(),
        name: data.name,
        description: data.description,
        type: data.type ? this.mapToSeasonType(data.type) : this.mapToSeasonType(SeasonType.RANKED),
        resetType: data.resetType ? this.mapToResetType(data.resetType) : this.mapToResetType(ResetType.SOFT),
        softResetFactor: data.softResetFactor ?? 0.5,
        placementMatchesRequired: data.placementMatchesRequired ?? 10,
        durationDays: data.durationDays ?? 90,
        mmrFloor: data.mmrFloor ?? 0,
        mmrCeiling: data.mmrCeiling ?? 5000,
        demotionProtection: data.demotionProtection ?? 1,
        decayEnabled: data.decayEnabled ?? true,
        decayDays: data.decayDays ?? 14,
        decayAmount: data.decayAmount ?? 25,
        promoWinsRequired: data.promoWinsRequired ?? 2,
        promoGamesMax: data.promoGamesMax ?? 3,
        demotionShieldGames: data.demotionShieldGames ?? 3,
        skillGroupRestriction: data.skillGroupRestriction ?? 2,
        defaultRules: (data.defaultRules || []) as unknown as Prisma.InputJsonValue,
        defaultModifiers: (data.defaultModifiers || []) as unknown as Prisma.InputJsonValue,
        defaultRewards: (data.defaultRewards || []) as unknown as Prisma.InputJsonValue,
        isActive: true,
      },
    });

    logger.info(`Created season template: ${template.name}`);

    return {
      ...template,
      type: this.mapPrismaSeasonType(template.type),
      resetType: this.mapPrismaResetType(template.resetType),
      defaultRules: template.defaultRules as unknown[],
      defaultModifiers: template.defaultModifiers as unknown[],
      defaultRewards: template.defaultRewards as unknown[],
    } as unknown as SeasonTemplate;
  }

  public async getSeasonTemplates(): Promise<SeasonTemplate[]> {
    const templates = await this.prisma.seasonTemplate.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return templates.map((template) => ({
      ...template,
      type: this.mapPrismaSeasonType(template.type),
      resetType: this.mapPrismaResetType(template.resetType),
      defaultRules: template.defaultRules as unknown[],
      defaultModifiers: template.defaultModifiers as unknown[],
      defaultRewards: template.defaultRewards as unknown[],
    })) as unknown as SeasonTemplate[];
  }

  public async createSeasonFromTemplate(
    templateId: string,
    overrides: Partial<CreateSeasonDTO> & { number: number; name: string; startDate: Date }
  ): Promise<Season> {
    const template = await this.prisma.seasonTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundError(`Template ${templateId} not found`);
    }

    const endDate = new Date(overrides.startDate);
    endDate.setDate(endDate.getDate() + template.durationDays);

    const season = await this.prisma.season.create({
      data: {
        id: uuidv4(),
        name: overrides.name,
        number: overrides.number,
        startDate: overrides.startDate,
        endDate,
        isActive: false,
        state: this.mapToSeasonState(SeasonState.DRAFT),
        type: template.type,
        resetType: template.resetType,
        templateId,
        softResetFactor: overrides.softResetFactor ?? template.softResetFactor,
        placementMatchesRequired: overrides.placementMatchesRequired ?? template.placementMatchesRequired,
        mmrFloor: template.mmrFloor,
        mmrCeiling: template.mmrCeiling,
        demotionProtection: template.demotionProtection,
        decayEnabled: template.decayEnabled,
        decayDays: template.decayDays,
        decayAmount: template.decayAmount,
        promoWinsRequired: template.promoWinsRequired,
        promoGamesMax: template.promoGamesMax,
        demotionShieldGames: template.demotionShieldGames,
        skillGroupRestriction: template.skillGroupRestriction,
      },
    });

    logger.info(`Created season ${season.number} from template ${template.name}`);

    return season as unknown as Season;
  }

  public async cloneSeason(
    sourceSeasonId: string,
    newNumber: number,
    newName: string,
    newStartDate: Date
  ): Promise<Season> {
    const sourceSeason = await this.prisma.season.findUnique({
      where: { id: sourceSeasonId },
      include: {
        metadata: true,
        rules: true,
        modifiers: true,
        seasonRewards: true,
      },
    });

    if (!sourceSeason) {
      throw new NotFoundError(`Season ${sourceSeasonId} not found`);
    }

    const existingSeason = await this.prisma.season.findUnique({
      where: { number: newNumber },
    });

    if (existingSeason) {
      throw new ConflictError(`Season ${newNumber} already exists`);
    }

    const newSeason = await this.prisma.season.create({
      data: {
        id: uuidv4(),
        name: newName,
        number: newNumber,
        startDate: newStartDate,
        endDate: sourceSeason.endDate
          ? new Date(newStartDate.getTime() + (sourceSeason.endDate.getTime() - sourceSeason.startDate.getTime()))
          : null,
        isActive: false,
        state: this.mapToSeasonState(SeasonState.DRAFT),
        type: sourceSeason.type,
        resetType: sourceSeason.resetType,
        parentSeasonId: sourceSeasonId,
        softResetFactor: sourceSeason.softResetFactor,
        placementMatchesRequired: sourceSeason.placementMatchesRequired,
        gameIds: sourceSeason.gameIds,
        timezone: sourceSeason.timezone,
        mmrFloor: sourceSeason.mmrFloor,
        mmrCeiling: sourceSeason.mmrCeiling,
        demotionProtection: sourceSeason.demotionProtection,
        decayEnabled: sourceSeason.decayEnabled,
        decayDays: sourceSeason.decayDays,
        decayAmount: sourceSeason.decayAmount,
        promoWinsRequired: sourceSeason.promoWinsRequired,
        promoGamesMax: sourceSeason.promoGamesMax,
        demotionShieldGames: sourceSeason.demotionShieldGames,
        skillGroupRestriction: sourceSeason.skillGroupRestriction,
      },
    });

    if (sourceSeason.metadata) {
      await this.prisma.seasonMetadata.create({
        data: {
          id: uuidv4(),
          seasonId: newSeason.id,
          theme: sourceSeason.metadata.theme,
          description: sourceSeason.metadata.description,
          bannerImageUrl: sourceSeason.metadata.bannerImageUrl,
          thumbnailUrl: sourceSeason.metadata.thumbnailUrl,
          promoVideoUrl: sourceSeason.metadata.promoVideoUrl,
          colorPrimary: sourceSeason.metadata.colorPrimary,
          colorSecondary: sourceSeason.metadata.colorSecondary,
          localizations: sourceSeason.metadata.localizations as object,
          customData: sourceSeason.metadata.customData as object,
        },
      });
    }

    for (const rule of sourceSeason.rules) {
      await this.prisma.seasonRule.create({
        data: {
          id: uuidv4(),
          seasonId: newSeason.id,
          name: rule.name,
          description: rule.description,
          ruleType: rule.ruleType,
          ruleConfig: rule.ruleConfig as object,
          priority: rule.priority,
          isEnabled: rule.isEnabled,
        },
      });
    }

    for (const modifier of sourceSeason.modifiers) {
      await this.prisma.seasonModifier.create({
        data: {
          id: uuidv4(),
          seasonId: newSeason.id,
          name: modifier.name,
          description: modifier.description,
          modifierType: modifier.modifierType,
          value: modifier.value,
          startTime: modifier.startTime,
          endTime: modifier.endTime,
          daysOfWeek: modifier.daysOfWeek,
          hoursOfDay: modifier.hoursOfDay,
          isActive: modifier.isActive,
        },
      });
    }

    for (const reward of sourceSeason.seasonRewards) {
      await this.prisma.seasonReward.create({
        data: {
          id: uuidv4(),
          seasonId: newSeason.id,
          tier: reward.tier,
          rewardType: reward.rewardType,
          rewardId: reward.rewardId,
          rewardName: reward.rewardName,
          rewardDescription: reward.rewardDescription,
          quantity: reward.quantity,
          isExclusive: reward.isExclusive,
        },
      });
    }

    logger.info(`Cloned season ${sourceSeason.number} to new season ${newNumber}`);

    return newSeason as unknown as Season;
  }

  public async getSeasonPreview(seasonId: string): Promise<SeasonPreview> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        metadata: true,
        rules: true,
        modifiers: true,
        challenges: true,
        seasonRewards: true,
      },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const validationErrors: string[] = [];

    if (!season.startDate) {
      validationErrors.push('Start date is required');
    }

    if (season.seasonRewards.length === 0) {
      validationErrors.push('No rewards configured');
    }

    const previousSeasonPlayers = await this.prisma.playerSeason.count({
      where: {
        season: {
          number: season.number - 1,
        },
      },
    });

    return {
      season: season as unknown as Season,
      metadata: season.metadata
        ? ({
            ...season.metadata,
            localizations: season.metadata.localizations as unknown as Record<string, LocalizedContent>,
            customData: season.metadata.customData as Record<string, unknown>,
          } as SeasonMetadata)
        : null,
      rules: season.rules.map((rule) => ({
        ...rule,
        ruleConfig: rule.ruleConfig as Record<string, unknown>,
      })) as unknown as SeasonPreview['rules'],
      modifiers: season.modifiers as unknown as SeasonPreview['modifiers'],
      challenges: season.challenges as unknown as SeasonPreview['challenges'],
      rewards: season.seasonRewards as unknown as SeasonPreview['rewards'],
      estimatedPlayerCount: previousSeasonPlayers,
      validationErrors,
    };
  }

  public async updateSeasonVersion(seasonId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        version: season.version + 1,
      },
    });

    logger.info(`Updated season ${seasonId} to version ${updatedSeason.version}`);

    return updatedSeason as unknown as Season;
  }

  public async getSeasonsByGame(gameId: string): Promise<Season[]> {
    const seasons = await this.prisma.season.findMany({
      where: {
        gameIds: {
          has: gameId,
        },
      },
      orderBy: { number: 'desc' },
    });

    return seasons as unknown as Season[];
  }

  public async addGameToSeason(seasonId: string, gameId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (season.gameIds.includes(gameId)) {
      return season as unknown as Season;
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        gameIds: [...season.gameIds, gameId],
      },
    });

    logger.info(`Added game ${gameId} to season ${seasonId}`);

    return updatedSeason as unknown as Season;
  }

  public async removeGameFromSeason(seasonId: string, gameId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        gameIds: season.gameIds.filter((id) => id !== gameId),
      },
    });

    logger.info(`Removed game ${gameId} from season ${seasonId}`);

    return updatedSeason as unknown as Season;
  }

  public async getLocalizedSeasonContent(
    seasonId: string,
    locale: string
  ): Promise<{ name: string; description: string; theme?: string } | null> {
    const metadata = await this.prisma.seasonMetadata.findUnique({
      where: { seasonId },
    });

    if (!metadata) {
      return null;
    }

    const localizations = metadata.localizations as unknown as Record<string, LocalizedContent>;
    const localized = localizations[locale];

    if (localized) {
      return {
        name: localized.name,
        description: localized.description,
        theme: localized.theme,
      };
    }

    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    return {
      name: season?.name || '',
      description: metadata.description || '',
      theme: metadata.theme || undefined,
    };
  }

  public async setSeasonLocalization(
    seasonId: string,
    locale: string,
    content: LocalizedContent
  ): Promise<SeasonMetadata> {
    const metadata = await this.prisma.seasonMetadata.findUnique({
      where: { seasonId },
    });

    if (!metadata) {
      throw new NotFoundError(`Season metadata for ${seasonId} not found`);
    }

    const localizations = metadata.localizations as unknown as Record<string, LocalizedContent>;
    localizations[locale] = content;

    const updatedMetadata = await this.prisma.seasonMetadata.update({
      where: { seasonId },
      data: {
        localizations: localizations as unknown as Prisma.InputJsonValue,
      },
    });

    logger.info(`Set ${locale} localization for season ${seasonId}`);

    return {
      ...updatedMetadata,
      localizations: updatedMetadata.localizations as unknown as Record<string, LocalizedContent>,
      customData: updatedMetadata.customData as Record<string, unknown>,
    } as SeasonMetadata;
  }
}

export const seasonService = new SeasonService();
