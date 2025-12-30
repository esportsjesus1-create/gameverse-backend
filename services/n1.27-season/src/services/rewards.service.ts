import { PrismaClient, RankedTier as PrismaRankedTier, RewardType as PrismaRewardType, MilestoneType as PrismaMilestoneType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import {
  RankedTier,
  RewardType,
  MilestoneType,
  SeasonReward,
  PlayerReward,
  CreateRewardDTO,
  RewardPreview,
  RewardNotification,
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

  public async createMilestoneReward(
    seasonId: string,
    milestoneType: MilestoneType,
    milestoneValue: number,
    rewardData: Omit<CreateRewardDTO, 'seasonId' | 'tier'>
  ): Promise<SeasonReward> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const reward = await this.prisma.seasonReward.create({
      data: {
        id: uuidv4(),
        seasonId,
        tier: PrismaRankedTier.BRONZE,
        rewardType: this.mapToRewardType(rewardData.rewardType),
        rewardId: rewardData.rewardId,
        rewardName: rewardData.rewardName,
        rewardDescription: rewardData.rewardDescription,
        quantity: rewardData.quantity,
        isExclusive: rewardData.isExclusive ?? false,
        isMilestoneReward: true,
        milestoneType: milestoneType as unknown as PrismaMilestoneType,
        milestoneValue,
      },
    });

    logger.info(`Created milestone reward: ${reward.rewardName} for ${milestoneType} (${milestoneValue})`);

    return {
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    } as SeasonReward;
  }

  public async createParticipationReward(
    seasonId: string,
    minGamesRequired: number,
    rewardData: Omit<CreateRewardDTO, 'seasonId' | 'tier'>
  ): Promise<SeasonReward> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const reward = await this.prisma.seasonReward.create({
      data: {
        id: uuidv4(),
        seasonId,
        tier: PrismaRankedTier.BRONZE,
        rewardType: this.mapToRewardType(rewardData.rewardType),
        rewardId: rewardData.rewardId,
        rewardName: rewardData.rewardName,
        rewardDescription: rewardData.rewardDescription,
        quantity: rewardData.quantity,
        isExclusive: false,
        isParticipationReward: true,
        minGamesRequired,
      },
    });

    logger.info(`Created participation reward: ${reward.rewardName} (min ${minGamesRequired} games)`);

    return {
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    } as SeasonReward;
  }

  public async getRewardPreview(
    playerId: string,
    seasonId: string
  ): Promise<RewardPreview> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: { playerId_seasonId: { playerId, seasonId } },
    });

    if (!playerSeason) {
      throw new NotFoundError(`Player season not found`);
    }

    const playerTier = this.mapPrismaTier(playerSeason.tier);
    const tierIndex = this.tierOrder.indexOf(playerTier);
    const eligibleTiers = this.tierOrder.slice(0, tierIndex + 1);

    const tierRewards = await this.prisma.seasonReward.findMany({
      where: {
        seasonId,
        tier: { in: eligibleTiers.map((t) => this.mapToRankedTier(t)) },
        isMilestoneReward: false,
        isParticipationReward: false,
      },
    });

    const milestones = await this.prisma.playerMilestone.findMany({
      where: { playerId, seasonId },
    });

    const milestoneRewards = await this.prisma.seasonReward.findMany({
      where: {
        seasonId,
        isMilestoneReward: true,
      },
    });

    const earnedMilestoneRewards = milestoneRewards.filter((reward) => {
      return milestones.some(
        (m) =>
          m.milestoneType === reward.milestoneType &&
          m.milestoneValue >= (reward.milestoneValue || 0)
      );
    });

    const totalGames = playerSeason.wins + playerSeason.losses;
    const participationRewards = await this.prisma.seasonReward.findMany({
      where: {
        seasonId,
        isParticipationReward: true,
        minGamesRequired: { lte: totalGames },
      },
    });

    const allEligibleRewards = [
      ...tierRewards,
      ...earnedMilestoneRewards,
      ...participationRewards,
    ];

    const mappedRewards = allEligibleRewards.map((reward) => ({
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    })) as SeasonReward[];

    const nextTierIndex = tierIndex + 1;
    let potentialRewards: SeasonReward[] = [];

    if (nextTierIndex < this.tierOrder.length) {
      const nextTier = this.tierOrder[nextTierIndex];
      const nextTierRewards = await this.prisma.seasonReward.findMany({
        where: {
          seasonId,
          tier: this.mapToRankedTier(nextTier),
          isMilestoneReward: false,
          isParticipationReward: false,
        },
      });

      potentialRewards = nextTierRewards.map((reward) => ({
        ...reward,
        tier: this.mapPrismaTier(reward.tier),
        rewardType: this.mapPrismaRewardType(reward.rewardType),
      })) as SeasonReward[];
    }

    return {
      playerId,
      seasonId,
      currentTier: playerTier,
      eligibleRewards: mappedRewards,
      potentialRewards,
      totalValue: mappedRewards.reduce((sum, r) => sum + (r.quantity || 0), 0),
    };
  }

  public async distributeRetroactiveRewards(
    seasonId: string,
    rewardId: string
  ): Promise<{ distributed: number; players: string[] }> {
    const reward = await this.prisma.seasonReward.findFirst({
      where: { seasonId, rewardId },
    });

    if (!reward) {
      throw new NotFoundError(`Reward ${rewardId} not found in season ${seasonId}`);
    }

    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId, isPlacementComplete: true },
    });

    const eligiblePlayers = players.filter((player) => {
      const playerTierIndex = this.tierOrder.indexOf(this.mapPrismaTier(player.tier));
      const rewardTierIndex = this.tierOrder.indexOf(this.mapPrismaTier(reward.tier));
      return playerTierIndex >= rewardTierIndex;
    });

    const existingRewards = await this.prisma.playerReward.findMany({
      where: {
        seasonId,
        rewardId,
        playerId: { in: eligiblePlayers.map((p) => p.playerId) },
      },
    });

    const existingPlayerIds = new Set(existingRewards.map((r) => r.playerId));
    const playersToReward = eligiblePlayers.filter((p) => !existingPlayerIds.has(p.playerId));

    const playerRewardsToCreate = playersToReward.map((player) => ({
      id: uuidv4(),
      playerId: player.playerId,
      seasonId,
      rewardId: reward.rewardId,
      rewardType: reward.rewardType,
      rewardName: reward.rewardName,
      earnedTier: player.tier,
      isRetroactive: true,
    }));

    if (playerRewardsToCreate.length > 0) {
      await this.prisma.playerReward.createMany({
        data: playerRewardsToCreate,
      });
    }

    const distributedPlayers = playersToReward.map((p) => p.playerId);

    logger.info(`Distributed retroactive reward ${rewardId} to ${distributedPlayers.length} players`);

    return {
      distributed: playerRewardsToCreate.length,
      players: distributedPlayers,
    };
  }

  public async createRewardNotification(
    playerId: string,
    rewardId: string,
    notificationType: 'EARNED' | 'AVAILABLE' | 'EXPIRING' | 'CLAIMED'
  ): Promise<RewardNotification> {
    const reward = await this.prisma.playerReward.findFirst({
      where: { playerId, rewardId },
    });

    if (!reward) {
      throw new NotFoundError(`Reward ${rewardId} not found for player ${playerId}`);
    }

    const notification: RewardNotification = {
      id: uuidv4(),
      playerId,
      rewardId,
      rewardName: reward.rewardName,
      rewardType: this.mapPrismaRewardType(reward.rewardType),
      notificationType,
      message: this.getNotificationMessage(notificationType, reward.rewardName),
      createdAt: new Date(),
      isRead: false,
    };

    logger.info(`Created ${notificationType} notification for player ${playerId}: ${reward.rewardName}`);

    return notification;
  }

  private getNotificationMessage(
    notificationType: 'EARNED' | 'AVAILABLE' | 'EXPIRING' | 'CLAIMED',
    rewardName: string
  ): string {
    switch (notificationType) {
      case 'EARNED':
        return `Congratulations! You have earned ${rewardName}!`;
      case 'AVAILABLE':
        return `${rewardName} is now available to claim!`;
      case 'EXPIRING':
        return `${rewardName} will expire soon. Claim it before it's gone!`;
      case 'CLAIMED':
        return `You have successfully claimed ${rewardName}!`;
      default:
        return `Notification about ${rewardName}`;
    }
  }

  public async getExclusiveSeasonItems(seasonId: string): Promise<SeasonReward[]> {
    const rewards = await this.prisma.seasonReward.findMany({
      where: { seasonId, isExclusive: true },
      orderBy: [{ tier: 'desc' }, { rewardType: 'asc' }],
    });

    return rewards.map((reward) => ({
      ...reward,
      tier: this.mapPrismaTier(reward.tier),
      rewardType: this.mapPrismaRewardType(reward.rewardType),
    })) as SeasonReward[];
  }

  public async claimAllRewards(playerId: string, seasonId?: string): Promise<{
    claimed: number;
    rewards: PlayerReward[];
  }> {
    const where = seasonId
      ? { playerId, seasonId, claimedAt: null }
      : { playerId, claimedAt: null };

    const unclaimedRewards = await this.prisma.playerReward.findMany({
      where,
    });

    if (unclaimedRewards.length === 0) {
      return { claimed: 0, rewards: [] };
    }

    const now = new Date();
    await this.prisma.playerReward.updateMany({
      where: {
        id: { in: unclaimedRewards.map((r) => r.id) },
      },
      data: { claimedAt: now },
    });

    const claimedRewards = await this.prisma.playerReward.findMany({
      where: {
        id: { in: unclaimedRewards.map((r) => r.id) },
      },
    });

    logger.info(`Player ${playerId} claimed ${claimedRewards.length} rewards`);

    return {
      claimed: claimedRewards.length,
      rewards: claimedRewards.map((reward) => ({
        ...reward,
        rewardType: this.mapPrismaRewardType(reward.rewardType),
        earnedTier: this.mapPrismaTier(reward.earnedTier),
      })) as PlayerReward[],
    };
  }

  public async setRewardExpiration(
    seasonId: string,
    rewardId: string,
    expirationDate: Date
  ): Promise<SeasonReward> {
    const reward = await this.prisma.seasonReward.findFirst({
      where: { seasonId, rewardId },
    });

    if (!reward) {
      throw new NotFoundError(`Reward ${rewardId} not found in season ${seasonId}`);
    }

    const updatedReward = await this.prisma.seasonReward.update({
      where: { id: reward.id },
      data: { expiresAt: expirationDate },
    });

    logger.info(`Set expiration for reward ${rewardId} to ${expirationDate.toISOString()}`);

    return {
      ...updatedReward,
      tier: this.mapPrismaTier(updatedReward.tier),
      rewardType: this.mapPrismaRewardType(updatedReward.rewardType),
    } as SeasonReward;
  }

  public async getExpiredRewards(playerId: string): Promise<PlayerReward[]> {
    const now = new Date();

    const rewards = await this.prisma.playerReward.findMany({
      where: {
        playerId,
        claimedAt: null,
        expiresAt: { lt: now },
      },
    });

    return rewards.map((reward) => ({
      ...reward,
      rewardType: this.mapPrismaRewardType(reward.rewardType),
      earnedTier: this.mapPrismaTier(reward.earnedTier),
    })) as PlayerReward[];
  }

  public async getExpiringRewards(
    playerId: string,
    daysUntilExpiration: number
  ): Promise<PlayerReward[]> {
    const now = new Date();
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() + daysUntilExpiration);

    const rewards = await this.prisma.playerReward.findMany({
      where: {
        playerId,
        claimedAt: null,
        expiresAt: {
          gte: now,
          lte: expirationThreshold,
        },
      },
    });

    return rewards.map((reward) => ({
      ...reward,
      rewardType: this.mapPrismaRewardType(reward.rewardType),
      earnedTier: this.mapPrismaTier(reward.earnedTier),
    })) as PlayerReward[];
  }

  public async getRewardStats(seasonId: string): Promise<{
    totalRewards: number;
    totalDistributed: number;
    totalClaimed: number;
    claimRate: number;
    rewardsByType: Record<string, number>;
    rewardsByTier: Record<string, number>;
  }> {
    const seasonRewards = await this.prisma.seasonReward.findMany({
      where: { seasonId },
    });

    const playerRewards = await this.prisma.playerReward.findMany({
      where: { seasonId },
    });

    const claimedRewards = playerRewards.filter((r) => r.claimedAt !== null);

    const rewardsByType: Record<string, number> = {};
    const rewardsByTier: Record<string, number> = {};

    for (const reward of seasonRewards) {
      const type = this.mapPrismaRewardType(reward.rewardType);
      const tier = this.mapPrismaTier(reward.tier);

      rewardsByType[type] = (rewardsByType[type] || 0) + 1;
      rewardsByTier[tier] = (rewardsByTier[tier] || 0) + 1;
    }

    return {
      totalRewards: seasonRewards.length,
      totalDistributed: playerRewards.length,
      totalClaimed: claimedRewards.length,
      claimRate: playerRewards.length > 0
        ? Math.round((claimedRewards.length / playerRewards.length) * 100)
        : 0,
      rewardsByType,
      rewardsByTier,
    };
  }
}

export const rewardsService = new RewardsService();
