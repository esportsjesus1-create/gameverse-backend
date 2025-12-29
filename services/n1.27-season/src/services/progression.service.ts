import { PrismaClient, RankedTier as PrismaRankedTier, MilestoneType as PrismaMilestoneType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { config } from '../config';
import { mmrService } from './mmr.service';
import { tierService } from './tier.service';
import {
  RankedTier,
  TierDivision,
  MilestoneType,
  PlayerMilestone,
  PlayerProgression,
  PlayerStats,
  MilestoneConfig,
  ResetType,
  SeasonResetResult,
  PlayerSeasonHistory,
  PlayerLifetimeStats,
  PlayerInventoryCarryover,
  CarryoverItem,
} from '../types';

export class ProgressionService {
  private prisma: PrismaClient;

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

  private readonly milestoneConfigs: MilestoneConfig[] = [
    { type: MilestoneType.FIRST_WIN, threshold: 1 },
    { type: MilestoneType.WIN_STREAK, threshold: 3 },
    { type: MilestoneType.WIN_STREAK, threshold: 5 },
    { type: MilestoneType.WIN_STREAK, threshold: 10 },
    { type: MilestoneType.GAMES_PLAYED, threshold: 10 },
    { type: MilestoneType.GAMES_PLAYED, threshold: 50 },
    { type: MilestoneType.GAMES_PLAYED, threshold: 100 },
    { type: MilestoneType.GAMES_PLAYED, threshold: 500 },
    { type: MilestoneType.TIER_REACHED, threshold: 1 },
    { type: MilestoneType.TIER_REACHED, threshold: 2 },
    { type: MilestoneType.TIER_REACHED, threshold: 3 },
    { type: MilestoneType.TIER_REACHED, threshold: 4 },
    { type: MilestoneType.TIER_REACHED, threshold: 5 },
    { type: MilestoneType.TIER_REACHED, threshold: 6 },
    { type: MilestoneType.TIER_REACHED, threshold: 7 },
    { type: MilestoneType.PEAK_MMR, threshold: 1500 },
    { type: MilestoneType.PEAK_MMR, threshold: 2000 },
    { type: MilestoneType.PEAK_MMR, threshold: 2500 },
    { type: MilestoneType.PEAK_MMR, threshold: 3000 },
    { type: MilestoneType.PLACEMENT_COMPLETE, threshold: 1 },
  ];

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private mapPrismaTier(tier: PrismaRankedTier): RankedTier {
    return tier as RankedTier;
  }

  private mapToRankedTier(tier: RankedTier): PrismaRankedTier {
    return tier as PrismaRankedTier;
  }

  private mapPrismaMilestoneType(type: PrismaMilestoneType): MilestoneType {
    return type as MilestoneType;
  }

  private mapToMilestoneType(type: MilestoneType): PrismaMilestoneType {
    return type as PrismaMilestoneType;
  }

  public async recordProgression(
    playerId: string,
    seasonId: string,
    mmr: number,
    tier: RankedTier,
    division: TierDivision | null,
    wins: number,
    losses: number
  ): Promise<PlayerProgression> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingRecord = await this.prisma.playerProgression.findFirst({
      where: {
        playerId,
        seasonId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existingRecord) {
      const updated = await this.prisma.playerProgression.update({
        where: { id: existingRecord.id },
        data: {
          mmr,
          tier: this.mapToRankedTier(tier),
          division,
          wins,
          losses,
        },
      });

      return {
        ...updated,
        tier: this.mapPrismaTier(updated.tier),
        division: updated.division as TierDivision | null,
      } as PlayerProgression;
    }

    const progression = await this.prisma.playerProgression.create({
      data: {
        id: uuidv4(),
        playerId,
        seasonId,
        date: today,
        mmr,
        tier: this.mapToRankedTier(tier),
        division,
        wins,
        losses,
      },
    });

    return {
      ...progression,
      tier: this.mapPrismaTier(progression.tier),
      division: progression.division as TierDivision | null,
    } as PlayerProgression;
  }

  public async getPlayerProgression(
    playerId: string,
    seasonId: string,
    days = 30
  ): Promise<PlayerProgression[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const progressions = await this.prisma.playerProgression.findMany({
      where: {
        playerId,
        seasonId,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    return progressions.map((p) => ({
      ...p,
      tier: this.mapPrismaTier(p.tier),
      division: p.division as TierDivision | null,
    })) as PlayerProgression[];
  }

  public async checkAndAwardMilestones(
    playerId: string,
    seasonId: string,
    wins: number,
    losses: number,
    winStreak: number,
    tier: RankedTier,
    peakMmr: number,
    isPlacementComplete: boolean
  ): Promise<PlayerMilestone[]> {
    const newMilestones: PlayerMilestone[] = [];
    const totalGames = wins + losses;
    const tierIndex = this.tierOrder.indexOf(tier);

    for (const config of this.milestoneConfigs) {
      let shouldAward = false;
      let milestoneValue = config.threshold;

      switch (config.type) {
        case MilestoneType.FIRST_WIN:
          shouldAward = wins >= 1;
          milestoneValue = 1;
          break;
        case MilestoneType.WIN_STREAK:
          shouldAward = winStreak >= config.threshold;
          milestoneValue = config.threshold;
          break;
        case MilestoneType.GAMES_PLAYED:
          shouldAward = totalGames >= config.threshold;
          milestoneValue = config.threshold;
          break;
        case MilestoneType.TIER_REACHED:
          shouldAward = tierIndex >= config.threshold;
          milestoneValue = config.threshold;
          break;
        case MilestoneType.PEAK_MMR:
          shouldAward = peakMmr >= config.threshold;
          milestoneValue = config.threshold;
          break;
        case MilestoneType.PLACEMENT_COMPLETE:
          shouldAward = isPlacementComplete;
          milestoneValue = 1;
          break;
      }

      if (shouldAward) {
        const existing = await this.prisma.playerMilestone.findUnique({
          where: {
            playerId_seasonId_milestoneType_milestoneValue: {
              playerId,
              seasonId,
              milestoneType: this.mapToMilestoneType(config.type),
              milestoneValue,
            },
          },
        });

        if (!existing) {
          const milestone = await this.prisma.playerMilestone.create({
            data: {
              id: uuidv4(),
              playerId,
              seasonId,
              milestoneType: this.mapToMilestoneType(config.type),
              milestoneValue,
              achievedAt: new Date(),
            },
          });

          newMilestones.push({
            ...milestone,
            milestoneType: this.mapPrismaMilestoneType(milestone.milestoneType),
          } as PlayerMilestone);

          logger.info(`Player ${playerId} achieved milestone: ${config.type} (${milestoneValue})`);
        }
      }
    }

    return newMilestones;
  }

  public async getPlayerMilestones(playerId: string, seasonId?: string): Promise<PlayerMilestone[]> {
    const where = seasonId ? { playerId, seasonId } : { playerId };

    const milestones = await this.prisma.playerMilestone.findMany({
      where,
      orderBy: { achievedAt: 'desc' },
    });

    return milestones.map((m) => ({
      ...m,
      milestoneType: this.mapPrismaMilestoneType(m.milestoneType),
    })) as PlayerMilestone[];
  }

  public async updatePlayerStats(
    playerId: string,
    seasonId: string,
    mmrChange: number,
    winStreak: number,
    lossStreak: number,
    tier: RankedTier,
    division: TierDivision | null
  ): Promise<void> {
    const existingStats = await this.prisma.playerStats.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!existingStats) {
      await this.prisma.playerStats.create({
        data: {
          id: uuidv4(),
          playerId,
          seasonId,
          longestWinStreak: winStreak,
          longestLossStreak: lossStreak,
          peakTier: this.mapToRankedTier(tier),
          peakDivision: division,
          totalMMRGained: mmrChange > 0 ? mmrChange : 0,
          totalMMRLost: mmrChange < 0 ? Math.abs(mmrChange) : 0,
          gamesWithMMRGain: mmrChange > 0 ? 1 : 0,
          gamesWithMMRLoss: mmrChange < 0 ? 1 : 0,
        },
      });
      return;
    }

    const currentTierIndex = this.tierOrder.indexOf(this.mapPrismaTier(existingStats.peakTier));
    const newTierIndex = this.tierOrder.indexOf(tier);
    const existingPeakDivision = existingStats.peakDivision as TierDivision | null;
    const isHigherTier = newTierIndex > currentTierIndex ||
      (newTierIndex === currentTierIndex && division !== null && existingPeakDivision !== null && division < existingPeakDivision);

    await this.prisma.playerStats.update({
      where: { id: existingStats.id },
      data: {
        longestWinStreak: Math.max(existingStats.longestWinStreak, winStreak),
        longestLossStreak: Math.max(existingStats.longestLossStreak, lossStreak),
        peakTier: isHigherTier ? this.mapToRankedTier(tier) : existingStats.peakTier,
        peakDivision: isHigherTier ? division : existingStats.peakDivision,
        totalMMRGained: existingStats.totalMMRGained + (mmrChange > 0 ? mmrChange : 0),
        totalMMRLost: existingStats.totalMMRLost + (mmrChange < 0 ? Math.abs(mmrChange) : 0),
        gamesWithMMRGain: existingStats.gamesWithMMRGain + (mmrChange > 0 ? 1 : 0),
        gamesWithMMRLoss: existingStats.gamesWithMMRLoss + (mmrChange < 0 ? 1 : 0),
      },
    });
  }

  public async getPlayerStats(playerId: string, seasonId: string): Promise<PlayerStats | null> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      return null;
    }

    const stats = await this.prisma.playerStats.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    const milestones = await this.prisma.playerMilestone.count({
      where: { playerId, seasonId },
    });

    const rewards = await this.prisma.playerReward.count({
      where: { playerId, seasonId },
    });

    const totalGames = playerSeason.wins + playerSeason.losses;

    return {
      playerId,
      seasonId,
      totalGames,
      wins: playerSeason.wins,
      losses: playerSeason.losses,
      winRate: totalGames > 0 ? Math.round((playerSeason.wins / totalGames) * 100) : 0,
      currentMMR: playerSeason.mmr,
      peakMMR: playerSeason.peakMmr,
      currentTier: this.mapPrismaTier(playerSeason.tier),
      currentDivision: playerSeason.division as TierDivision | null,
      peakTier: stats ? this.mapPrismaTier(stats.peakTier) : this.mapPrismaTier(playerSeason.tier),
      peakDivision: stats ? (stats.peakDivision as TierDivision | null) : (playerSeason.division as TierDivision | null),
      longestWinStreak: stats?.longestWinStreak ?? playerSeason.winStreak,
      longestLossStreak: stats?.longestLossStreak ?? playerSeason.lossStreak,
      averageMMRGain: stats && stats.gamesWithMMRGain > 0
        ? Math.round(stats.totalMMRGained / stats.gamesWithMMRGain)
        : 0,
      averageMMRLoss: stats && stats.gamesWithMMRLoss > 0
        ? Math.round(stats.totalMMRLost / stats.gamesWithMMRLoss)
        : 0,
      milestonesAchieved: milestones,
      rewardsEarned: rewards,
    };
  }

  public async getSeasonSummary(seasonId: string): Promise<{
    totalPlayers: number;
    totalGames: number;
    averageMMR: number;
    tierDistribution: Record<RankedTier, number>;
    topPlayers: Array<{ playerId: string; mmr: number; tier: RankedTier }>;
  }> {
    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId, isPlacementComplete: true },
    });

    const totalPlayers = players.length;
    const totalGames = players.reduce((sum, p) => sum + p.wins + p.losses, 0) / 2;
    const averageMMR = totalPlayers > 0
      ? Math.round(players.reduce((sum, p) => sum + p.mmr, 0) / totalPlayers)
      : 0;

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

    for (const player of players) {
      const tier = this.mapPrismaTier(player.tier);
      tierDistribution[tier]++;
    }

    const topPlayers = players
      .sort((a, b) => b.mmr - a.mmr)
      .slice(0, 10)
      .map((p) => ({
        playerId: p.playerId,
        mmr: p.mmr,
        tier: this.mapPrismaTier(p.tier),
      }));

    return {
      totalPlayers,
      totalGames,
      averageMMR,
      tierDistribution,
      topPlayers,
    };
  }

  public async performSoftReset(
    playerId: string,
    fromSeasonId: string,
    toSeasonId: string,
    resetFactor: number
  ): Promise<SeasonResetResult> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId: fromSeasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found for player ${playerId}`);
    }

    const newMmr = mmrService.calculateSoftReset({
      currentMmr: playerSeason.mmr,
      baseMmr: config.DEFAULT_MMR,
      resetFactor,
    });

    const { tier: newTier, division: newDivision } = tierService.getTierFromMMR(newMmr);

    await this.prisma.playerSeason.create({
      data: {
        id: uuidv4(),
        playerId,
        seasonId: toSeasonId,
        mmr: newMmr,
        peakMmr: newMmr,
        tier: this.mapToRankedTier(newTier),
        division: newDivision,
        previousTier: playerSeason.tier,
        previousDivision: playerSeason.division,
        gamerstakePlayerId: playerSeason.gamerstakePlayerId,
      },
    });

    logger.info(`Soft reset player ${playerId}: ${playerSeason.mmr} -> ${newMmr}`);

    return {
      playerId,
      previousMmr: playerSeason.mmr,
      newMmr,
      previousTier: this.mapPrismaTier(playerSeason.tier),
      newTier,
      previousDivision: playerSeason.division as TierDivision | null,
      newDivision,
    };
  }

  public async performHardReset(
    playerId: string,
    fromSeasonId: string,
    toSeasonId: string
  ): Promise<SeasonResetResult> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId: fromSeasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found for player ${playerId}`);
    }

    const newMmr = config.DEFAULT_MMR;
    const { tier: newTier, division: newDivision } = tierService.getTierFromMMR(newMmr);

    await this.prisma.playerSeason.create({
      data: {
        id: uuidv4(),
        playerId,
        seasonId: toSeasonId,
        mmr: newMmr,
        peakMmr: newMmr,
        tier: this.mapToRankedTier(newTier),
        division: newDivision,
        previousTier: playerSeason.tier,
        previousDivision: playerSeason.division,
        gamerstakePlayerId: playerSeason.gamerstakePlayerId,
      },
    });

    logger.info(`Hard reset player ${playerId}: ${playerSeason.mmr} -> ${newMmr}`);

    return {
      playerId,
      previousMmr: playerSeason.mmr,
      newMmr,
      previousTier: this.mapPrismaTier(playerSeason.tier),
      newTier,
      previousDivision: playerSeason.division as TierDivision | null,
      newDivision,
    };
  }

  public async performBulkReset(
    fromSeasonId: string,
    toSeasonId: string,
    resetType: ResetType,
    resetFactor: number
  ): Promise<SeasonResetResult[]> {
    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId: fromSeasonId },
    });

    const results: SeasonResetResult[] = [];

    for (const player of players) {
      let result: SeasonResetResult;

      if (resetType === ResetType.HARD) {
        result = await this.performHardReset(player.playerId, fromSeasonId, toSeasonId);
      } else if (resetType === ResetType.SOFT) {
        result = await this.performSoftReset(player.playerId, fromSeasonId, toSeasonId, resetFactor);
      } else {
        const newMmr = player.mmr;
        const { tier: newTier, division: newDivision } = tierService.getTierFromMMR(newMmr);

        await this.prisma.playerSeason.create({
          data: {
            id: uuidv4(),
            playerId: player.playerId,
            seasonId: toSeasonId,
            mmr: newMmr,
            peakMmr: newMmr,
            tier: this.mapToRankedTier(newTier),
            division: newDivision,
            previousTier: player.tier,
            previousDivision: player.division,
            gamerstakePlayerId: player.gamerstakePlayerId,
          },
        });

        result = {
          playerId: player.playerId,
          previousMmr: player.mmr,
          newMmr,
          previousTier: this.mapPrismaTier(player.tier),
          newTier,
          previousDivision: player.division as TierDivision | null,
          newDivision,
        };
      }

      results.push(result);
    }

    logger.info(`Bulk ${resetType} reset completed for ${results.length} players`);

    return results;
  }

  public async applyMMRFloorCeiling(
    playerId: string,
    seasonId: string,
    mmrFloor: number,
    mmrCeiling: number
  ): Promise<{ adjusted: boolean; previousMmr: number; newMmr: number }> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    let newMmr = playerSeason.mmr;
    let adjusted = false;

    if (newMmr < mmrFloor) {
      newMmr = mmrFloor;
      adjusted = true;
    } else if (newMmr > mmrCeiling) {
      newMmr = mmrCeiling;
      adjusted = true;
    }

    if (adjusted) {
      const { tier, division } = tierService.getTierFromMMR(newMmr);

      await this.prisma.playerSeason.update({
        where: { id: playerSeason.id },
        data: {
          mmr: newMmr,
          tier: this.mapToRankedTier(tier),
          division,
        },
      });

      logger.info(`Applied MMR floor/ceiling to player ${playerId}: ${playerSeason.mmr} -> ${newMmr}`);
    }

    return {
      adjusted,
      previousMmr: playerSeason.mmr,
      newMmr,
    };
  }

  public async applyTierDemotionProtection(
    playerId: string,
    seasonId: string,
    _protectionGames: number
  ): Promise<boolean> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    if (playerSeason.demotionShieldGames > 0) {
      await this.prisma.playerSeason.update({
        where: { id: playerSeason.id },
        data: {
          demotionShieldGames: playerSeason.demotionShieldGames - 1,
        },
      });
      return true;
    }

    return false;
  }

  public async archivePlayerSeasonHistory(
    playerId: string,
    seasonId: string
  ): Promise<PlayerSeasonHistory> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const rank = await this.prisma.playerSeason.count({
      where: {
        seasonId,
        mmr: { gt: playerSeason.mmr },
      },
    });

    const milestones = await this.prisma.playerMilestone.findMany({
      where: { playerId, seasonId },
    });

    const rewards = await this.prisma.playerReward.findMany({
      where: { playerId, seasonId },
    });

    const challenges = await this.prisma.playerChallengeProgress.findMany({
      where: {
        playerId,
        isCompleted: true,
        challenge: { seasonId },
      },
    });

    const history = await this.prisma.playerSeasonHistory.create({
      data: {
        id: uuidv4(),
        playerId,
        seasonId,
        seasonNumber: season.number,
        seasonName: season.name,
        finalMmr: playerSeason.mmr,
        peakMmr: playerSeason.peakMmr,
        finalTier: playerSeason.tier,
        finalDivision: playerSeason.division,
        finalRank: rank + 1,
        totalWins: playerSeason.wins,
        totalLosses: playerSeason.losses,
        winRate: playerSeason.wins + playerSeason.losses > 0
          ? (playerSeason.wins / (playerSeason.wins + playerSeason.losses)) * 100
          : 0,
        playtime: 0,
        achievements: milestones.map((m) => m.milestoneType),
        rewards: rewards.map((r) => r.rewardId),
        challenges: challenges.map((c) => c.challengeId),
        carryoverItems: [],
      },
    });

    logger.info(`Archived season history for player ${playerId} in season ${season.number}`);

    return {
      ...history,
      finalTier: this.mapPrismaTier(history.finalTier),
      finalDivision: history.finalDivision as TierDivision | null,
      carryoverItems: history.carryoverItems as unknown as CarryoverItem[],
    } as PlayerSeasonHistory;
  }

  public async getPlayerSeasonHistory(playerId: string): Promise<PlayerSeasonHistory[]> {
    const histories = await this.prisma.playerSeasonHistory.findMany({
      where: { playerId },
      orderBy: { seasonNumber: 'desc' },
    });

    return histories.map((h) => ({
      ...h,
      finalTier: this.mapPrismaTier(h.finalTier),
      finalDivision: h.finalDivision as TierDivision | null,
      carryoverItems: h.carryoverItems as unknown as CarryoverItem[],
    })) as PlayerSeasonHistory[];
  }

  public async updateLifetimeStats(playerId: string, seasonId: string): Promise<PlayerLifetimeStats> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    let lifetimeStats = await this.prisma.playerLifetimeStats.findUnique({
      where: { playerId },
    });

    const rewards = await this.prisma.playerReward.count({
      where: { playerId },
    });

    const claimedRewards = await this.prisma.playerReward.count({
      where: { playerId, claimedAt: { not: null } },
    });

    const milestones = await this.prisma.playerMilestone.count({
      where: { playerId },
    });

    const challenges = await this.prisma.playerChallengeProgress.count({
      where: { playerId, isCompleted: true },
    });

    const seasonCount = await this.prisma.playerSeason.count({
      where: { playerId },
    });

    if (!lifetimeStats) {
      lifetimeStats = await this.prisma.playerLifetimeStats.create({
        data: {
          id: uuidv4(),
          playerId,
          totalSeasons: seasonCount,
          totalWins: playerSeason.wins,
          totalLosses: playerSeason.losses,
          totalMatches: playerSeason.wins + playerSeason.losses,
          highestMmr: playerSeason.peakMmr,
          highestTier: playerSeason.tier,
          highestDivision: playerSeason.division,
          totalRewardsEarned: rewards,
          totalRewardsClaimed: claimedRewards,
          achievementCount: milestones,
          challengesCompleted: challenges,
          totalPlaytime: 0,
          firstSeasonId: seasonId,
          lastActiveSeasonId: seasonId,
        },
      });
    } else {
      const currentHighestTierIndex = this.tierOrder.indexOf(this.mapPrismaTier(lifetimeStats.highestTier));
      const newTierIndex = this.tierOrder.indexOf(this.mapPrismaTier(playerSeason.tier));
      const isHigherTier = newTierIndex > currentHighestTierIndex ||
        (newTierIndex === currentHighestTierIndex &&
          playerSeason.division !== null &&
          lifetimeStats.highestDivision !== null &&
          playerSeason.division < lifetimeStats.highestDivision);

      lifetimeStats = await this.prisma.playerLifetimeStats.update({
        where: { playerId },
        data: {
          totalSeasons: seasonCount,
          totalWins: lifetimeStats.totalWins + playerSeason.wins,
          totalLosses: lifetimeStats.totalLosses + playerSeason.losses,
          totalMatches: lifetimeStats.totalMatches + playerSeason.wins + playerSeason.losses,
          highestMmr: Math.max(lifetimeStats.highestMmr, playerSeason.peakMmr),
          highestTier: isHigherTier ? playerSeason.tier : lifetimeStats.highestTier,
          highestDivision: isHigherTier ? playerSeason.division : lifetimeStats.highestDivision,
          totalRewardsEarned: rewards,
          totalRewardsClaimed: claimedRewards,
          achievementCount: milestones,
          challengesCompleted: challenges,
          lastActiveSeasonId: seasonId,
        },
      });
    }

    logger.info(`Updated lifetime stats for player ${playerId}`);

    return {
      ...lifetimeStats,
      highestTier: this.mapPrismaTier(lifetimeStats.highestTier),
      highestDivision: lifetimeStats.highestDivision as TierDivision | null,
    } as PlayerLifetimeStats;
  }

  public async getLifetimeStats(playerId: string): Promise<PlayerLifetimeStats | null> {
    const stats = await this.prisma.playerLifetimeStats.findUnique({
      where: { playerId },
    });

    if (!stats) {
      return null;
    }

    return {
      ...stats,
      highestTier: this.mapPrismaTier(stats.highestTier),
      highestDivision: stats.highestDivision as TierDivision | null,
    } as PlayerLifetimeStats;
  }

  public async carryoverInventory(
    playerId: string,
    fromSeasonId: string,
    toSeasonId: string,
    items: CarryoverItem[]
  ): Promise<PlayerInventoryCarryover[]> {
    const carryovers: PlayerInventoryCarryover[] = [];

    for (const item of items) {
      const carryover = await this.prisma.playerInventoryCarryover.create({
        data: {
          id: uuidv4(),
          playerId,
          fromSeasonId,
          toSeasonId,
          itemType: item.itemType,
          itemId: item.itemId,
          quantity: item.quantity,
          metadata: (item.metadata || {}) as Prisma.InputJsonValue,
        },
      });

      carryovers.push({
        ...carryover,
        metadata: carryover.metadata as Record<string, unknown>,
      } as PlayerInventoryCarryover);
    }

    logger.info(`Carried over ${items.length} items for player ${playerId}`);

    return carryovers;
  }

  public async getInventoryCarryovers(
    playerId: string,
    toSeasonId: string
  ): Promise<PlayerInventoryCarryover[]> {
    const carryovers = await this.prisma.playerInventoryCarryover.findMany({
      where: { playerId, toSeasonId },
    });

    return carryovers.map((c) => ({
      ...c,
      metadata: c.metadata as Record<string, unknown>,
    })) as PlayerInventoryCarryover[];
  }

  public async preventRankDecay(
    playerId: string,
    seasonId: string,
    daysProtected: number
  ): Promise<{ success: boolean; protectedUntil: Date }> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    const protectedUntil = new Date();
    protectedUntil.setDate(protectedUntil.getDate() + daysProtected);

    await this.prisma.playerSeason.update({
      where: { id: playerSeason.id },
      data: {
        isDecayProtected: true,
        lastActivityAt: protectedUntil,
      },
    });

    logger.info(`Decay protection applied to player ${playerId} until ${protectedUntil.toISOString()}`);

    return {
      success: true,
      protectedUntil,
    };
  }

  public async getPlacementMatchStatus(
    playerId: string,
    seasonId: string
  ): Promise<{
    isComplete: boolean;
    matchesPlayed: number;
    matchesRequired: number;
    wins: number;
    losses: number;
    provisionalMmr: number;
  }> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    return {
      isComplete: playerSeason.isPlacementComplete,
      matchesPlayed: playerSeason.placementMatchesPlayed,
      matchesRequired: season.placementMatchesRequired,
      wins: playerSeason.placementMatchesWon,
      losses: playerSeason.placementMatchesPlayed - playerSeason.placementMatchesWon,
      provisionalMmr: playerSeason.mmr,
    };
  }
}

export const progressionService = new ProgressionService();
