import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike, Between, In } from 'typeorm';
import {
  Tournament,
  TournamentFormat,
  TournamentStatus,
  TournamentVisibility,
} from '../entities/tournament.entity';
import { CreateTournamentDto, PrizeDistributionDto } from '../dto/create-tournament.dto';
import { UpdateTournamentDto } from '../dto/update-tournament.dto';

export interface TournamentQueryOptions {
  gameId?: string;
  status?: TournamentStatus | TournamentStatus[];
  visibility?: TournamentVisibility;
  organizerId?: string;
  format?: TournamentFormat;
  search?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class TournamentService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
  ) {}

  async create(createTournamentDto: CreateTournamentDto): Promise<Tournament> {
    const prizeDistribution = this.convertPrizeDistribution(createTournamentDto.prizeDistribution);

    const tournament = this.tournamentRepository.create({
      ...createTournamentDto,
      prizeDistribution,
      startDate: new Date(createTournamentDto.startDate),
      endDate: createTournamentDto.endDate ? new Date(createTournamentDto.endDate) : undefined,
      registrationStartDate: createTournamentDto.registrationStartDate
        ? new Date(createTournamentDto.registrationStartDate)
        : undefined,
      registrationEndDate: createTournamentDto.registrationEndDate
        ? new Date(createTournamentDto.registrationEndDate)
        : undefined,
      checkInStartDate: createTournamentDto.checkInStartDate
        ? new Date(createTournamentDto.checkInStartDate)
        : undefined,
      checkInEndDate: createTournamentDto.checkInEndDate
        ? new Date(createTournamentDto.checkInEndDate)
        : undefined,
    });

    return this.tournamentRepository.save(tournament);
  }

  async findById(id: string): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id },
      relations: ['registrations', 'matches', 'brackets', 'standings', 'prizes'],
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${id} not found`);
    }

    return tournament;
  }

  async findAll(options: TournamentQueryOptions = {}): Promise<PaginatedResult<Tournament>> {
    const {
      gameId,
      status,
      visibility,
      organizerId,
      format,
      search,
      startDateFrom,
      startDateTo,
      page = 1,
      limit = 20,
      sortBy = 'startDate',
      sortOrder = 'ASC',
    } = options;

    const where: FindOptionsWhere<Tournament> = {};

    if (gameId) {
      where.gameId = gameId;
    }

    if (status) {
      where.status = Array.isArray(status) ? In(status) : status;
    }

    if (visibility) {
      where.visibility = visibility;
    }

    if (organizerId) {
      where.organizerId = organizerId;
    }

    if (format) {
      where.format = format;
    }

    if (search) {
      where.name = ILike(`%${search}%`);
    }

    if (startDateFrom && startDateTo) {
      where.startDate = Between(startDateFrom, startDateTo);
    }

    const [data, total] = await this.tournamentRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updateTournamentDto: UpdateTournamentDto): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (
      tournament.status === TournamentStatus.COMPLETED ||
      tournament.status === TournamentStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot update a completed or cancelled tournament');
    }

    const updateData: Partial<Tournament> = {};

    if (updateTournamentDto.name) updateData.name = updateTournamentDto.name;
    if (updateTournamentDto.description) updateData.description = updateTournamentDto.description;
    if (updateTournamentDto.gameId) updateData.gameId = updateTournamentDto.gameId;
    if (updateTournamentDto.gameName) updateData.gameName = updateTournamentDto.gameName;
    if (updateTournamentDto.format) updateData.format = updateTournamentDto.format;
    if (updateTournamentDto.visibility) updateData.visibility = updateTournamentDto.visibility;
    if (updateTournamentDto.registrationType)
      updateData.registrationType = updateTournamentDto.registrationType;
    if (updateTournamentDto.teamSize !== undefined)
      updateData.teamSize = updateTournamentDto.teamSize;
    if (updateTournamentDto.maxParticipants !== undefined)
      updateData.maxParticipants = updateTournamentDto.maxParticipants;
    if (updateTournamentDto.minParticipants !== undefined)
      updateData.minParticipants = updateTournamentDto.minParticipants;
    if (updateTournamentDto.prizePool !== undefined)
      updateData.prizePool = updateTournamentDto.prizePool;
    if (updateTournamentDto.prizeCurrency)
      updateData.prizeCurrency = updateTournamentDto.prizeCurrency;
    if (updateTournamentDto.entryFee !== undefined)
      updateData.entryFee = updateTournamentDto.entryFee;
    if (updateTournamentDto.entryFeeCurrency)
      updateData.entryFeeCurrency = updateTournamentDto.entryFeeCurrency;
    if (updateTournamentDto.rules) updateData.rules = updateTournamentDto.rules;
    if (updateTournamentDto.streamUrl) updateData.streamUrl = updateTournamentDto.streamUrl;

    if (updateTournamentDto.prizeDistribution) {
      updateData.prizeDistribution = this.convertPrizeDistribution(
        updateTournamentDto.prizeDistribution,
      );
    }

    if (updateTournamentDto.startDate) {
      updateData.startDate = new Date(updateTournamentDto.startDate);
    }

    if (updateTournamentDto.endDate) {
      updateData.endDate = new Date(updateTournamentDto.endDate);
    }

    if (updateTournamentDto.registrationStartDate) {
      updateData.registrationStartDate = new Date(updateTournamentDto.registrationStartDate);
    }

    if (updateTournamentDto.registrationEndDate) {
      updateData.registrationEndDate = new Date(updateTournamentDto.registrationEndDate);
    }

    if (updateTournamentDto.checkInStartDate) {
      updateData.checkInStartDate = new Date(updateTournamentDto.checkInStartDate);
    }

    if (updateTournamentDto.checkInEndDate) {
      updateData.checkInEndDate = new Date(updateTournamentDto.checkInEndDate);
    }

    Object.assign(tournament, updateData);
    return this.tournamentRepository.save(tournament);
  }

  async delete(id: string): Promise<void> {
    const tournament = await this.findById(id);

    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot delete a tournament that is in progress');
    }

    await this.tournamentRepository.remove(tournament);
  }

  async setFormat(id: string, format: TournamentFormat): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new BadRequestException('Can only change format while tournament is in draft status');
    }

    tournament.format = format;
    return this.tournamentRepository.save(tournament);
  }

  async configureRegistration(
    id: string,
    config: {
      registrationType?: 'open' | 'invite_only';
      teamSize?: number;
      maxParticipants?: number;
      minParticipants?: number;
    },
  ): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (
      tournament.status !== TournamentStatus.DRAFT &&
      tournament.status !== TournamentStatus.REGISTRATION_OPEN
    ) {
      throw new BadRequestException('Cannot modify registration settings at this stage');
    }

    Object.assign(tournament, config);
    return this.tournamentRepository.save(tournament);
  }

  async setEntryRequirements(
    id: string,
    requirements: {
      minMmr?: number;
      maxMmr?: number;
      requiresIdentityVerification?: boolean;
      allowedRegions?: string[];
    },
  ): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (tournament.status !== TournamentStatus.DRAFT) {
      throw new BadRequestException('Can only set entry requirements while in draft status');
    }

    Object.assign(tournament, requirements);
    return this.tournamentRepository.save(tournament);
  }

  async configurePrizePool(
    id: string,
    config: {
      prizePool: number;
      prizeCurrency?: string;
      prizeDistribution?: PrizeDistributionDto[];
    },
  ): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (
      tournament.status === TournamentStatus.COMPLETED ||
      tournament.status === TournamentStatus.CANCELLED
    ) {
      throw new BadRequestException('Cannot modify prize pool for completed/cancelled tournament');
    }

    tournament.prizePool = config.prizePool;

    if (config.prizeCurrency) {
      tournament.prizeCurrency = config.prizeCurrency;
    }

    if (config.prizeDistribution) {
      const totalPercentage = config.prizeDistribution.reduce((sum, p) => sum + p.percentage, 0);
      if (totalPercentage > 100) {
        throw new BadRequestException('Prize distribution percentages cannot exceed 100%');
      }
      const converted = this.convertPrizeDistribution(config.prizeDistribution);
      if (converted) {
        tournament.prizeDistribution = converted;
      }
    }

    return this.tournamentRepository.save(tournament);
  }

  async setSchedule(
    id: string,
    schedule: {
      checkInStartDate?: string;
      checkInEndDate?: string;
      startDate?: string;
      endDate?: string;
      matchIntervalMinutes?: number;
    },
  ): Promise<Tournament> {
    const tournament = await this.findById(id);

    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot modify schedule while tournament is in progress');
    }

    if (schedule.checkInStartDate) {
      tournament.checkInStartDate = new Date(schedule.checkInStartDate);
    }

    if (schedule.checkInEndDate) {
      tournament.checkInEndDate = new Date(schedule.checkInEndDate);
    }

    if (schedule.startDate) {
      tournament.startDate = new Date(schedule.startDate);
    }

    if (schedule.endDate) {
      tournament.endDate = new Date(schedule.endDate);
    }

    if (schedule.matchIntervalMinutes) {
      tournament.matchIntervalMinutes = schedule.matchIntervalMinutes;
    }

    return this.tournamentRepository.save(tournament);
  }

  async setRules(id: string, rules: string): Promise<Tournament> {
    const tournament = await this.findById(id);
    tournament.rules = rules;
    return this.tournamentRepository.save(tournament);
  }

  async setVisibility(id: string, visibility: TournamentVisibility): Promise<Tournament> {
    const tournament = await this.findById(id);
    tournament.visibility = visibility;
    return this.tournamentRepository.save(tournament);
  }

  async configureStreaming(
    id: string,
    config: {
      allowSpectators?: boolean;
      enableStreaming?: boolean;
      streamUrl?: string;
    },
  ): Promise<Tournament> {
    const tournament = await this.findById(id);
    Object.assign(tournament, config);
    return this.tournamentRepository.save(tournament);
  }

  async cloneAsTemplate(id: string, newName: string, organizerId: string): Promise<Tournament> {
    const sourceTournament = await this.findById(id);

    const clonedTournament = this.tournamentRepository.create({
      name: newName,
      description: sourceTournament.description,
      gameId: sourceTournament.gameId,
      gameName: sourceTournament.gameName,
      format: sourceTournament.format,
      status: TournamentStatus.DRAFT,
      visibility: sourceTournament.visibility,
      registrationType: sourceTournament.registrationType,
      organizerId,
      teamSize: sourceTournament.teamSize,
      maxParticipants: sourceTournament.maxParticipants,
      minParticipants: sourceTournament.minParticipants,
      minMmr: sourceTournament.minMmr,
      maxMmr: sourceTournament.maxMmr,
      requiresIdentityVerification: sourceTournament.requiresIdentityVerification,
      allowedRegions: sourceTournament.allowedRegions,
      prizePool: sourceTournament.prizePool,
      prizeCurrency: sourceTournament.prizeCurrency,
      prizeDistribution: sourceTournament.prizeDistribution,
      entryFee: sourceTournament.entryFee,
      entryFeeCurrency: sourceTournament.entryFeeCurrency,
      matchIntervalMinutes: sourceTournament.matchIntervalMinutes,
      rules: sourceTournament.rules,
      allowSpectators: sourceTournament.allowSpectators,
      enableStreaming: sourceTournament.enableStreaming,
      swissRounds: sourceTournament.swissRounds,
      grandFinalsReset: sourceTournament.grandFinalsReset,
      templateId: sourceTournament.id,
      startDate: new Date(),
    });

    return this.tournamentRepository.save(clonedTournament);
  }

  async updateStatus(id: string, status: TournamentStatus): Promise<Tournament> {
    const tournament = await this.findById(id);

    const validTransitions: Record<TournamentStatus, TournamentStatus[]> = {
      [TournamentStatus.DRAFT]: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.CANCELLED],
      [TournamentStatus.REGISTRATION_OPEN]: [
        TournamentStatus.REGISTRATION_CLOSED,
        TournamentStatus.CANCELLED,
      ],
      [TournamentStatus.REGISTRATION_CLOSED]: [
        TournamentStatus.CHECK_IN,
        TournamentStatus.IN_PROGRESS,
        TournamentStatus.CANCELLED,
      ],
      [TournamentStatus.CHECK_IN]: [TournamentStatus.IN_PROGRESS, TournamentStatus.CANCELLED],
      [TournamentStatus.IN_PROGRESS]: [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED],
      [TournamentStatus.COMPLETED]: [],
      [TournamentStatus.CANCELLED]: [],
    };

    if (!validTransitions[tournament.status].includes(status)) {
      throw new BadRequestException(`Cannot transition from ${tournament.status} to ${status}`);
    }

    tournament.status = status;
    return this.tournamentRepository.save(tournament);
  }

  async openRegistration(id: string): Promise<Tournament> {
    return this.updateStatus(id, TournamentStatus.REGISTRATION_OPEN);
  }

  async closeRegistration(id: string): Promise<Tournament> {
    return this.updateStatus(id, TournamentStatus.REGISTRATION_CLOSED);
  }

  async startCheckIn(id: string): Promise<Tournament> {
    return this.updateStatus(id, TournamentStatus.CHECK_IN);
  }

  async startTournament(id: string): Promise<Tournament> {
    return this.updateStatus(id, TournamentStatus.IN_PROGRESS);
  }

  async completeTournament(id: string): Promise<Tournament> {
    return this.updateStatus(id, TournamentStatus.COMPLETED);
  }

  async cancelTournament(id: string): Promise<Tournament> {
    return this.updateStatus(id, TournamentStatus.CANCELLED);
  }

  async getPublicTournaments(
    options: TournamentQueryOptions = {},
  ): Promise<PaginatedResult<Tournament>> {
    return this.findAll({
      ...options,
      visibility: TournamentVisibility.PUBLIC,
      status: [TournamentStatus.REGISTRATION_OPEN, TournamentStatus.IN_PROGRESS],
    });
  }

  async getUpcomingTournaments(gameId?: string, limit = 10): Promise<Tournament[]> {
    const where: FindOptionsWhere<Tournament> = {
      visibility: TournamentVisibility.PUBLIC,
      status: In([TournamentStatus.REGISTRATION_OPEN, TournamentStatus.REGISTRATION_CLOSED]),
    };

    if (gameId) {
      where.gameId = gameId;
    }

    return this.tournamentRepository.find({
      where,
      order: { startDate: 'ASC' },
      take: limit,
    });
  }

  async getOrganizerTournaments(
    organizerId: string,
    options: TournamentQueryOptions = {},
  ): Promise<PaginatedResult<Tournament>> {
    return this.findAll({
      ...options,
      organizerId,
    });
  }

  private convertPrizeDistribution(
    distribution?: PrizeDistributionDto[],
  ): Record<number, number> | undefined {
    if (!distribution) return undefined;

    return distribution.reduce(
      (acc, item) => {
        acc[item.placement] = item.percentage;
        return acc;
      },
      {} as Record<number, number>,
    );
  }
}
