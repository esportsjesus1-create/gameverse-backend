import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, MoreThanOrEqual } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TournamentStanding } from '../entities/tournament-standing.entity';
import { Tournament, TournamentStatus } from '../entities/tournament.entity';
import { TournamentMatch, MatchStatus } from '../entities/tournament-match.entity';
import { TournamentPrize, PrizeStatus } from '../entities/tournament-prize.entity';
import {
  GetTournamentStandingsDto,
  GetGlobalLeaderboardDto,
  GetPlayerStatsDto,
  GetHistoricalResultsDto,
  LeaderboardResponseDto,
  LeaderboardEntryDto,
  PlayerStatsResponseDto,
  LeaderboardSortBy,
  LeaderboardTimeframe,
} from '../dto/leaderboard.dto';

const CACHE_TTL_SECONDS = 60;
const CACHE_PREFIX = 'tournament:leaderboard:';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(TournamentStanding)
    private readonly standingRepository: Repository<TournamentStanding>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentMatch)
    private readonly matchRepository: Repository<TournamentMatch>,
    @InjectRepository(TournamentPrize)
    private readonly prizeRepository: Repository<TournamentPrize>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getTournamentStandings(dto: GetTournamentStandingsDto): Promise<LeaderboardResponseDto> {
    const cacheKey = `${CACHE_PREFIX}tournament:${dto.tournamentId}:${dto.page}:${dto.limit}:${dto.sortBy}:${dto.sortOrder}`;

    const cached = await this.cacheManager.get<LeaderboardResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const sortBy = dto.sortBy ?? LeaderboardSortBy.RANK;
    const sortOrder = dto.sortOrder ?? 'asc';

    const orderField = this.getSortField(sortBy);

    const [standings, total] = await this.standingRepository.findAndCount({
      where: { tournamentId: dto.tournamentId },
      order: { [orderField]: sortOrder.toUpperCase() as 'ASC' | 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const entries: LeaderboardEntryDto[] = standings.map((s) => ({
      rank: s.rank,
      participantId: s.participantId,
      participantName: s.participantName,
      teamId: s.teamId ?? undefined,
      teamName: s.teamName ?? undefined,
      points: Number(s.points),
      wins: s.wins,
      losses: s.losses,
      winRate: Number(s.winRate),
      matchesPlayed: s.matchesPlayed,
      currentStreak: s.currentStreak,
      streakType: s.streakType,
    }));

    const response: LeaderboardResponseDto = {
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      cachedAt: new Date(),
    };

    await this.cacheManager.set(cacheKey, response, CACHE_TTL_SECONDS * 1000);

    return response;
  }

  async getRealTimeStandings(tournamentId: string): Promise<LeaderboardEntryDto[]> {
    const standings = await this.standingRepository.find({
      where: { tournamentId },
      order: { rank: 'ASC' },
    });

    return standings.map((s) => ({
      rank: s.rank,
      participantId: s.participantId,
      participantName: s.participantName,
      teamId: s.teamId ?? undefined,
      teamName: s.teamName ?? undefined,
      points: Number(s.points),
      wins: s.wins,
      losses: s.losses,
      winRate: Number(s.winRate),
      matchesPlayed: s.matchesPlayed,
      currentStreak: s.currentStreak,
      streakType: s.streakType,
    }));
  }

  async getGlobalLeaderboard(dto: GetGlobalLeaderboardDto): Promise<LeaderboardResponseDto> {
    const cacheKey = `${CACHE_PREFIX}global:${dto.gameId ?? 'all'}:${dto.region ?? 'all'}:${dto.timeframe}:${dto.page}:${dto.limit}`;

    const cached = await this.cacheManager.get<LeaderboardResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const timeframe = dto.timeframe ?? LeaderboardTimeframe.ALL_TIME;

    const dateFilter = this.getDateFilter(timeframe);

    const tournamentWhere: Record<string, unknown> = {
      status: TournamentStatus.COMPLETED,
    };

    if (dto.gameId) {
      tournamentWhere.gameId = dto.gameId;
    }

    if (dateFilter) {
      tournamentWhere.endDate = MoreThanOrEqual(dateFilter);
    }

    const tournaments = await this.tournamentRepository.find({
      where: tournamentWhere,
    });

    const tournamentIds = tournaments.map((t) => t.id);

    if (tournamentIds.length === 0) {
      return {
        entries: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        cachedAt: new Date(),
      };
    }

    const aggregatedStats = await this.standingRepository
      .createQueryBuilder('standing')
      .select('standing.participantId', 'participantId')
      .addSelect('standing.participantName', 'participantName')
      .addSelect('SUM(standing.points)', 'totalPoints')
      .addSelect('SUM(standing.wins)', 'totalWins')
      .addSelect('SUM(standing.losses)', 'totalLosses')
      .addSelect('SUM(standing.matchesPlayed)', 'totalMatches')
      .addSelect('COUNT(DISTINCT standing.tournamentId)', 'tournamentsPlayed')
      .where('standing.tournamentId IN (:...tournamentIds)', { tournamentIds })
      .groupBy('standing.participantId')
      .addGroupBy('standing.participantName')
      .orderBy('SUM(standing.points)', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const totalCount = await this.standingRepository
      .createQueryBuilder('standing')
      .select('COUNT(DISTINCT standing.participantId)', 'count')
      .where('standing.tournamentId IN (:...tournamentIds)', { tournamentIds })
      .getRawOne();

    const entries: LeaderboardEntryDto[] = aggregatedStats.map((stat, index) => ({
      rank: (page - 1) * limit + index + 1,
      participantId: stat.participantId,
      participantName: stat.participantName,
      points: Number(stat.totalPoints) || 0,
      wins: Number(stat.totalWins) || 0,
      losses: Number(stat.totalLosses) || 0,
      winRate:
        Number(stat.totalMatches) > 0 ? Number(stat.totalWins) / Number(stat.totalMatches) : 0,
      matchesPlayed: Number(stat.totalMatches) || 0,
    }));

    const total = Number(totalCount?.count) || 0;

    const response: LeaderboardResponseDto = {
      entries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      cachedAt: new Date(),
    };

    await this.cacheManager.set(cacheKey, response, CACHE_TTL_SECONDS * 1000);

    return response;
  }

  async getPlayerStats(dto: GetPlayerStatsDto): Promise<PlayerStatsResponseDto> {
    const cacheKey = `${CACHE_PREFIX}player:${dto.playerId}:${dto.gameId ?? 'all'}:${dto.timeframe}`;

    const cached = await this.cacheManager.get<PlayerStatsResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const timeframe = dto.timeframe ?? LeaderboardTimeframe.ALL_TIME;
    const dateFilter = this.getDateFilter(timeframe);

    const tournamentWhere: Record<string, unknown> = {
      status: TournamentStatus.COMPLETED,
    };

    if (dto.gameId) {
      tournamentWhere.gameId = dto.gameId;
    }

    if (dateFilter) {
      tournamentWhere.endDate = MoreThanOrEqual(dateFilter);
    }

    const tournaments = await this.tournamentRepository.find({
      where: tournamentWhere,
    });

    const tournamentIds = tournaments.map((t) => t.id);

    const standings = await this.standingRepository.find({
      where: {
        participantId: dto.playerId,
        tournamentId: In(tournamentIds.length > 0 ? tournamentIds : ['none']),
      },
    });

    if (standings.length === 0) {
      throw new NotFoundException(`No tournament history found for player ${dto.playerId}`);
    }

    const totalWins = standings.reduce((sum, s) => sum + s.wins, 0);
    const totalLosses = standings.reduce((sum, s) => sum + s.losses, 0);
    const totalMatches = standings.reduce((sum, s) => sum + s.matchesPlayed, 0);

    const tournamentWins = standings.filter((s) => s.finalPlacement === 1).length;
    const topThreeFinishes = standings.filter(
      (s) => s.finalPlacement && s.finalPlacement <= 3,
    ).length;

    const placements = standings.filter((s) => s.finalPlacement).map((s) => s.finalPlacement!);
    const averagePlacement =
      placements.length > 0 ? placements.reduce((sum, p) => sum + p, 0) / placements.length : 0;
    const bestPlacement = placements.length > 0 ? Math.min(...placements) : 0;

    const prizes = await this.prizeRepository.find({
      where: {
        recipientId: dto.playerId,
        status: PrizeStatus.DISTRIBUTED,
        tournamentId: In(tournamentIds.length > 0 ? tournamentIds : ['none']),
      },
    });

    const totalPrizeEarnings = prizes.reduce((sum, p) => sum + Number(p.amount), 0);

    const globalLeaderboard = await this.getGlobalLeaderboard({
      gameId: dto.gameId,
      timeframe,
      page: 1,
      limit: 1000,
    });

    const playerRanking =
      globalLeaderboard.entries.findIndex((e) => e.participantId === dto.playerId) + 1;

    const recentMatches = await this.matchRepository.find({
      where: [
        {
          participant1Id: dto.playerId,
          status: MatchStatus.COMPLETED,
          tournamentId: In(tournamentIds.length > 0 ? tournamentIds : ['none']),
        },
        {
          participant2Id: dto.playerId,
          status: MatchStatus.COMPLETED,
          tournamentId: In(tournamentIds.length > 0 ? tournamentIds : ['none']),
        },
      ],
      order: { completedAt: 'DESC' },
      take: 10,
    });

    const recentForm = recentMatches.map((m) => (m.winnerId === dto.playerId ? 'W' : 'L'));

    const playerName = standings[0]?.participantName ?? 'Unknown';

    const response: PlayerStatsResponseDto = {
      playerId: dto.playerId,
      playerName,
      tournamentsPlayed: standings.length,
      totalWins,
      totalLosses,
      overallWinRate: totalMatches > 0 ? totalWins / totalMatches : 0,
      tournamentWins,
      topThreeFinishes,
      averagePlacement,
      totalPrizeEarnings,
      bestPlacement,
      currentRanking: playerRanking || 0,
      recentForm,
    };

    await this.cacheManager.set(cacheKey, response, CACHE_TTL_SECONDS * 1000);

    return response;
  }

  async getHistoricalResults(dto: GetHistoricalResultsDto): Promise<{
    results: Array<{
      tournamentId: string;
      tournamentName: string;
      gameId: string;
      placement: number;
      wins: number;
      losses: number;
      prizeWon: number;
      completedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const tournamentWhere: Record<string, unknown> = {
      status: TournamentStatus.COMPLETED,
    };

    if (dto.gameId) {
      tournamentWhere.gameId = dto.gameId;
    }

    if (dto.startDate && dto.endDate) {
      tournamentWhere.endDate = Between(new Date(dto.startDate), new Date(dto.endDate));
    }

    if (dto.tournamentId) {
      tournamentWhere.id = dto.tournamentId;
    }

    const tournaments = await this.tournamentRepository.find({
      where: tournamentWhere,
      order: { endDate: 'DESC' },
    });

    let results: Array<{
      tournamentId: string;
      tournamentName: string;
      gameId: string;
      placement: number;
      wins: number;
      losses: number;
      prizeWon: number;
      completedAt: Date;
    }> = [];

    for (const tournament of tournaments) {
      const standingWhere: Record<string, unknown> = {
        tournamentId: tournament.id,
      };

      if (dto.playerId) {
        standingWhere.participantId = dto.playerId;
      }

      const standings = await this.standingRepository.find({
        where: standingWhere,
        order: { finalPlacement: 'ASC' },
      });

      for (const standing of standings) {
        const prize = await this.prizeRepository.findOne({
          where: {
            tournamentId: tournament.id,
            recipientId: standing.participantId,
            status: PrizeStatus.DISTRIBUTED,
          },
        });

        results.push({
          tournamentId: tournament.id,
          tournamentName: tournament.name,
          gameId: tournament.gameId,
          placement: standing.finalPlacement ?? standing.rank,
          wins: standing.wins,
          losses: standing.losses,
          prizeWon: prize ? Number(prize.amount) : 0,
          completedAt: tournament.endDate ?? tournament.updatedAt,
        });
      }
    }

    const total = results.length;
    results = results.slice((page - 1) * limit, page * limit);

    return {
      results,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async invalidateCache(tournamentId: string): Promise<void> {
    const keys = await this.cacheManager.store.keys?.(
      `${CACHE_PREFIX}tournament:${tournamentId}:*`,
    );
    if (keys) {
      for (const key of keys) {
        await this.cacheManager.del(key);
      }
    }

    const globalKeys = await this.cacheManager.store.keys?.(`${CACHE_PREFIX}global:*`);
    if (globalKeys) {
      for (const key of globalKeys) {
        await this.cacheManager.del(key);
      }
    }
  }

  async recalculateStandings(tournamentId: string): Promise<void> {
    const standings = await this.standingRepository.find({
      where: { tournamentId },
    });

    for (const standing of standings) {
      const matches = await this.matchRepository.find({
        where: [
          {
            tournamentId,
            participant1Id: standing.participantId,
            status: MatchStatus.COMPLETED,
          },
          {
            tournamentId,
            participant2Id: standing.participantId,
            status: MatchStatus.COMPLETED,
          },
        ],
      });

      let wins = 0;
      let losses = 0;
      let gamesWon = 0;
      let gamesLost = 0;

      for (const match of matches) {
        if (match.winnerId === standing.participantId) {
          wins++;
          gamesWon +=
            match.participant1Id === standing.participantId
              ? (match.participant1Score ?? 0)
              : (match.participant2Score ?? 0);
          gamesLost +=
            match.participant1Id === standing.participantId
              ? (match.participant2Score ?? 0)
              : (match.participant1Score ?? 0);
        } else {
          losses++;
          gamesWon +=
            match.participant1Id === standing.participantId
              ? (match.participant1Score ?? 0)
              : (match.participant2Score ?? 0);
          gamesLost +=
            match.participant1Id === standing.participantId
              ? (match.participant2Score ?? 0)
              : (match.participant1Score ?? 0);
        }
      }

      standing.wins = wins;
      standing.losses = losses;
      standing.matchesPlayed = wins + losses;
      standing.gamesWon = gamesWon;
      standing.gamesLost = gamesLost;
      standing.points = wins * 3;
      standing.winRate = standing.matchesPlayed > 0 ? wins / standing.matchesPlayed : 0;
    }

    standings.sort((a, b) => {
      if (b.points !== a.points) return Number(b.points) - Number(a.points);
      if (b.wins !== a.wins) return b.wins - a.wins;
      return Number(b.winRate) - Number(a.winRate);
    });

    for (let i = 0; i < standings.length; i++) {
      standings[i].rank = i + 1;
    }

    await this.standingRepository.save(standings);
    await this.invalidateCache(tournamentId);
  }

  async calculateBuchholzScores(tournamentId: string): Promise<void> {
    const standings = await this.standingRepository.find({
      where: { tournamentId },
    });

    const standingMap = new Map<string, TournamentStanding>();
    for (const standing of standings) {
      standingMap.set(standing.participantId, standing);
    }

    for (const standing of standings) {
      const matches = await this.matchRepository.find({
        where: [
          {
            tournamentId,
            participant1Id: standing.participantId,
            status: MatchStatus.COMPLETED,
          },
          {
            tournamentId,
            participant2Id: standing.participantId,
            status: MatchStatus.COMPLETED,
          },
        ],
      });

      let buchholzScore = 0;
      let opponentWinRateSum = 0;
      let opponentCount = 0;

      for (const match of matches) {
        const opponentId =
          match.participant1Id === standing.participantId
            ? match.participant2Id
            : match.participant1Id;

        if (opponentId) {
          const opponentStanding = standingMap.get(opponentId);
          if (opponentStanding) {
            buchholzScore += Number(opponentStanding.points);
            opponentWinRateSum += Number(opponentStanding.winRate);
            opponentCount++;
          }
        }
      }

      standing.buchholzScore = buchholzScore;
      standing.opponentWinRate =
        opponentCount > 0 ? Math.round((opponentWinRateSum / opponentCount) * 100) : 0;
    }

    await this.standingRepository.save(standings);
  }

  private getSortField(sortBy: LeaderboardSortBy): string {
    switch (sortBy) {
      case LeaderboardSortBy.RANK:
        return 'rank';
      case LeaderboardSortBy.POINTS:
        return 'points';
      case LeaderboardSortBy.WINS:
        return 'wins';
      case LeaderboardSortBy.WIN_RATE:
        return 'winRate';
      case LeaderboardSortBy.MATCHES_PLAYED:
        return 'matchesPlayed';
      default:
        return 'rank';
    }
  }

  private getDateFilter(timeframe: LeaderboardTimeframe): Date | null {
    const now = new Date();

    switch (timeframe) {
      case LeaderboardTimeframe.WEEKLY:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case LeaderboardTimeframe.MONTHLY:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case LeaderboardTimeframe.YEARLY:
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case LeaderboardTimeframe.ALL_TIME:
      default:
        return null;
    }
  }
}
