import { PrismaClient, RankedTier as PrismaRankedTier, RewardType as PrismaRewardType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import {
  RankedTier,
  RewardType,
  SeasonReward,
  PlayerReward,
  CreateRewardDTO,
} from '../types';

export class RewardsService {
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

  private mapToRankedTier(tier: RankedTier): PrismaRankedTier {
    return tier as PrismaRankedTier;
  }

  private mapPrismaRewardType(type: PrismaRewardType): RewardType {
    return type as RewardType;
  }

  private mapToRewardType(type: RewardType): PrismaRewardType {
    return type as PrismaRewardType;
  }

  public async createSeasonReward(data: CreateRewardDTO): Promise<SeasonReward> {
    const season = await this.prisma.season.findUnique({
      where: { id: data.seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${data.seasonId} not found`);
    }

    const reward = await this.prisma.seasonReward.create({
      data: {
        id: uuidv4(),
        seasonId: data.seasonId,
        tier: this.mapToRankedTier(data.tier),
        rewardType: this.mapToRewardType(data.rewardType),
        rewardId: data.rewardId,
        rewardName: data.rewardName,
        rewardDescription: data.rewardDescription,
        quantity: data.quantity,
        isExclusive: data.isExclusive ?? false,
      },
    });

    logger.info(`Created season reward: ${reward.rewardName} for tier ${reward.tier}`);

    return {
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    } as SeasonReward;
  }

  public async getSeasonRewards(seasonId: string): Promise<SeasonReward[]> {
    const rewards = await this.prisma.seasonReward.findMany({
      where: { seasonId },
      orderBy: [{ tier: 'asc' }, { rewardType: 'asc' }],
    });

    return rewards.map((reward) => ({
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    })) as SeasonReward[];
  }

  public async getRewardsForTier(seasonId: string, tier: RankedTier): Promise<SeasonReward[]> {
    const tierIndex = this.tierOrder.indexOf(tier);
    const eligibleTiers = this.tierOrder.slice(0, tierIndex + 1);

    const rewards = await this.prisma.seasonReward.findMany({
      where: {
        seasonId,
        tier: { in: eligibleTiers.map((t) => this.mapToRankedTier(t)) },
      },
      orderBy: [{ tier: 'asc' }, { rewardType: 'asc' }],
    });

    return rewards.map((reward) => ({
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    })) as SeasonReward[];
  }

  public async distributeSeasonRewards(seasonId: string): Promise<{ distributed: number; players: string[] }> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (season.isActive) {
      throw new BadRequestError('Cannot distribute rewards for an active season');
    }

    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId, isPlacementComplete: true },
    });

    const seasonRewards = await this.prisma.seasonReward.findMany({
      where: { seasonId },
    });

    const playerRewardsToCreate: Array<{
      id: string;
      playerId: string;
      seasonId: string;
      rewardId: string;
      rewardType: PrismaRewardType;
      rewardName: string;
      earnedTier: PrismaRankedTier;
    }> = [];

    for (const player of players) {
      const playerTier = this.mapPrismaTier(player.tier);
      const eligibleRewards = seasonRewards.filter((reward) => {
        const rewardTierIndex = this.tierOrder.indexOf(this.mapPrismaTier(reward.tier));
        const playerTierIndex = this.tierOrder.indexOf(playerTier);
        return playerTierIndex >= rewardTierIndex;
      });

      for (const reward of eligibleRewards) {
        playerRewardsToCreate.push({
          id: uuidv4(),
          playerId: player.playerId,
          seasonId,
          rewardId: reward.rewardId,
          rewardType: reward.rewardType,
          rewardName: reward.rewardName,
          earnedTier: player.tier,
        });
      }
    }

    if (playerRewardsToCreate.length > 0) {
      await this.prisma.playerReward.createMany({
        data: playerRewardsToCreate,
        skipDuplicates: true,
      });
    }

    const distributedPlayers = [...new Set(playerRewardsToCreate.map((r) => r.playerId))];

    logger.info(`Distributed ${playerRewardsToCreate.length} rewards to ${distributedPlayers.length} players for season ${season.number}`);

    return {
      distributed: playerRewardsToCreate.length,
      players: distributedPlayers,
    };
  }

  public async getPlayerRewards(playerId: string, seasonId?: string): Promise<PlayerReward[]> {
    const where = seasonId ? { playerId, seasonId } : { playerId };

    const rewards = await this.prisma.playerReward.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return rewards.map((reward) => ({
      ...reward,
      rewardType: this.mapPrismaRewardType(reward.rewardType),
      earnedTier: this.mapPrismaTier(reward.earnedTier),
    })) as PlayerReward[];
  }

  public async claimReward(playerId: string, rewardId: string): Promise<PlayerReward> {
    const reward = await this.prisma.playerReward.findFirst({
      where: { playerId, rewardId },
    });

    if (!reward) {
      throw new NotFoundError('Reward not found for this player');
    }

    if (reward.claimedAt) {
      throw new BadRequestError('Reward has already been claimed');
    }

    const updatedReward = await this.prisma.playerReward.update({
      where: { id: reward.id },
      data: { claimedAt: new Date() },
    });

    logger.info(`Player ${playerId} claimed reward ${rewardId}`);

    return {
      ...updatedReward,
      rewardType: this.mapPrismaRewardType(updatedReward.rewardType),
      earnedTier: this.mapPrismaTier(updatedReward.earnedTier),
    } as PlayerReward;
  }

  public async getUnclaimedRewards(playerId: string): Promise<PlayerReward[]> {
    const rewards = await this.prisma.playerReward.findMany({
      where: { playerId, claimedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return rewards.map((reward) => ({
      ...reward,
      rewardType: this.mapPrismaRewardType(reward.rewardType),
      earnedTier: this.mapPrismaTier(reward.earnedTier),
    })) as PlayerReward[];
  }

  public async setupDefaultSeasonRewards(seasonId: string): Promise<SeasonReward[]> {
    const defaultRewards: Omit<CreateRewardDTO, 'seasonId'>[] = [
      { tier: RankedTier.BRONZE, rewardType: RewardType.ICON, rewardId: 'icon_bronze', rewardName: 'Bronze Icon', rewardDescription: 'Season ranked icon for Bronze tier', quantity: 1 },
      { tier: RankedTier.BRONZE, rewardType: RewardType.CURRENCY, rewardId: 'currency_bronze', rewardName: 'Bronze Reward', rewardDescription: '100 coins for reaching Bronze', quantity: 100 },
      { tier: RankedTier.SILVER, rewardType: RewardType.ICON, rewardId: 'icon_silver', rewardName: 'Silver Icon', rewardDescription: 'Season ranked icon for Silver tier', quantity: 1 },
      { tier: RankedTier.SILVER, rewardType: RewardType.CURRENCY, rewardId: 'currency_silver', rewardName: 'Silver Reward', rewardDescription: '250 coins for reaching Silver', quantity: 250 },
      { tier: RankedTier.GOLD, rewardType: RewardType.ICON, rewardId: 'icon_gold', rewardName: 'Gold Icon', rewardDescription: 'Season ranked icon for Gold tier', quantity: 1 },
      { tier: RankedTier.GOLD, rewardType: RewardType.BORDER, rewardId: 'border_gold', rewardName: 'Gold Border', rewardDescription: 'Profile border for Gold tier', quantity: 1 },
      { tier: RankedTier.GOLD, rewardType: RewardType.CURRENCY, rewardId: 'currency_gold', rewardName: 'Gold Reward', rewardDescription: '500 coins for reaching Gold', quantity: 500 },
      { tier: RankedTier.PLATINUM, rewardType: RewardType.ICON, rewardId: 'icon_platinum', rewardName: 'Platinum Icon', rewardDescription: 'Season ranked icon for Platinum tier', quantity: 1 },
      { tier: RankedTier.PLATINUM, rewardType: RewardType.BORDER, rewardId: 'border_platinum', rewardName: 'Platinum Border', rewardDescription: 'Profile border for Platinum tier', quantity: 1 },
      { tier: RankedTier.PLATINUM, rewardType: RewardType.CURRENCY, rewardId: 'currency_platinum', rewardName: 'Platinum Reward', rewardDescription: '1000 coins for reaching Platinum', quantity: 1000 },
      { tier: RankedTier.DIAMOND, rewardType: RewardType.ICON, rewardId: 'icon_diamond', rewardName: 'Diamond Icon', rewardDescription: 'Season ranked icon for Diamond tier', quantity: 1 },
      { tier: RankedTier.DIAMOND, rewardType: RewardType.BORDER, rewardId: 'border_diamond', rewardName: 'Diamond Border', rewardDescription: 'Profile border for Diamond tier', quantity: 1 },
      { tier: RankedTier.DIAMOND, rewardType: RewardType.SKIN, rewardId: 'skin_diamond', rewardName: 'Diamond Skin', rewardDescription: 'Exclusive skin for Diamond tier', quantity: 1 },
      { tier: RankedTier.DIAMOND, rewardType: RewardType.CURRENCY, rewardId: 'currency_diamond', rewardName: 'Diamond Reward', rewardDescription: '2000 coins for reaching Diamond', quantity: 2000 },
      { tier: RankedTier.MASTER, rewardType: RewardType.ICON, rewardId: 'icon_master', rewardName: 'Master Icon', rewardDescription: 'Season ranked icon for Master tier', quantity: 1 },
      { tier: RankedTier.MASTER, rewardType: RewardType.BORDER, rewardId: 'border_master', rewardName: 'Master Border', rewardDescription: 'Profile border for Master tier', quantity: 1 },
      { tier: RankedTier.MASTER, rewardType: RewardType.SKIN, rewardId: 'skin_master', rewardName: 'Master Skin', rewardDescription: 'Exclusive skin for Master tier', quantity: 1 },
      { tier: RankedTier.MASTER, rewardType: RewardType.TITLE, rewardId: 'title_master', rewardName: 'Master Title', rewardDescription: 'In-game title for Master tier', quantity: 1 },
      { tier: RankedTier.MASTER, rewardType: RewardType.CURRENCY, rewardId: 'currency_master', rewardName: 'Master Reward', rewardDescription: '5000 coins for reaching Master', quantity: 5000 },
      { tier: RankedTier.GRANDMASTER, rewardType: RewardType.ICON, rewardId: 'icon_grandmaster', rewardName: 'Grandmaster Icon', rewardDescription: 'Season ranked icon for Grandmaster tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.GRANDMASTER, rewardType: RewardType.BORDER, rewardId: 'border_grandmaster', rewardName: 'Grandmaster Border', rewardDescription: 'Profile border for Grandmaster tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.GRANDMASTER, rewardType: RewardType.SKIN, rewardId: 'skin_grandmaster', rewardName: 'Grandmaster Skin', rewardDescription: 'Exclusive skin for Grandmaster tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.GRANDMASTER, rewardType: RewardType.TITLE, rewardId: 'title_grandmaster', rewardName: 'Grandmaster Title', rewardDescription: 'In-game title for Grandmaster tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.GRANDMASTER, rewardType: RewardType.CURRENCY, rewardId: 'currency_grandmaster', rewardName: 'Grandmaster Reward', rewardDescription: '10000 coins for reaching Grandmaster', quantity: 10000 },
      { tier: RankedTier.CHALLENGER, rewardType: RewardType.ICON, rewardId: 'icon_challenger', rewardName: 'Challenger Icon', rewardDescription: 'Season ranked icon for Challenger tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.CHALLENGER, rewardType: RewardType.BORDER, rewardId: 'border_challenger', rewardName: 'Challenger Border', rewardDescription: 'Profile border for Challenger tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.CHALLENGER, rewardType: RewardType.SKIN, rewardId: 'skin_challenger', rewardName: 'Challenger Skin', rewardDescription: 'Exclusive skin for Challenger tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.CHALLENGER, rewardType: RewardType.TITLE, rewardId: 'title_challenger', rewardName: 'Challenger Title', rewardDescription: 'In-game title for Challenger tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.CHALLENGER, rewardType: RewardType.EMOTE, rewardId: 'emote_challenger', rewardName: 'Challenger Emote', rewardDescription: 'Exclusive emote for Challenger tier', quantity: 1, isExclusive: true },
      { tier: RankedTier.CHALLENGER, rewardType: RewardType.CURRENCY, rewardId: 'currency_challenger', rewardName: 'Challenger Reward', rewardDescription: '25000 coins for reaching Challenger', quantity: 25000 },
    ];

    const createdRewards: SeasonReward[] = [];

    for (const rewardData of defaultRewards) {
      try {
        const reward = await this.createSeasonReward({
          ...rewardData,
          seasonId,
        });
        createdRewards.push(reward);
      } catch (error) {
        logger.warn(`Failed to create reward ${rewardData.rewardName}: ${String(error)}`);
      }
    }

    logger.info(`Setup ${createdRewards.length} default rewards for season ${seasonId}`);
    return createdRewards;
  }
}

export const rewardsService = new RewardsService();
