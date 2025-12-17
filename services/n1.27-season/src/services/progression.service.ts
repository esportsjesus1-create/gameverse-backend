import { PrismaClient, RankedTier as PrismaRankedTier, MilestoneType as PrismaMilestoneType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import {
  RankedTier,
  TierDivision,
  MilestoneType,
  PlayerMilestone,
  PlayerProgression,
  PlayerStats,
  MilestoneConfig,
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
}

export const progressionService = new ProgressionService();
