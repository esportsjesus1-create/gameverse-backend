import { PrismaClient, RankedTier as PrismaRankedTier } from '@prisma/client';
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
}

export const seasonService = new SeasonService();
