import { PrismaClient, SeasonState as PrismaSeasonState, SeasonType as PrismaSeasonType, AuditAction as PrismaAuditAction, EventType as PrismaEventType, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';
import {
  Season,
  SeasonState,
  SeasonType,
  AuditAction,
  EventType,
  SeasonEvent,
  SeasonAuditLog,
  SeasonHealthMetrics,
  SeasonTransitionResult,
  SeasonResetResult,
  RankedTier,
  TierDivision,
} from '../types';
import { config } from '../config';
import { mmrService } from './mmr.service';
import { tierService } from './tier.service';

export class LifecycleService {
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

  private mapPrismaEventType(type: PrismaEventType): EventType {
    return type as EventType;
  }

  private mapToEventType(type: EventType): PrismaEventType {
    return type as PrismaEventType;
  }

  private readonly validTransitions: Record<SeasonState, SeasonState[]> = {
    [SeasonState.DRAFT]: [SeasonState.SCHEDULED],
    [SeasonState.SCHEDULED]: [SeasonState.ACTIVE, SeasonState.DRAFT],
    [SeasonState.ACTIVE]: [SeasonState.PAUSED, SeasonState.ENDING],
    [SeasonState.PAUSED]: [SeasonState.ACTIVE, SeasonState.ENDING],
    [SeasonState.ENDING]: [SeasonState.ENDED],
    [SeasonState.ENDED]: [SeasonState.ARCHIVED],
    [SeasonState.ARCHIVED]: [],
  };

  public async getSeasonState(seasonId: string): Promise<SeasonState> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    return this.mapPrismaState(season.state);
  }

  public async transitionState(
    seasonId: string,
    newState: SeasonState,
    actorId: string,
    metadata?: Record<string, unknown>
  ): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const currentState = this.mapPrismaState(season.state);
    const allowedTransitions = this.validTransitions[currentState];

    if (!allowedTransitions.includes(newState)) {
      throw new BadRequestError(
        `Invalid state transition from ${currentState} to ${newState}. Allowed: ${allowedTransitions.join(', ')}`
      );
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        state: this.mapToSeasonState(newState),
        isActive: newState === SeasonState.ACTIVE,
        version: season.version + 1,
      },
    });

    await this.createAuditLog(seasonId, AuditAction.UPDATE, actorId, {
      previousState: { state: currentState },
      newState: { state: newState },
      metadata,
    });

    await this.createSeasonEvent(seasonId, EventType.STATE_CHANGE, {
      previousState: currentState,
      newState,
      timestamp: new Date().toISOString(),
    });

    logger.info(`Season ${seasonId} transitioned from ${currentState} to ${newState}`);

    return updatedSeason as unknown as Season;
  }

  public async activateSeason(seasonId: string, actorId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const validationErrors = await this.validateSeasonForActivation(seasonId);
    if (validationErrors.length > 0) {
      throw new BadRequestError(`Season validation failed: ${validationErrors.join(', ')}`);
    }

    const existingActive = await this.prisma.season.findFirst({
      where: {
        isActive: true,
        type: season.type,
        id: { not: seasonId },
      },
    });

    if (existingActive) {
      throw new ConflictError(`An active season of type ${season.type} already exists`);
    }

    const updatedSeason = await this.transitionState(seasonId, SeasonState.ACTIVE, actorId, {
      activatedAt: new Date().toISOString(),
    });

    await this.createSeasonEvent(seasonId, EventType.SEASON_START, {
      seasonId,
      seasonNumber: season.number,
      startDate: new Date().toISOString(),
    });

    await this.createAuditLog(seasonId, AuditAction.ACTIVATE, actorId, {
      metadata: { activatedAt: new Date().toISOString() },
    });

    logger.info(`Season ${season.number} activated`);

    return updatedSeason;
  }

  public async pauseSeason(seasonId: string, actorId: string, reason?: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (this.mapPrismaState(season.state) !== SeasonState.ACTIVE) {
      throw new BadRequestError('Only active seasons can be paused');
    }

    const updatedSeason = await this.transitionState(seasonId, SeasonState.PAUSED, actorId, {
      pausedAt: new Date().toISOString(),
      reason,
    });

    await this.createAuditLog(seasonId, AuditAction.PAUSE, actorId, {
      metadata: { pausedAt: new Date().toISOString(), reason },
    });

    logger.info(`Season ${season.number} paused: ${reason || 'No reason provided'}`);

    return updatedSeason;
  }

  public async resumeSeason(seasonId: string, actorId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (this.mapPrismaState(season.state) !== SeasonState.PAUSED) {
      throw new BadRequestError('Only paused seasons can be resumed');
    }

    const updatedSeason = await this.transitionState(seasonId, SeasonState.ACTIVE, actorId, {
      resumedAt: new Date().toISOString(),
    });

    await this.createAuditLog(seasonId, AuditAction.RESUME, actorId, {
      metadata: { resumedAt: new Date().toISOString() },
    });

    logger.info(`Season ${season.number} resumed`);

    return updatedSeason;
  }

  public async extendSeason(
    seasonId: string,
    newEndDate: Date,
    actorId: string,
    reason?: string
  ): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const currentState = this.mapPrismaState(season.state);
    if (currentState !== SeasonState.ACTIVE && currentState !== SeasonState.ENDING) {
      throw new BadRequestError('Only active or ending seasons can be extended');
    }

    if (season.endDate && newEndDate <= season.endDate) {
      throw new BadRequestError('New end date must be after current end date');
    }

    const previousEndDate = season.endDate;

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        endDate: newEndDate,
        state: this.mapToSeasonState(SeasonState.ACTIVE),
        version: season.version + 1,
      },
    });

    await this.createAuditLog(seasonId, AuditAction.EXTEND, actorId, {
      metadata: {
        previousEndDate: previousEndDate?.toISOString(),
        newEndDate: newEndDate.toISOString(),
        reason,
      },
    });

    logger.info(`Season ${season.number} extended to ${newEndDate.toISOString()}`);

    return updatedSeason as unknown as Season;
  }

  public async terminateSeason(
    seasonId: string,
    actorId: string,
    reason: string,
    gracePeriodHours = 24
  ): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const currentState = this.mapPrismaState(season.state);
    if (currentState !== SeasonState.ACTIVE && currentState !== SeasonState.PAUSED) {
      throw new BadRequestError('Only active or paused seasons can be terminated early');
    }

    const terminationDate = new Date();
    terminationDate.setHours(terminationDate.getHours() + gracePeriodHours);

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        state: this.mapToSeasonState(SeasonState.ENDING),
        endDate: terminationDate,
        version: season.version + 1,
      },
    });

    await this.createAuditLog(seasonId, AuditAction.TERMINATE, actorId, {
      metadata: {
        reason,
        gracePeriodHours,
        terminationDate: terminationDate.toISOString(),
      },
    });

    await this.createSeasonEvent(seasonId, EventType.EMERGENCY, {
      type: 'EARLY_TERMINATION',
      reason,
      gracePeriodHours,
      terminationDate: terminationDate.toISOString(),
    });

    logger.info(`Season ${season.number} scheduled for early termination at ${terminationDate.toISOString()}`);

    return updatedSeason as unknown as Season;
  }

  public async transitionToNextSeason(
    currentSeasonId: string,
    newSeasonId: string,
    actorId: string
  ): Promise<SeasonTransitionResult> {
    const currentSeason = await this.prisma.season.findUnique({
      where: { id: currentSeasonId },
    });

    const newSeason = await this.prisma.season.findUnique({
      where: { id: newSeasonId },
    });

    if (!currentSeason || !newSeason) {
      throw new NotFoundError('Season not found');
    }

    if (currentSeason.type !== newSeason.type) {
      throw new BadRequestError('Cannot transition between seasons of different types');
    }

    await this.transitionState(currentSeasonId, SeasonState.ENDED, actorId, {
      metadata: { transitionedTo: newSeasonId },
    });

    const players = await this.prisma.playerSeason.findMany({
      where: { seasonId: currentSeasonId },
    });

    const resetResults: SeasonResetResult[] = [];

    for (const player of players) {
      const newMmr = mmrService.calculateSoftReset({
        currentMmr: player.mmr,
        baseMmr: config.DEFAULT_MMR,
        resetFactor: newSeason.softResetFactor,
      });

      const { tier: newTier, division: newDivision } = tierService.getTierFromMMR(newMmr);

      await this.prisma.playerSeason.create({
        data: {
          id: uuidv4(),
          playerId: player.playerId,
          seasonId: newSeasonId,
          mmr: newMmr,
          peakMmr: newMmr,
          tier: newTier,
          division: newDivision,
          previousTier: player.tier,
          previousDivision: player.division,
          gamerstakePlayerId: player.gamerstakePlayerId,
        },
      });

      resetResults.push({
        playerId: player.playerId,
        previousMmr: player.mmr,
        newMmr,
        previousTier: player.tier as unknown as RankedTier,
        newTier,
        previousDivision: player.division as TierDivision | null,
        newDivision,
      });
    }

    await this.activateSeason(newSeasonId, actorId);

    const rewardsResult = await this.prisma.playerReward.count({
      where: { seasonId: currentSeasonId },
    });

    await this.createAuditLog(currentSeasonId, AuditAction.UPDATE, actorId, {
      metadata: {
        transitionedTo: newSeasonId,
        playersTransitioned: players.length,
      },
    });

    logger.info(`Transitioned ${players.length} players from season ${currentSeason.number} to ${newSeason.number}`);

    return {
      previousSeasonId: currentSeasonId,
      newSeasonId,
      playersTransitioned: players.length,
      rewardsDistributed: rewardsResult,
      resetResults,
    };
  }

  public async checkSeasonOverlap(
    type: SeasonType,
    startDate: Date,
    endDate: Date | null,
    excludeSeasonId?: string
  ): Promise<boolean> {
    const overlappingSeasons = await this.prisma.season.findMany({
      where: {
        type: type as unknown as PrismaSeasonType,
        state: {
          in: [
            this.mapToSeasonState(SeasonState.SCHEDULED),
            this.mapToSeasonState(SeasonState.ACTIVE),
            this.mapToSeasonState(SeasonState.PAUSED),
            this.mapToSeasonState(SeasonState.ENDING),
          ],
        },
        id: excludeSeasonId ? { not: excludeSeasonId } : undefined,
        OR: [
          {
            startDate: { lte: endDate || new Date('2099-12-31') },
            endDate: { gte: startDate },
          },
          {
            startDate: { lte: endDate || new Date('2099-12-31') },
            endDate: null,
          },
        ],
      },
    });

    return overlappingSeasons.length > 0;
  }

  public async createSeasonEvent(
    seasonId: string,
    eventType: EventType,
    eventData: Record<string, unknown>,
    webhookUrl?: string
  ): Promise<SeasonEvent> {
    const event = await this.prisma.seasonEvent.create({
      data: {
        id: uuidv4(),
        seasonId,
        eventType: this.mapToEventType(eventType),
        eventData: eventData as Prisma.InputJsonValue,
        webhookUrl,
      },
    });

    if (webhookUrl) {
      this.processWebhook(event.id, webhookUrl, eventData).catch((error) => {
        logger.error(`Failed to process webhook for event ${event.id}: ${error}`);
      });
    }

    return {
      ...event,
      eventType: this.mapPrismaEventType(event.eventType),
      eventData: event.eventData as Record<string, unknown>,
    } as SeasonEvent;
  }

  private async processWebhook(
    eventId: string,
    webhookUrl: string,
    eventData: Record<string, unknown>
  ): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      });

      await this.prisma.seasonEvent.update({
        where: { id: eventId },
        data: {
          isProcessed: true,
          processedAt: new Date(),
          error: response.ok ? null : `HTTP ${response.status}`,
        },
      });
    } catch (error) {
      await this.prisma.seasonEvent.update({
        where: { id: eventId },
        data: {
          error: String(error),
        },
      });
    }
  }

  public async getSeasonHealth(seasonId: string): Promise<SeasonHealthMetrics> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [activePlayerCount, matchesLast24h, errorEvents] = await Promise.all([
      this.prisma.playerSeason.count({
        where: {
          seasonId,
          lastActivityAt: { gte: yesterday },
        },
      }),
      this.prisma.matchResult.count({
        where: {
          seasonId,
          createdAt: { gte: yesterday },
        },
      }),
      this.prisma.seasonEvent.count({
        where: {
          seasonId,
          eventType: this.mapToEventType(EventType.EMERGENCY),
          createdAt: { gte: yesterday },
        },
      }),
    ]);

    const warnings: string[] = [];

    if (activePlayerCount < 100) {
      warnings.push('Low active player count');
    }

    if (matchesLast24h < 50) {
      warnings.push('Low match activity');
    }

    if (errorEvents > 0) {
      warnings.push(`${errorEvents} emergency events in last 24h`);
    }

    const isHealthy = warnings.length === 0;

    return {
      seasonId,
      isHealthy,
      activePlayerCount,
      matchesLast24h,
      averageQueueTime: 0,
      errorRate: errorEvents / Math.max(matchesLast24h, 1),
      warnings,
      lastCheckedAt: now,
    };
  }

  public async createAuditLog(
    seasonId: string,
    action: AuditAction,
    actorId: string,
    data?: {
      previousState?: Record<string, unknown>;
      newState?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      targetType?: string;
      targetId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<SeasonAuditLog> {
    const auditLog = await this.prisma.seasonAuditLog.create({
      data: {
        id: uuidv4(),
        seasonId,
        action: this.mapToAuditAction(action),
        actorId,
        actorType: 'admin',
        targetType: data?.targetType,
        targetId: data?.targetId,
        previousState: data?.previousState as Prisma.InputJsonValue | undefined,
        newState: data?.newState as Prisma.InputJsonValue | undefined,
        metadata: (data?.metadata || {}) as Prisma.InputJsonValue,
        ipAddress: data?.ipAddress,
        userAgent: data?.userAgent,
      },
    });

    return {
      ...auditLog,
      action: this.mapPrismaAuditAction(auditLog.action),
      previousState: auditLog.previousState as Record<string, unknown> | null,
      newState: auditLog.newState as Record<string, unknown> | null,
      metadata: auditLog.metadata as Record<string, unknown>,
    } as SeasonAuditLog;
  }

  public async getAuditLogs(
    seasonId: string,
    page = 1,
    limit = 50
  ): Promise<{ data: SeasonAuditLog[]; total: number }> {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.seasonAuditLog.findMany({
        where: { seasonId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.seasonAuditLog.count({ where: { seasonId } }),
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

  private async validateSeasonForActivation(seasonId: string): Promise<string[]> {
    const errors: string[] = [];

    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        seasonRewards: true,
      },
    });

    if (!season) {
      errors.push('Season not found');
      return errors;
    }

    if (season.startDate > new Date()) {
      errors.push('Season start date is in the future');
    }

    if (season.seasonRewards.length === 0) {
      errors.push('Season has no rewards configured');
    }

    const currentState = this.mapPrismaState(season.state);
    if (currentState !== SeasonState.SCHEDULED && currentState !== SeasonState.DRAFT) {
      errors.push(`Season is in ${currentState} state, cannot activate`);
    }

    return errors;
  }

  public async scheduleSeasonActivation(
    seasonId: string,
    activationDate: Date,
    actorId: string
  ): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (this.mapPrismaState(season.state) !== SeasonState.DRAFT) {
      throw new BadRequestError('Only draft seasons can be scheduled');
    }

    const updatedSeason = await this.prisma.season.update({
      where: { id: seasonId },
      data: {
        state: this.mapToSeasonState(SeasonState.SCHEDULED),
        startDate: activationDate,
        version: season.version + 1,
      },
    });

    await this.createAuditLog(seasonId, AuditAction.UPDATE, actorId, {
      previousState: { state: SeasonState.DRAFT },
      newState: { state: SeasonState.SCHEDULED, startDate: activationDate.toISOString() },
    });

    logger.info(`Season ${season.number} scheduled for activation at ${activationDate.toISOString()}`);

    return updatedSeason as unknown as Season;
  }

  public async endSeason(seasonId: string, actorId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    const currentState = this.mapPrismaState(season.state);
    if (currentState !== SeasonState.ENDING) {
      throw new BadRequestError('Season must be in ENDING state to end');
    }

    const updatedSeason = await this.transitionState(seasonId, SeasonState.ENDED, actorId, {
      metadata: { endedAt: new Date().toISOString() },
    });

    await this.createSeasonEvent(seasonId, EventType.SEASON_END, {
      seasonId,
      seasonNumber: season.number,
      endDate: new Date().toISOString(),
    });

    await this.createAuditLog(seasonId, AuditAction.END, actorId, {
      metadata: { endedAt: new Date().toISOString() },
    });

    logger.info(`Season ${season.number} ended`);

    return updatedSeason;
  }

  public async archiveSeason(seasonId: string, actorId: string): Promise<Season> {
    const season = await this.prisma.season.findUnique({
      where: { id: seasonId },
    });

    if (!season) {
      throw new NotFoundError(`Season ${seasonId} not found`);
    }

    if (this.mapPrismaState(season.state) !== SeasonState.ENDED) {
      throw new BadRequestError('Only ended seasons can be archived');
    }

    const updatedSeason = await this.transitionState(seasonId, SeasonState.ARCHIVED, actorId, {
      metadata: { archivedAt: new Date().toISOString() },
    });

    await this.createAuditLog(seasonId, AuditAction.UPDATE, actorId, {
      previousState: { state: SeasonState.ENDED },
      newState: { state: SeasonState.ARCHIVED },
    });

    logger.info(`Season ${season.number} archived`);

    return updatedSeason;
  }
}

export const lifecycleService = new LifecycleService();
