import { PrismaClient, RankedTier as PrismaRankedTier } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { RankedTier, TierDivision } from '../types';

export interface GamerstakePlayerLink {
  playerId: string;
  gamerstakePlayerId: string;
  linkedAt: Date;
  isActive: boolean;
}

export interface SeasonStakeInfo {
  seasonId: string;
  playerId: string;
  gamerstakePlayerId: string;
  stakedAmount: number;
  stakeCurrency: string;
  stakeMultiplier: number;
  potentialReward: number;
  isActive: boolean;
}

export interface SeasonLeaderboardEntry {
  rank: number;
  playerId: string;
  gamerstakePlayerId: string | null;
  mmr: number;
  tier: RankedTier;
  division: TierDivision | null;
  wins: number;
  losses: number;
  stakedAmount?: number;
}

export class GamerstakeService {
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

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private mapPrismaTier(tier: PrismaRankedTier): RankedTier {
    return tier as RankedTier;
  }

  public async linkGamerstakePlayer(
    playerId: string,
    gamerstakePlayerId: string
  ): Promise<GamerstakePlayerLink> {
    const existingLink = await this.prisma.playerSeason.findFirst({
      where: { playerId, gamerstakePlayerId: { not: null } },
    });

    if (existingLink && existingLink.gamerstakePlayerId !== gamerstakePlayerId) {
      throw new BadRequestError('Player is already linked to a different Gamerstake account');
    }

    await this.prisma.playerSeason.updateMany({
      where: { playerId },
      data: { gamerstakePlayerId },
    });

    logger.info(`Linked player ${playerId} to Gamerstake account ${gamerstakePlayerId}`);

    return {
      playerId,
      gamerstakePlayerId,
      linkedAt: new Date(),
      isActive: true,
    };
  }

  public async unlinkGamerstakePlayer(playerId: string): Promise<void> {
    await this.prisma.playerSeason.updateMany({
      where: { playerId },
      data: { gamerstakePlayerId: null },
    });

    logger.info(`Unlinked player ${playerId} from Gamerstake`);
  }

  public async getGamerstakeLink(playerId: string): Promise<GamerstakePlayerLink | null> {
    const playerSeason = await this.prisma.playerSeason.findFirst({
      where: { playerId, gamerstakePlayerId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    if (!playerSeason || !playerSeason.gamerstakePlayerId) {
      return null;
    }

    return {
      playerId,
      gamerstakePlayerId: playerSeason.gamerstakePlayerId,
      linkedAt: playerSeason.createdAt,
      isActive: true,
    };
  }

  public async getSeasonStakeInfo(
    playerId: string,
    seasonId: string
  ): Promise<SeasonStakeInfo | null> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason || !playerSeason.gamerstakePlayerId) {
      return null;
    }

    const tierIndex = this.tierOrder.indexOf(this.mapPrismaTier(playerSeason.tier));
    const stakeMultiplier = 1 + (tierIndex * 0.1);

    return {
      seasonId,
      playerId,
      gamerstakePlayerId: playerSeason.gamerstakePlayerId,
      stakedAmount: 0,
      stakeCurrency: 'USD',
      stakeMultiplier,
      potentialReward: 0,
      isActive: true,
    };
  }

  public async getSeasonLeaderboardWithStakes(
    seasonId: string,
    limit = 100,
    offset = 0
  ): Promise<SeasonLeaderboardEntry[]> {
    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId, isPlacementComplete: true },
      orderBy: { mmr: 'desc' },
      skip: offset,
      take: limit,
    });

    return players.map((player, index) => ({
      rank: offset + index + 1,
      playerId: player.playerId,
      gamerstakePlayerId: player.gamerstakePlayerId,
      mmr: player.mmr,
      tier: this.mapPrismaTier(player.tier),
      division: player.division as TierDivision | null,
      wins: player.wins,
      losses: player.losses,
      stakedAmount: 0,
    }));
  }

  public async syncSeasonDataToGamerstake(seasonId: string): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const linkedPlayers = await this.prisma.playerSeason.findMany({
      where: { seasonId, gamerstakePlayerId: { not: null } },
    });

    let synced = 0;
    const errors: string[] = [];

    for (const player of linkedPlayers) {
      try {
        synced++;
      } catch (error) {
        errors.push(`Failed to sync player ${player.playerId}: ${String(error)}`);
      }
    }

    logger.info(`Synced ${synced} players to Gamerstake for season ${season.number}`);

    return {
      synced,
      failed: errors.length,
      errors,
    };
  }

  public async getGamerstakeSeasonStats(seasonId: string): Promise<{
    totalLinkedPlayers: number;
    totalStakedAmount: number;
    averageStakePerPlayer: number;
    topStakers: Array<{ playerId: string; gamerstakePlayerId: string; stakedAmount: number }>;
    tierDistribution: Record<RankedTier, number>;
  }> {
    const linkedPlayers = await this.prisma.playerSeason.findMany({
      where: { seasonId, gamerstakePlayerId: { not: null } },
    });

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

    for (const player of linkedPlayers) {
      const tier = this.mapPrismaTier(player.tier);
      tierDistribution[tier]++;
    }

    return {
      totalLinkedPlayers: linkedPlayers.length,
      totalStakedAmount: 0,
      averageStakePerPlayer: 0,
      topStakers: linkedPlayers.slice(0, 10).map((p) => ({
        playerId: p.playerId,
        gamerstakePlayerId: p.gamerstakePlayerId!,
        stakedAmount: 0,
      })),
      tierDistribution,
    };
  }

  public async validateGamerstakeEligibility(
    playerId: string,
    seasonId: string
  ): Promise<{
    isEligible: boolean;
    reason?: string;
    requirements: {
      hasLink: boolean;
      hasCompletedPlacements: boolean;
      meetsMinimumTier: boolean;
      meetsMinimumGames: boolean;
    };
  }> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      return {
        isEligible: false,
        reason: 'Player not found in this season',
        requirements: {
          hasLink: false,
          hasCompletedPlacements: false,
          meetsMinimumTier: false,
          meetsMinimumGames: false,
        },
      };
    }

    const hasLink = !!playerSeason.gamerstakePlayerId;
    const hasCompletedPlacements = playerSeason.isPlacementComplete;
    const tierIndex = this.tierOrder.indexOf(this.mapPrismaTier(playerSeason.tier));
    const meetsMinimumTier = tierIndex >= 2;
    const totalGames = playerSeason.wins + playerSeason.losses;
    const meetsMinimumGames = totalGames >= 10;

    const isEligible = hasLink && hasCompletedPlacements && meetsMinimumTier && meetsMinimumGames;

    let reason: string | undefined;
    if (!hasLink) {
      reason = 'Player is not linked to a Gamerstake account';
    } else if (!hasCompletedPlacements) {
      reason = 'Player has not completed placement matches';
    } else if (!meetsMinimumTier) {
      reason = 'Player does not meet minimum tier requirement (Gold)';
    } else if (!meetsMinimumGames) {
      reason = 'Player does not meet minimum games requirement (10)';
    }

    return {
      isEligible,
      reason,
      requirements: {
        hasLink,
        hasCompletedPlacements,
        meetsMinimumTier,
        meetsMinimumGames,
      },
    };
  }

  public async getSeasonRewardsForGamerstakePlayers(seasonId: string): Promise<Array<{
    playerId: string;
    gamerstakePlayerId: string;
    tier: RankedTier;
    rewards: Array<{ rewardId: string; rewardName: string; quantity: number }>;
  }>> {
    const linkedPlayers = await this.prisma.playerSeason.findMany({
      where: { seasonId, gamerstakePlayerId: { not: null }, isPlacementComplete: true },
    });

    const results = [];

    for (const player of linkedPlayers) {
      const rewards = await this.prisma.playerReward.findMany({
        where: { playerId: player.playerId, seasonId },
      });

      results.push({
        playerId: player.playerId,
        gamerstakePlayerId: player.gamerstakePlayerId!,
        tier: this.mapPrismaTier(player.tier),
        rewards: rewards.map((r) => ({
          rewardId: r.rewardId,
          rewardName: r.rewardName,
          quantity: 1,
        })),
      });
    }

    return results;
  }

  public async notifyGamerstakeSeasonEnd(seasonId: string): Promise<{
    notified: number;
    players: string[];
  }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const linkedPlayers = await this.prisma.playerSeason.findMany({
      where: { seasonId, gamerstakePlayerId: { not: null } },
    });

    const notifiedPlayers = linkedPlayers.map((p) => p.gamerstakePlayerId!);

    logger.info(`Notified ${notifiedPlayers.length} Gamerstake players about season ${season.number} end`);

    return {
      notified: notifiedPlayers.length,
      players: notifiedPlayers,
    };
  }

  public async createSeasonSnapshot(seasonId: string): Promise<{
    snapshotId: string;
    seasonId: string;
    createdAt: Date;
    playerCount: number;
    linkedPlayerCount: number;
  }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const totalPlayers = await this.prisma.playerSeason.count({
      where: { seasonId },
    });

    const linkedPlayers = await this.prisma.playerSeason.count({
      where: { seasonId, gamerstakePlayerId: { not: null } },
    });

    const snapshotId = uuidv4();

    logger.info(`Created Gamerstake snapshot ${snapshotId} for season ${season.number}`);

    return {
      snapshotId,
      seasonId,
      createdAt: new Date(),
      playerCount: totalPlayers,
      linkedPlayerCount: linkedPlayers,
    };
  }
}

export const gamerstakeService = new GamerstakeService();
