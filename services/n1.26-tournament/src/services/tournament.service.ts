import { TournamentStatus, TournamentFormat } from '@prisma/client';
import prisma from '../models/prisma';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  TournamentFilters,
  PaginationOptions,
  PaginatedResult,
  TournamentWithDetails,
} from '../types';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

export class TournamentService {
  /**
   * Create a new tournament
   */
  async create(data: CreateTournamentDto): Promise<TournamentWithDetails> {
    const tournament = await prisma.tournament.create({
      data: {
        name: data.name,
        description: data.description,
        game: data.game,
        format: data.format || TournamentFormat.SINGLE_ELIMINATION,
        maxParticipants: data.maxParticipants,
        minParticipants: data.minParticipants || 2,
        startDate: data.startDate,
        endDate: data.endDate,
        registrationStartDate: data.registrationStartDate,
        registrationEndDate: data.registrationEndDate,
        rules: data.rules,
        prizePool: data.prizePool,
        createdBy: data.createdBy,
      },
      include: {
        participants: true,
        matches: {
          include: {
            player1: true,
            player2: true,
            winner: true,
          },
        },
      },
    });

    logger.info(`Created tournament: ${tournament.id}`);

    return this.mapToTournamentWithDetails(tournament);
  }

  /**
   * Get tournament by ID with full details
   */
  async getById(id: string): Promise<TournamentWithDetails> {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { seed: 'asc' },
        },
        matches: {
          include: {
            player1: true,
            player2: true,
            winner: true,
          },
          orderBy: [{ round: 'asc' }, { position: 'asc' }],
        },
      },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', id);
    }

    return this.mapToTournamentWithDetails(tournament);
  }

  /**
   * List tournaments with filtering and pagination
   */
  async list(
    filters: TournamentFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<PaginatedResult<TournamentWithDetails>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.format) {
      where.format = filters.format;
    }

    if (filters.game) {
      where.game = { contains: filters.game, mode: 'insensitive' };
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [tournaments, total] = await Promise.all([
      prisma.tournament.findMany({
        where,
        include: {
          participants: true,
          matches: {
            include: {
              player1: true,
              player2: true,
              winner: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.tournament.count({ where }),
    ]);

    return {
      data: tournaments.map(t => this.mapToTournamentWithDetails(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update tournament
   */
  async update(id: string, data: UpdateTournamentDto): Promise<TournamentWithDetails> {
    const existing = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Tournament', id);
    }

    // Validate status transitions
    if (data.status) {
      this.validateStatusTransition(existing.status, data.status);
    }

    const tournament = await prisma.tournament.update({
      where: { id },
      data,
      include: {
        participants: true,
        matches: {
          include: {
            player1: true,
            player2: true,
            winner: true,
          },
        },
      },
    });

    logger.info(`Updated tournament: ${id}`);

    return this.mapToTournamentWithDetails(tournament);
  }

  /**
   * Delete tournament
   */
  async delete(id: string): Promise<void> {
    const existing = await prisma.tournament.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('Tournament', id);
    }

    if (existing.status === TournamentStatus.IN_PROGRESS) {
      throw new BadRequestError('Cannot delete a tournament that is in progress');
    }

    await prisma.tournament.delete({
      where: { id },
    });

    logger.info(`Deleted tournament: ${id}`);
  }

  /**
   * Update tournament status
   */
  async updateStatus(id: string, status: TournamentStatus): Promise<TournamentWithDetails> {
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', id);
    }

    this.validateStatusTransition(tournament.status, status);

    // Additional validations based on target status
    if (status === TournamentStatus.IN_PROGRESS) {
      if (tournament.participants.length < tournament.minParticipants) {
        throw new BadRequestError(
          `Cannot start tournament. Minimum ${tournament.minParticipants} participants required, but only ${tournament.participants.length} registered.`
        );
      }
    }

    return this.update(id, { status });
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: TournamentStatus,
    newStatus: TournamentStatus
  ): void {
    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.DRAFT]: [
        TournamentStatus.REGISTRATION_OPEN,
        TournamentStatus.CANCELLED,
      ],
      [TournamentStatus.REGISTRATION_OPEN]: [
        TournamentStatus.REGISTRATION_CLOSED,
        TournamentStatus.CANCELLED,
      ],
      [TournamentStatus.REGISTRATION_CLOSED]: [
        TournamentStatus.IN_PROGRESS,
        TournamentStatus.CANCELLED,
      ],
      [TournamentStatus.IN_PROGRESS]: [
        TournamentStatus.COMPLETED,
        TournamentStatus.CANCELLED,
      ],
      [TournamentStatus.COMPLETED]: [],
      [TournamentStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestError(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Map database model to DTO
   */
  private mapToTournamentWithDetails(tournament: {
    id: string;
    name: string;
    description: string | null;
    game: string;
    format: TournamentFormat;
    status: TournamentStatus;
    maxParticipants: number;
    minParticipants: number;
    startDate: Date | null;
    endDate: Date | null;
    registrationStartDate: Date | null;
    registrationEndDate: Date | null;
    rules: string | null;
    prizePool: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string | null;
    participants: Array<{
      id: string;
      name: string;
      email: string | null;
      seed: number | null;
      status: string;
      checkedInAt: Date | null;
    }>;
    matches: Array<{
      id: string;
      round: number;
      position: number;
      player1: { id: string; name: string; email: string | null; seed: number | null; status: string; checkedInAt: Date | null } | null;
      player2: { id: string; name: string; email: string | null; seed: number | null; status: string; checkedInAt: Date | null } | null;
      winner: { id: string; name: string; email: string | null; seed: number | null; status: string; checkedInAt: Date | null } | null;
      player1Score: number | null;
      player2Score: number | null;
      status: string;
      scheduledAt: Date | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>;
  }): TournamentWithDetails {
    return {
      id: tournament.id,
      name: tournament.name,
      description: tournament.description,
      game: tournament.game,
      format: tournament.format,
      status: tournament.status,
      maxParticipants: tournament.maxParticipants,
      minParticipants: tournament.minParticipants,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      registrationStartDate: tournament.registrationStartDate,
      registrationEndDate: tournament.registrationEndDate,
      rules: tournament.rules,
      prizePool: tournament.prizePool,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
      createdBy: tournament.createdBy,
      participants: tournament.participants.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        seed: p.seed,
        status: p.status as import('@prisma/client').ParticipantStatus,
        checkedInAt: p.checkedInAt,
      })),
      matches: tournament.matches.map(m => ({
        id: m.id,
        round: m.round,
        position: m.position,
        player1: m.player1 ? {
          id: m.player1.id,
          name: m.player1.name,
          email: m.player1.email,
          seed: m.player1.seed,
          status: m.player1.status as import('@prisma/client').ParticipantStatus,
          checkedInAt: m.player1.checkedInAt,
        } : null,
        player2: m.player2 ? {
          id: m.player2.id,
          name: m.player2.name,
          email: m.player2.email,
          seed: m.player2.seed,
          status: m.player2.status as import('@prisma/client').ParticipantStatus,
          checkedInAt: m.player2.checkedInAt,
        } : null,
        winner: m.winner ? {
          id: m.winner.id,
          name: m.winner.name,
          email: m.winner.email,
          seed: m.winner.seed,
          status: m.winner.status as import('@prisma/client').ParticipantStatus,
          checkedInAt: m.winner.checkedInAt,
        } : null,
        player1Score: m.player1Score,
        player2Score: m.player2Score,
        status: m.status as import('@prisma/client').MatchStatus,
        scheduledAt: m.scheduledAt,
        startedAt: m.startedAt,
        completedAt: m.completedAt,
      })),
    };
  }
}

export const tournamentService = new TournamentService();
