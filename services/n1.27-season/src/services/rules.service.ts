import { PrismaClient, ModifierType as PrismaModifierType, ChallengeType as PrismaChallengeType, RewardType as PrismaRewardType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import {
  SeasonRule,
  SeasonModifier,
  SeasonChallenge,
  PlayerChallengeProgress,
  ModifierType,
  ChallengeType,
  RewardType,
  RankedTier,
  CreateSeasonRuleDTO,
  CreateSeasonModifierDTO,
  CreateSeasonChallengeDTO,
  DecayResult,
  PromotionSeriesResult,
  TierDivision,
} from '../types';
import { tierService } from './tier.service';

export class RulesService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private mapPrismaModifierType(type: PrismaModifierType): ModifierType {
    return type as ModifierType;
  }

  private mapToModifierType(type: ModifierType): PrismaModifierType {
    return type as PrismaModifierType;
  }

  private mapPrismaChallengeType(type: PrismaChallengeType): ChallengeType {
    return type as ChallengeType;
  }

  private mapToChallengeType(type: ChallengeType): PrismaChallengeType {
    return type as PrismaChallengeType;
  }

  private mapPrismaRewardType(type: PrismaRewardType | null): RewardType | null {
    return type as RewardType | null;
  }

  private mapToRewardType(type: RewardType | null | undefined): PrismaRewardType | null {
    return (type as PrismaRewardType) || null;
  }

  public async createRule(dto: CreateSeasonRuleDTO): Promise<SeasonRule> {
    const season = await this.prisma.season.findUnique({
      where: { id: dto.seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${dto.seasonId} not found`);
    }

    const rule = await this.prisma.seasonRule.create({
      data: {
        id: uuidv4(),
        seasonId: dto.seasonId,
        name: dto.name,
        description: dto.description,
        ruleType: dto.ruleType,
        ruleConfig: (dto.ruleConfig || {}) as Prisma.InputJsonValue,
        priority: dto.priority || 0,
        isEnabled: dto.isEnabled ?? true,
      },
    });

    logger.info(`Created rule ${rule.name} for season ${dto.seasonId}`);

    return {
      ...rule,
      ruleConfig: rule.ruleConfig as Record<string, unknown>,
    } as SeasonRule;
  }

  public async getRules(seasonId: string): Promise<SeasonRule[]> {
    const rules = await this.prisma.seasonRule.findMany({
      where: { seasonId },
      orderBy: { priority: 'asc' },
    });

    return rules.map((rule) => ({
      ...rule,
      ruleConfig: rule.ruleConfig as Record<string, unknown>,
    })) as SeasonRule[];
  }

  public async updateRule(ruleId: string, updates: Partial<CreateSeasonRuleDTO>): Promise<SeasonRule> {
    const rule = await this.prisma.seasonRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new NotFoundError(`Rule ${ruleId} not found`);
    }

    const updatedRule = await this.prisma.seasonRule.update({
      where: { id: ruleId },
      data: {
        name: updates.name,
        description: updates.description,
        ruleType: updates.ruleType,
        ruleConfig: updates.ruleConfig as Prisma.InputJsonValue | undefined,
        priority: updates.priority,
        isEnabled: updates.isEnabled,
      },
    });

    logger.info(`Updated rule ${ruleId}`);

    return {
      ...updatedRule,
      ruleConfig: updatedRule.ruleConfig as Record<string, unknown>,
    } as SeasonRule;
  }

  public async deleteRule(ruleId: string): Promise<void> {
    const rule = await this.prisma.seasonRule.findUnique({
      where: { id: ruleId },
    });

    if (!rule) {
      throw new NotFoundError(`Rule ${ruleId} not found`);
    }

    await this.prisma.seasonRule.delete({
      where: { id: ruleId },
    });

    logger.info(`Deleted rule ${ruleId}`);
  }

  public async createModifier(dto: CreateSeasonModifierDTO): Promise<SeasonModifier> {
    const season = await this.prisma.season.findUnique({
      where: { id: dto.seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${dto.seasonId} not found`);
    }

    const modifier = await this.prisma.seasonModifier.create({
      data: {
        id: uuidv4(),
        seasonId: dto.seasonId,
        name: dto.name,
        description: dto.description,
        modifierType: this.mapToModifierType(dto.modifierType),
        value: dto.value || 1.0,
        startTime: dto.startTime,
        endTime: dto.endTime,
        daysOfWeek: dto.daysOfWeek || [],
        hoursOfDay: dto.hoursOfDay || [],
        isActive: dto.isActive ?? true,
      },
    });

    logger.info(`Created modifier ${modifier.name} for season ${dto.seasonId}`);

    return {
      ...modifier,
      modifierType: this.mapPrismaModifierType(modifier.modifierType),
    } as SeasonModifier;
  }

  public async getModifiers(seasonId: string): Promise<SeasonModifier[]> {
    const modifiers = await this.prisma.seasonModifier.findMany({
      where: { seasonId },
    });

    return modifiers.map((modifier) => ({
      ...modifier,
      modifierType: this.mapPrismaModifierType(modifier.modifierType),
    })) as SeasonModifier[];
  }

  public async getActiveModifiers(seasonId: string): Promise<SeasonModifier[]> {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    const modifiers = await this.prisma.seasonModifier.findMany({
      where: {
        seasonId,
        isActive: true,
        OR: [
          {
            startTime: null,
            endTime: null,
          },
          {
            startTime: { lte: now },
            endTime: { gte: now },
          },
        ],
      },
    });

    return modifiers
      .filter((modifier) => {
        if (modifier.daysOfWeek.length > 0 && !modifier.daysOfWeek.includes(currentDay)) {
          return false;
        }
        if (modifier.hoursOfDay.length > 0 && !modifier.hoursOfDay.includes(currentHour)) {
          return false;
        }
        return true;
      })
      .map((modifier) => ({
        ...modifier,
        modifierType: this.mapPrismaModifierType(modifier.modifierType),
      })) as SeasonModifier[];
  }

  public async updateModifier(modifierId: string, updates: Partial<CreateSeasonModifierDTO>): Promise<SeasonModifier> {
    const modifier = await this.prisma.seasonModifier.findUnique({
      where: { id: modifierId },
    });

    if (!modifier) {
      throw new NotFoundError(`Modifier ${modifierId} not found`);
    }

    const updatedModifier = await this.prisma.seasonModifier.update({
      where: { id: modifierId },
      data: {
        name: updates.name,
        description: updates.description,
        modifierType: updates.modifierType ? this.mapToModifierType(updates.modifierType) : undefined,
        value: updates.value,
        startTime: updates.startTime,
        endTime: updates.endTime,
        daysOfWeek: updates.daysOfWeek,
        hoursOfDay: updates.hoursOfDay,
        isActive: updates.isActive,
      },
    });

    logger.info(`Updated modifier ${modifierId}`);

    return {
      ...updatedModifier,
      modifierType: this.mapPrismaModifierType(updatedModifier.modifierType),
    } as SeasonModifier;
  }

  public async deleteModifier(modifierId: string): Promise<void> {
    const modifier = await this.prisma.seasonModifier.findUnique({
      where: { id: modifierId },
    });

    if (!modifier) {
      throw new NotFoundError(`Modifier ${modifierId} not found`);
    }

    await this.prisma.seasonModifier.delete({
      where: { id: modifierId },
    });

    logger.info(`Deleted modifier ${modifierId}`);
  }

  public async applyMMRMultiplier(seasonId: string, baseMMRChange: number): Promise<number> {
    const activeModifiers = await this.getActiveModifiers(seasonId);
    
    let multiplier = 1.0;
    for (const modifier of activeModifiers) {
      if (modifier.modifierType === ModifierType.MMR_MULTIPLIER) {
        multiplier *= modifier.value;
      }
    }

    return Math.round(baseMMRChange * multiplier);
  }

  public async processDecay(seasonId: string): Promise<DecayResult[]> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (!season.decayEnabled) {
      return [];
    }

    const decayThreshold = new Date();
    decayThreshold.setDate(decayThreshold.getDate() - season.decayDays);

    const inactivePlayers = await this.prisma.playerSeason.findMany({
      where: {
        seasonId,
        lastActivityAt: { lt: decayThreshold },
        isDecayProtected: false,
        tier: {
          in: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
        },
      },
    });

    const results: DecayResult[] = [];

    for (const player of inactivePlayers) {
      const daysInactive = Math.floor(
        (Date.now() - player.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const decayPeriods = Math.floor((daysInactive - season.decayDays) / 7) + 1;
      const totalDecay = season.decayAmount * decayPeriods;

      const newMmr = Math.max(player.mmr - totalDecay, season.mmrFloor);
      const { tier: newTier, division: newDivision } = tierService.getTierFromMMR(newMmr);

      await this.prisma.playerSeason.update({
        where: { id: player.id },
        data: {
          mmr: newMmr,
          tier: newTier,
          division: newDivision,
          decayWarningAt: null,
        },
      });

      results.push({
        playerId: player.playerId,
        previousMmr: player.mmr,
        newMmr,
        decayAmount: player.mmr - newMmr,
        previousTier: player.tier as unknown as RankedTier,
        newTier,
        daysInactive,
      });

      logger.info(`Applied decay to player ${player.playerId}: ${player.mmr} -> ${newMmr}`);
    }

    return results;
  }

  public async sendDecayWarnings(seasonId: string): Promise<string[]> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season || !season.decayEnabled) {
      return [];
    }

    const warningThreshold = new Date();
    warningThreshold.setDate(warningThreshold.getDate() - (season.decayDays - 3));

    const playersNeedingWarning = await this.prisma.playerSeason.findMany({
      where: {
        seasonId,
        lastActivityAt: { lt: warningThreshold },
        isDecayProtected: false,
        decayWarningAt: null,
        tier: {
          in: ['DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'],
        },
      },
    });

    const playerIds: string[] = [];

    for (const player of playersNeedingWarning) {
      await this.prisma.playerSeason.update({
        where: { id: player.id },
        data: { decayWarningAt: new Date() },
      });
      playerIds.push(player.playerId);
    }

    logger.info(`Sent decay warnings to ${playerIds.length} players`);

    return playerIds;
  }

  public async startPromotionSeries(
    playerId: string,
    seasonId: string
  ): Promise<{ success: boolean; message: string }> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: {
        playerId_seasonId: { playerId, seasonId },
      },
    });

    if (!playerSeason) {
      throw new NotFoundError('Player season not found');
    }

    if (playerSeason.isInPromos) {
      return { success: false, message: 'Already in promotion series' };
    }

    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const { tier, division } = tierService.getTierFromMMR(playerSeason.mmr);
    const nextTierInfo = this.getNextTier(tier, division);

    if (!nextTierInfo) {
      return { success: false, message: 'Already at highest tier' };
    }

    await this.prisma.playerSeason.update({
      where: { id: playerSeason.id },
      data: {
        isInPromos: true,
        promoWins: 0,
        promoLosses: 0,
      },
    });

    logger.info(`Started promotion series for player ${playerId}`);

    return { success: true, message: 'Promotion series started' };
  }

  public async updatePromotionSeries(
    playerId: string,
    seasonId: string,
    won: boolean
  ): Promise<PromotionSeriesResult | null> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: {
        playerId_seasonId: { playerId, seasonId },
      },
    });

    if (!playerSeason || !playerSeason.isInPromos) {
      return null;
    }

    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const newPromoWins = won ? playerSeason.promoWins + 1 : playerSeason.promoWins;
    const newPromoLosses = won ? playerSeason.promoLosses : playerSeason.promoLosses + 1;

    const seriesWon = newPromoWins >= season.promoWinsRequired;
    const seriesLost = newPromoLosses > season.promoGamesMax - season.promoWinsRequired;
    const seriesComplete = seriesWon || seriesLost;

    if (!seriesComplete) {
      await this.prisma.playerSeason.update({
        where: { id: playerSeason.id },
        data: {
          promoWins: newPromoWins,
          promoLosses: newPromoLosses,
        },
      });
      return null;
    }

    const previousTier = playerSeason.tier as unknown as RankedTier;
    const previousDivision = playerSeason.division as TierDivision | null;

    let newTier = previousTier;
    let newDivision = previousDivision;

    if (seriesWon) {
      const nextTierInfo = this.getNextTier(previousTier, previousDivision);
      if (nextTierInfo) {
        newTier = nextTierInfo.tier;
        newDivision = nextTierInfo.division;
      }
    }

    await this.prisma.playerSeason.update({
      where: { id: playerSeason.id },
      data: {
        isInPromos: false,
        promoWins: 0,
        promoLosses: 0,
        tier: newTier,
        division: newDivision,
        previousTier: previousTier,
        previousDivision: previousDivision,
        demotionShieldGames: seriesWon ? season.demotionShieldGames : 0,
      },
    });

    logger.info(`Promotion series completed for player ${playerId}: ${seriesWon ? 'WON' : 'LOST'}`);

    return {
      playerId,
      seriesWon,
      wins: newPromoWins,
      losses: newPromoLosses,
      previousTier,
      previousDivision,
      newTier,
      newDivision,
    };
  }

  private getNextTier(
    currentTier: RankedTier,
    currentDivision: TierDivision | null
  ): { tier: RankedTier; division: TierDivision | null } | null {
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

    const tiersWithDivisions = [
      RankedTier.BRONZE,
      RankedTier.SILVER,
      RankedTier.GOLD,
      RankedTier.PLATINUM,
      RankedTier.DIAMOND,
    ];

    if (currentTier === RankedTier.CHALLENGER) {
      return null;
    }

    if (tiersWithDivisions.includes(currentTier as RankedTier) && currentDivision !== null) {
      if (currentDivision > TierDivision.I) {
        return { tier: currentTier, division: (currentDivision - 1) as TierDivision };
      }
    }

    const currentIndex = tierOrder.indexOf(currentTier);
    const nextTier = tierOrder[currentIndex + 1];

    if (tiersWithDivisions.includes(nextTier)) {
      return { tier: nextTier, division: TierDivision.IV };
    }

    return { tier: nextTier, division: null };
  }

  public async applyDemotionProtection(
    playerId: string,
    seasonId: string
  ): Promise<boolean> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: {
        playerId_seasonId: { playerId, seasonId },
      },
    });

    if (!playerSeason) {
      throw new NotFoundError('Player season not found');
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

  public async applyStreakBonus(
    seasonId: string,
    playerId: string,
    baseMMRChange: number,
    isWin: boolean
  ): Promise<number> {
    const playerSeason = await this.prisma.playerSeason.findUnique({
      where: {
        playerId_seasonId: { playerId, seasonId },
      },
    });

    if (!playerSeason) {
      return baseMMRChange;
    }

    const activeModifiers = await this.getActiveModifiers(seasonId);
    const streakModifier = activeModifiers.find(
      (m) => m.modifierType === ModifierType.STREAK_BONUS
    );

    if (!streakModifier) {
      return baseMMRChange;
    }

    const streak = isWin ? playerSeason.winStreak : 0;
    if (streak >= 3) {
      const bonusMultiplier = 1 + (streak - 2) * (streakModifier.value - 1);
      return Math.round(baseMMRChange * Math.min(bonusMultiplier, 2.0));
    }

    return baseMMRChange;
  }

  public async createChallenge(dto: CreateSeasonChallengeDTO): Promise<SeasonChallenge> {
    const season = await this.prisma.season.findUnique({
      where: { id: dto.seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${dto.seasonId} not found`);
    }

    const challenge = await this.prisma.seasonChallenge.create({
      data: {
        id: uuidv4(),
        seasonId: dto.seasonId,
        name: dto.name,
        description: dto.description,
        challengeType: this.mapToChallengeType(dto.challengeType),
        targetValue: dto.targetValue,
        rewardType: this.mapToRewardType(dto.rewardType),
        rewardId: dto.rewardId,
        rewardQuantity: dto.rewardQuantity || 1,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isActive: dto.isActive ?? true,
      },
    });

    logger.info(`Created challenge ${challenge.name} for season ${dto.seasonId}`);

    return {
      ...challenge,
      challengeType: this.mapPrismaChallengeType(challenge.challengeType),
      rewardType: this.mapPrismaRewardType(challenge.rewardType),
    } as SeasonChallenge;
  }

  public async getChallenges(seasonId: string): Promise<SeasonChallenge[]> {
    const challenges = await this.prisma.seasonChallenge.findMany({
      where: { seasonId },
    });

    return challenges.map((challenge) => ({
      ...challenge,
      challengeType: this.mapPrismaChallengeType(challenge.challengeType),
      rewardType: this.mapPrismaRewardType(challenge.rewardType),
    })) as SeasonChallenge[];
  }

  public async getActiveChallenges(seasonId: string): Promise<SeasonChallenge[]> {
    const now = new Date();

    const challenges = await this.prisma.seasonChallenge.findMany({
      where: {
        seasonId,
        isActive: true,
        OR: [
          {
            startDate: null,
            endDate: null,
          },
          {
            startDate: { lte: now },
            endDate: { gte: now },
          },
          {
            startDate: { lte: now },
            endDate: null,
          },
        ],
      },
    });

    return challenges.map((challenge) => ({
      ...challenge,
      challengeType: this.mapPrismaChallengeType(challenge.challengeType),
      rewardType: this.mapPrismaRewardType(challenge.rewardType),
    })) as SeasonChallenge[];
  }

  public async getPlayerChallengeProgress(
    playerId: string,
    seasonId: string
  ): Promise<PlayerChallengeProgress[]> {
    const challenges = await this.getActiveChallenges(seasonId);
    const challengeIds = challenges.map((c) => c.id);

    const progress = await this.prisma.playerChallengeProgress.findMany({
      where: {
        playerId,
        challengeId: { in: challengeIds },
      },
    });

    return progress as PlayerChallengeProgress[];
  }

  public async updateChallengeProgress(
    playerId: string,
    challengeId: string,
    incrementValue: number
  ): Promise<PlayerChallengeProgress> {
    const challenge = await this.prisma.seasonChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new NotFoundError(`Challenge ${challengeId} not found`);
    }

    let progress = await this.prisma.playerChallengeProgress.findFirst({
      where: { playerId, challengeId },
    });

    if (!progress) {
      progress = await this.prisma.playerChallengeProgress.create({
        data: {
          id: uuidv4(),
          playerId,
          challengeId,
          currentValue: 0,
          isCompleted: false,
          rewardClaimed: false,
        },
      });
    }

    const newValue = progress.currentValue + incrementValue;
    const isCompleted = newValue >= challenge.targetValue;

    const updatedProgress = await this.prisma.playerChallengeProgress.update({
      where: { id: progress.id },
      data: {
        currentValue: newValue,
        isCompleted,
        completedAt: isCompleted && !progress.isCompleted ? new Date() : progress.completedAt,
      },
    });

    if (isCompleted && !progress.isCompleted) {
      logger.info(`Player ${playerId} completed challenge ${challengeId}`);
    }

    return updatedProgress as PlayerChallengeProgress;
  }

  public async claimChallengeReward(
    playerId: string,
    challengeId: string
  ): Promise<{ success: boolean; message: string }> {
    const progress = await this.prisma.playerChallengeProgress.findFirst({
      where: { playerId, challengeId },
    });

    if (!progress) {
      return { success: false, message: 'Challenge progress not found' };
    }

    if (!progress.isCompleted) {
      return { success: false, message: 'Challenge not completed' };
    }

    if (progress.rewardClaimed) {
      return { success: false, message: 'Reward already claimed' };
    }

    const challenge = await this.prisma.seasonChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge || !challenge.rewardType || !challenge.rewardId) {
      return { success: false, message: 'No reward configured for this challenge' };
    }

    await this.prisma.playerChallengeProgress.update({
      where: { id: progress.id },
      data: { rewardClaimed: true },
    });

    await this.prisma.playerReward.create({
      data: {
        id: uuidv4(),
        playerId,
        seasonId: challenge.seasonId,
        rewardId: challenge.rewardId,
        rewardType: challenge.rewardType,
        rewardName: `Challenge: ${challenge.name}`,
        earnedTier: 'BRONZE',
        quantity: challenge.rewardQuantity,
      },
    });

    logger.info(`Player ${playerId} claimed reward for challenge ${challengeId}`);

    return { success: true, message: 'Reward claimed successfully' };
  }

  public async checkSkillGroupRestriction(
    seasonId: string,
    player1Id: string,
    player2Id: string
  ): Promise<boolean> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const [player1, player2] = await Promise.all([
      this.prisma.playerSeason.findUnique({
        where: { playerId_seasonId: { playerId: player1Id, seasonId } },
      }),
      this.prisma.playerSeason.findUnique({
        where: { playerId_seasonId: { playerId: player2Id, seasonId } },
      }),
    ]);

    if (!player1 || !player2) {
      return false;
    }

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

    const tier1Index = tierOrder.indexOf(player1.tier as unknown as RankedTier);
    const tier2Index = tierOrder.indexOf(player2.tier as unknown as RankedTier);

    const tierDifference = Math.abs(tier1Index - tier2Index);

    return tierDifference <= season.skillGroupRestriction;
  }
}

export const rulesService = new RulesService();
