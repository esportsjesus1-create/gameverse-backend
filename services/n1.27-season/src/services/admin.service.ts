import { PrismaClient, SeasonState as PrismaSeasonState, AuditAction as PrismaAuditAction } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import {
  Season,
  SeasonState,
  SeasonAnalytics,
  SeasonAuditLog,
  AuditAction,
  AuditLogFilter,
  BulkOperationResult,
  BulkOperationError,
  EmergencyAction,
  RankedTier,
  TierDivision,
} from '../types';
import { lifecycleService } from './lifecycle.service';

export class AdminService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private mapPrismaState(state: PrismaSeasonState): SeasonState {
    return state as SeasonState;
  }

  private mapToSeasonState(state: SeasonState): PrismaSeasonState {
    return state as PrismaSeasonState;
  }

  private mapPrismaAuditAction(action: PrismaAuditAction): AuditAction {
    return action as AuditAction;
  }

  private mapToAuditAction(action: AuditAction): PrismaAuditAction {
    return action as PrismaAuditAction;
  }

  public async getDashboardStats(seasonId: string): Promise<{
    season: Season;
    analytics: SeasonAnalytics | null;
    recentActivity: SeasonAuditLog[];
    healthStatus: { isHealthy: boolean; warnings: string[] };
  }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        analytics: true,
      },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const recentLogs = await this.prisma.seasonAuditLog.findMany({
      where: { seasonId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const healthStatus = await lifecycleService.getSeasonHealth(seasonId);

    const analytics = season.analytics
      ? {
          ...season.analytics,
          tierDistribution: season.analytics.tierDistribution as Record<RankedTier, number>,
          dailyActiveUsers: season.analytics.dailyActiveUsers as { date: string; count: number }[],
          weeklyActiveUsers: season.analytics.weeklyActiveUsers as { week: string; count: number }[],
          monthlyActiveUsers: season.analytics.monthlyActiveUsers as { month: string; count: number }[],
        }
      : null;

    return {
      season: season as unknown as Season,
      analytics: analytics as SeasonAnalytics | null,
      recentActivity: recentLogs.map((log) => ({
        ...log,
        action: this.mapPrismaAuditAction(log.action),
        previousState: log.previousState as Record<string, unknown> | null,
        newState: log.newState as Record<string, unknown> | null,
        metadata: log.metadata as Record<string, unknown>,
      })) as SeasonAuditLog[],
      healthStatus: {
        isHealthy: healthStatus.isHealthy,
        warnings: healthStatus.warnings,
      },
    };
  }

  public async bulkResetPlayers(
    seasonId: string,
    playerIds: string[],
    actorId: string
  ): Promise<BulkOperationResult> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const errors: BulkOperationError[] = [];
    let successful = 0;

    for (const playerId of playerIds) {
      try {
        const playerSeason = await this.prisma.playerSeason.findUnique({
          where: {
            playerId_seasonId: { playerId, seasonId },
          },
        });

        if (!playerSeason) {
          errors.push({ playerId, error: 'Player season not found' });
          continue;
        }

        await this.prisma.playerSeason.update({
          where: { id: playerSeason.id },
          data: {
            mmr: 1200,
            peakMmr: 1200,
            tier: 'BRONZE',
            division: 4,
            leaguePoints: 0,
            wins: 0,
            losses: 0,
            placementMatchesPlayed: 0,
            placementMatchesWon: 0,
            isPlacementComplete: false,
            winStreak: 0,
            lossStreak: 0,
            isInPromos: false,
            promoWins: 0,
            promoLosses: 0,
          },
        });

        successful++;
      } catch (error) {
        errors.push({ playerId, error: String(error) });
      }
    }

    await lifecycleService.createAuditLog(seasonId, AuditAction.BULK_OPERATION, actorId, {
      metadata: {
        operation: 'BULK_RESET_PLAYERS',
        totalProcessed: playerIds.length,
        successful,
        failed: errors.length,
      },
    });

    logger.info(`Bulk reset ${successful}/${playerIds.length} players in season ${seasonId}`);

    return {
      operationType: 'BULK_RESET_PLAYERS',
      totalProcessed: playerIds.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  public async bulkDistributeRewards(
    seasonId: string,
    actorId: string
  ): Promise<BulkOperationResult> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        seasonRewards: true,
      },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId },
    });

    const errors: BulkOperationError[] = [];
    let successful = 0;

    for (const player of players) {
      try {
        const tierRewards = season.seasonRewards.filter(
          (r) => r.minTier === player.tier || this.isTierHigherOrEqual(player.tier as unknown as RankedTier, r.minTier as unknown as RankedTier)
        );

        for (const reward of tierRewards) {
          const existingReward = await this.prisma.playerReward.findFirst({
            where: {
              playerId: player.playerId,
              seasonId,
              rewardId: reward.rewardId,
            },
          });

          if (!existingReward) {
            await this.prisma.playerReward.create({
              data: {
                id: uuidv4(),
                playerId: player.playerId,
                seasonId,
                rewardId: reward.rewardId,
                rewardType: reward.rewardType,
                rewardName: reward.rewardName,
                earnedTier: player.tier,
                quantity: reward.quantity,
              },
            });
          }
        }

        successful++;
      } catch (error) {
        errors.push({ playerId: player.playerId, error: String(error) });
      }
    }

    await lifecycleService.createAuditLog(seasonId, AuditAction.DISTRIBUTE_REWARDS, actorId, {
      metadata: {
        operation: 'BULK_DISTRIBUTE_REWARDS',
        totalProcessed: players.length,
        successful,
        failed: errors.length,
      },
    });

    logger.info(`Bulk distributed rewards to ${successful}/${players.length} players in season ${seasonId}`);

    return {
      operationType: 'BULK_DISTRIBUTE_REWARDS',
      totalProcessed: players.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  public async bulkUpdatePlayerTiers(
    seasonId: string,
    updates: { playerId: string; tier: RankedTier; division: TierDivision | null }[],
    actorId: string
  ): Promise<BulkOperationResult> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const errors: BulkOperationError[] = [];
    let successful = 0;

    for (const update of updates) {
      try {
        const playerSeason = await this.prisma.playerSeason.findUnique({
          where: {
            playerId_seasonId: { playerId: update.playerId, seasonId },
          },
        });

        if (!playerSeason) {
          errors.push({ playerId: update.playerId, error: 'Player season not found' });
          continue;
        }

        await this.prisma.playerSeason.update({
          where: { id: playerSeason.id },
          data: {
            tier: update.tier,
            division: update.division,
            previousTier: playerSeason.tier,
            previousDivision: playerSeason.division,
          },
        });

        successful++;
      } catch (error) {
        errors.push({ playerId: update.playerId, error: String(error) });
      }
    }

    await lifecycleService.createAuditLog(seasonId, AuditAction.BULK_OPERATION, actorId, {
      metadata: {
        operation: 'BULK_UPDATE_TIERS',
        totalProcessed: updates.length,
        successful,
        failed: errors.length,
      },
    });

    logger.info(`Bulk updated tiers for ${successful}/${updates.length} players in season ${seasonId}`);

    return {
      operationType: 'BULK_UPDATE_TIERS',
      totalProcessed: updates.length,
      successful,
      failed: errors.length,
      errors,
    };
  }

  public async calculateSeasonAnalytics(seasonId: string): Promise<SeasonAnalytics> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalPlayers,
      activePlayers,
      totalMatches,
      mmrStats,
      tierCounts,
      rewardsDistributed,
      rewardsClaimed,
      challengesCompleted,
    ] = await Promise.all([
      this.prisma.playerSeason.count({ where: { seasonId } }),
      this.prisma.playerSeason.count({
        where: {
          seasonId,
          lastActivityAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.matchResult.count({ where: { seasonId } }),
      this.prisma.playerSeason.aggregate({
        where: { seasonId },
        _avg: { mmr: true },
        _max: { mmr: true },
      }),
      this.prisma.playerSeason.groupBy({
        by: ['tier'],
        where: { seasonId },
        _count: true,
      }),
      this.prisma.playerReward.count({ where: { seasonId } }),
      this.prisma.playerReward.count({
        where: { seasonId, claimedAt: { not: null } },
      }),
      this.prisma.playerChallengeProgress.count({
        where: {
          isCompleted: true,
          challenge: { seasonId },
        },
      }),
    ]);

    const tierDistribution: Record<RankedTier, number> = {
      [RankedTier.BRONZE]: 0,
      [RankedTier.SILVER]: 0,
      [RankedTier.GOLD]: 0,
      [RankedTier.PLATINUM]: 0,
      [RankedTier.DIAMOND]: 0,
      [RankedTier.MASTER]: 0,
      [RankedTier.GRANDMASTER]: 0,
      [RankedTier.CHALLENGER]: 0,
    };

    for (const count of tierCounts) {
      tierDistribution[count.tier as unknown as RankedTier] = count._count;
    }

    const daysActive = Math.max(
      1,
      Math.ceil((now.getTime() - season.startDate.getTime()) / (1000 * 60 * 60 * 24))
    );

    const analyticsData = {
      totalPlayers,
      activePlayers,
      totalMatches,
      averageMatchesPerDay: totalMatches / daysActive,
      averageMMR: mmrStats._avg.mmr || 1200,
      medianMMR: mmrStats._avg.mmr || 1200,
      tierDistribution,
      dailyActiveUsers: [],
      weeklyActiveUsers: [],
      monthlyActiveUsers: [],
      retentionRate: totalPlayers > 0 ? (activePlayers / totalPlayers) * 100 : 0,
      churnRate: totalPlayers > 0 ? ((totalPlayers - activePlayers) / totalPlayers) * 100 : 0,
      rewardsDistributed,
      rewardsClaimed,
      challengesCompleted,
      peakConcurrentPlayers: 0,
      lastCalculatedAt: now,
    };

    const existingAnalytics = await this.prisma.seasonAnalytics.findUnique({
      where: { seasonId },
    });

    let analytics;
    if (existingAnalytics) {
      analytics = await this.prisma.seasonAnalytics.update({
        where: { seasonId },
        data: analyticsData,
      });
    } else {
      analytics = await this.prisma.seasonAnalytics.create({
        data: {
          id: uuidv4(),
          seasonId,
          ...analyticsData,
        },
      });
    }

    logger.info(`Calculated analytics for season ${seasonId}`);

    return {
      ...analytics,
      tierDistribution: analytics.tierDistribution as Record<RankedTier, number>,
      dailyActiveUsers: analytics.dailyActiveUsers as { date: string; count: number }[],
      weeklyActiveUsers: analytics.weeklyActiveUsers as { week: string; count: number }[],
      monthlyActiveUsers: analytics.monthlyActiveUsers as { month: string; count: number }[],
    } as SeasonAnalytics;
  }

  public async getAuditLogs(filter: AuditLogFilter): Promise<{
    data: SeasonAuditLog[];
    total: number;
  }> {
    const where: Record<string, unknown> = {};

    if (filter.seasonId) {
      where.seasonId = filter.seasonId;
    }
    if (filter.action) {
      where.action = this.mapToAuditAction(filter.action);
    }
    if (filter.actorId) {
      where.actorId = filter.actorId;
    }
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        (where.createdAt as Record<string, Date>).gte = filter.startDate;
      }
      if (filter.endDate) {
        (where.createdAt as Record<string, Date>).lte = filter.endDate;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.seasonAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.seasonAuditLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        ...log,
        action: this.mapPrismaAuditAction(log.action),
        previousState: log.previousState as Record<string, unknown> | null,
        newState: log.newState as Record<string, unknown> | null,
        metadata: log.metadata as Record<string, unknown>,
      })) as SeasonAuditLog[],
      total,
    };
  }

  public async executeEmergencyAction(
    action: EmergencyAction,
    actorId: string
  ): Promise<{ success: boolean; message: string }> {
    const season = await this.prisma.season.findUnique({
      where: { id: action.seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${action.seasonId} not found`);
    }

    let result: { success: boolean; message: string };

    switch (action.type) {
      case 'FREEZE':
        result = await this.freezeSeason(action.seasonId, actorId, action.reason);
        break;
      case 'ROLLBACK':
        result = this.rollbackSeason(action.seasonId, actorId, action.reason);
        break;
      case 'FORCE_END':
        result = await this.forceEndSeason(action.seasonId, actorId, action.reason);
        break;
      case 'PAUSE_MATCHMAKING':
        result = await this.pauseMatchmaking(action.seasonId, actorId, action.reason);
        break;
      default:
        throw new BadRequestError(`Unknown emergency action type: ${String(action.type)}`);
    }

    await lifecycleService.createAuditLog(action.seasonId, AuditAction.EMERGENCY_ACTION, actorId, {
      metadata: {
        actionType: action.type,
        reason: action.reason,
        result,
      },
    });

    return result;
  }

  private async freezeSeason(
    seasonId: string,
    actorId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        state: this.mapToSeasonState(SeasonState.PAUSED),
        isActive: false,
      },
    });

    logger.warn(`EMERGENCY: Season ${seasonId} frozen by ${actorId}. Reason: ${reason}`);

    return { success: true, message: 'Season frozen successfully' };
  }

  private rollbackSeason(
    seasonId: string,
    actorId: string,
    reason: string
  ): { success: boolean; message: string } {
    logger.warn(`EMERGENCY: Season ${seasonId} rollback requested by ${actorId}. Reason: ${reason}`);

    return {
      success: false,
      message: 'Rollback requires manual intervention. Season has been frozen.',
    };
  }

  private async forceEndSeason(
    seasonId: string,
    actorId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        state: this.mapToSeasonState(SeasonState.ENDED),
        isActive: false,
        endDate: new Date(),
      },
    });

    logger.warn(`EMERGENCY: Season ${seasonId} force ended by ${actorId}. Reason: ${reason}`);

    return { success: true, message: 'Season force ended successfully' };
  }

  private async pauseMatchmaking(
    seasonId: string,
    actorId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    await this.prisma.seasonRule.updateMany({
      where: {
        seasonId,
        ruleType: 'MATCHMAKING',
      },
      data: {
        isEnabled: false,
      },
    });

    logger.warn(`EMERGENCY: Matchmaking paused for season ${seasonId} by ${actorId}. Reason: ${reason}`);

    return { success: true, message: 'Matchmaking paused successfully' };
  }

  private isTierHigherOrEqual(playerTier: RankedTier, requiredTier: RankedTier): boolean {
    const tierOrder: RankedTier[] = [
      RankedTier.BRONZE,
      RankedTier.SILVER,
      RankedTier.GOLD,
      RankedTier.PLATINUM,
      RankedTier.DIAMOND,
      RankedTier.MASTER,
      RankedTier.GRANDMASTER,
      RankedTier.CHALLENGER,
    ];

    return tierOrder.indexOf(playerTier) >= tierOrder.indexOf(requiredTier);
  }

  public async getAllSeasons(
    page = 1,
    limit = 20,
    state?: SeasonState
  ): Promise<{ data: Season[]; total: number }> {
    const skip = (page - 1) * limit;
    const where = state ? { state: this.mapToSeasonState(state) } : {};

    const [seasons, total] = await Promise.all([
      this.prisma.season.findMany({
        where,
        orderBy: { number: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.season.count({ where }),
    ]);

    return {
      data: seasons as unknown as Season[],
      total,
    };
  }

  public async exportSeasonData(seasonId: string): Promise<{
    season: Season;
    players: { playerId: string; mmr: number; tier: string; wins: number; losses: number }[];
    rewards: { playerId: string; rewardId: string; rewardName: string; claimed: boolean }[];
    matches: number;
  }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const [players, rewards, matchCount] = await Promise.all([
      this.prisma.playerSeason.findMany({
        where: { seasonId },
        select: {
          playerId: true,
          mmr: true,
          tier: true,
          wins: true,
          losses: true,
        },
      }),
      this.prisma.playerReward.findMany({
        where: { seasonId },
        select: {
          playerId: true,
          rewardId: true,
          rewardName: true,
          claimedAt: true,
        },
      }),
      this.prisma.matchResult.count({ where: { seasonId } }),
    ]);

    logger.info(`Exported data for season ${seasonId}`);

    return {
      season: season as unknown as Season,
      players: players.map((p) => ({
        playerId: p.playerId,
        mmr: p.mmr,
        tier: p.tier,
        wins: p.wins,
        losses: p.losses,
      })),
      rewards: rewards.map((r) => ({
        playerId: r.playerId,
        rewardId: r.rewardId,
        rewardName: r.rewardName,
        claimed: r.claimedAt !== null,
      })),
      matches: matchCount,
    };
  }
}

export const adminService = new AdminService();
