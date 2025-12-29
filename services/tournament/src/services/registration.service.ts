import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  TournamentRegistration,
  RegistrationStatus,
} from '../entities/tournament-registration.entity';
import { Tournament, TournamentStatus } from '../entities/tournament.entity';
import { TournamentStanding } from '../entities/tournament-standing.entity';
import {
  CreateRegistrationDto,
  SubstituteParticipantDto,
  ManualSeedDto,
  BulkSeedDto,
} from '../dto/registration.dto';

export interface RegistrationValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class RegistrationService {
  constructor(
    @InjectRepository(TournamentRegistration)
    private readonly registrationRepository: Repository<TournamentRegistration>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentStanding)
    private readonly standingRepository: Repository<TournamentStanding>,
  ) {}

  async registerIndividual(dto: CreateRegistrationDto): Promise<TournamentRegistration> {
    const tournament = await this.getTournament(dto.tournamentId);

    this.validateRegistrationOpen(tournament);

    const validationResult = await this.validateEntryRequirements(tournament, dto);
    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.errors.join(', '));
    }

    const existingRegistration = await this.registrationRepository.findOne({
      where: {
        tournamentId: dto.tournamentId,
        participantId: dto.participantId,
      },
    });

    if (existingRegistration) {
      throw new ConflictException('Participant is already registered for this tournament');
    }

    const currentCount = await this.getConfirmedRegistrationCount(dto.tournamentId);

    let status = RegistrationStatus.CONFIRMED;
    let waitlistPosition: number | undefined;

    if (currentCount >= tournament.maxParticipants) {
      status = RegistrationStatus.WAITLISTED;
      waitlistPosition = await this.getNextWaitlistPosition(dto.tournamentId);
    }

    const registration = this.registrationRepository.create({
      ...dto,
      status,
      waitlistPosition,
    });

    const savedRegistration = await this.registrationRepository.save(registration);

    await this.createStandingEntry(savedRegistration, tournament);

    return savedRegistration;
  }

  async registerTeam(dto: CreateRegistrationDto): Promise<TournamentRegistration> {
    const tournament = await this.getTournament(dto.tournamentId);

    if (tournament.teamSize <= 1) {
      throw new BadRequestException('This tournament is for individual participants only');
    }

    if (!dto.teamId || !dto.teamMemberIds || dto.teamMemberIds.length === 0) {
      throw new BadRequestException('Team ID and team members are required for team registration');
    }

    if (dto.teamMemberIds.length !== tournament.teamSize) {
      throw new BadRequestException(`Team must have exactly ${tournament.teamSize} members`);
    }

    this.validateRegistrationOpen(tournament);

    const validationResult = await this.validateEntryRequirements(tournament, dto);
    if (!validationResult.valid) {
      throw new BadRequestException(validationResult.errors.join(', '));
    }

    const existingTeamRegistration = await this.registrationRepository.findOne({
      where: {
        tournamentId: dto.tournamentId,
        teamId: dto.teamId,
      },
    });

    if (existingTeamRegistration) {
      throw new ConflictException('Team is already registered for this tournament');
    }

    for (const memberId of dto.teamMemberIds) {
      const existingMemberRegistration = await this.registrationRepository.findOne({
        where: {
          tournamentId: dto.tournamentId,
          participantId: memberId,
        },
      });

      if (existingMemberRegistration) {
        throw new ConflictException(
          `Team member ${memberId} is already registered in another team`,
        );
      }
    }

    const currentCount = await this.getConfirmedRegistrationCount(dto.tournamentId);

    let status = RegistrationStatus.CONFIRMED;
    let waitlistPosition: number | undefined;

    if (currentCount >= tournament.maxParticipants) {
      status = RegistrationStatus.WAITLISTED;
      waitlistPosition = await this.getNextWaitlistPosition(dto.tournamentId);
    }

    const registration = this.registrationRepository.create({
      ...dto,
      status,
      waitlistPosition,
    });

    const savedRegistration = await this.registrationRepository.save(registration);

    await this.createStandingEntry(savedRegistration, tournament);

    return savedRegistration;
  }

  async validateEntryRequirements(
    tournament: Tournament,
    dto: CreateRegistrationDto,
  ): Promise<RegistrationValidationResult> {
    const errors: string[] = [];

    if (tournament.minMmr && dto.mmr && dto.mmr < tournament.minMmr) {
      errors.push(`MMR ${dto.mmr} is below minimum requirement of ${tournament.minMmr}`);
    }

    if (tournament.maxMmr && dto.mmr && dto.mmr > tournament.maxMmr) {
      errors.push(`MMR ${dto.mmr} is above maximum requirement of ${tournament.maxMmr}`);
    }

    if (tournament.requiresIdentityVerification && !dto.identityVerified) {
      errors.push('Identity verification is required for this tournament');
    }

    if (
      tournament.allowedRegions &&
      tournament.allowedRegions.length > 0 &&
      dto.region &&
      !tournament.allowedRegions.includes(dto.region)
    ) {
      errors.push(`Region ${dto.region} is not allowed for this tournament`);
    }

    if (tournament.entryFee > 0) {
      if (!dto.entryFeePaid || dto.entryFeePaid < tournament.entryFee) {
        errors.push(
          `Entry fee of ${tournament.entryFee} ${tournament.entryFeeCurrency} is required`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async getWaitlist(tournamentId: string): Promise<TournamentRegistration[]> {
    return this.registrationRepository.find({
      where: {
        tournamentId,
        status: RegistrationStatus.WAITLISTED,
      },
      order: { waitlistPosition: 'ASC' },
    });
  }

  async cancelRegistration(
    registrationId: string,
    reason?: string,
  ): Promise<TournamentRegistration> {
    const registration = await this.getRegistration(registrationId);
    const tournament = await this.getTournament(registration.tournamentId);

    if (
      registration.status === RegistrationStatus.CANCELLED ||
      registration.status === RegistrationStatus.DISQUALIFIED
    ) {
      throw new BadRequestException('Registration is already cancelled or disqualified');
    }

    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      throw new BadRequestException('Cannot cancel registration while tournament is in progress');
    }

    const wasConfirmed = registration.status === RegistrationStatus.CONFIRMED;

    registration.status = RegistrationStatus.CANCELLED;
    registration.cancelledAt = new Date();
    if (reason) {
      registration.cancellationReason = reason;
    }

    const savedRegistration = await this.registrationRepository.save(registration);

    if (wasConfirmed) {
      await this.promoteFromWaitlist(registration.tournamentId);
    }

    return savedRegistration;
  }

  async issueRefund(
    registrationId: string,
    refundAmount: number,
    transactionId: string,
  ): Promise<TournamentRegistration> {
    const registration = await this.getRegistration(registrationId);

    if (registration.refundIssued) {
      throw new BadRequestException('Refund has already been issued');
    }

    registration.refundIssued = true;
    registration.refundAmount = refundAmount;
    registration.refundTransactionId = transactionId;

    return this.registrationRepository.save(registration);
  }

  async checkIn(registrationId: string): Promise<TournamentRegistration> {
    const registration = await this.getRegistration(registrationId);
    const tournament = await this.getTournament(registration.tournamentId);

    if (tournament.status !== TournamentStatus.CHECK_IN) {
      throw new BadRequestException('Check-in is not currently open');
    }

    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new BadRequestException('Only confirmed registrations can check in');
    }

    const now = new Date();
    if (tournament.checkInStartDate && now < tournament.checkInStartDate) {
      throw new BadRequestException('Check-in has not started yet');
    }

    if (tournament.checkInEndDate && now > tournament.checkInEndDate) {
      throw new BadRequestException('Check-in period has ended');
    }

    registration.status = RegistrationStatus.CHECKED_IN;
    registration.checkedInAt = now;

    return this.registrationRepository.save(registration);
  }

  async markNoShow(registrationId: string): Promise<TournamentRegistration> {
    const registration = await this.getRegistration(registrationId);

    if (registration.status !== RegistrationStatus.CONFIRMED) {
      throw new BadRequestException('Can only mark confirmed registrations as no-show');
    }

    registration.status = RegistrationStatus.NO_SHOW;

    return this.registrationRepository.save(registration);
  }

  async substituteParticipant(dto: SubstituteParticipantDto): Promise<TournamentRegistration> {
    const registration = await this.getRegistration(dto.registrationId);
    await this.getTournament(registration.tournamentId);

    if (
      registration.status === RegistrationStatus.CANCELLED ||
      registration.status === RegistrationStatus.DISQUALIFIED
    ) {
      throw new BadRequestException('Cannot substitute a cancelled or disqualified registration');
    }

    const existingRegistration = await this.registrationRepository.findOne({
      where: {
        tournamentId: registration.tournamentId,
        participantId: dto.newParticipantId,
      },
    });

    if (existingRegistration) {
      throw new ConflictException('New participant is already registered for this tournament');
    }

    registration.substitutedById = dto.newParticipantId;
    registration.substitutedByName = dto.newParticipantName;
    registration.substitutedAt = new Date();

    if (dto.newParticipantMmr) {
      registration.mmr = dto.newParticipantMmr;
    }

    const savedRegistration = await this.registrationRepository.save(registration);

    await this.standingRepository.update(
      {
        tournamentId: registration.tournamentId,
        participantId: registration.participantId,
      },
      {
        participantId: dto.newParticipantId,
        participantName: dto.newParticipantName,
      },
    );

    return savedRegistration;
  }

  async seedByMmr(tournamentId: string): Promise<TournamentRegistration[]> {
    const registrations = await this.registrationRepository.find({
      where: {
        tournamentId,
        status: In([RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN]),
      },
      order: { mmr: 'DESC' },
    });

    for (let i = 0; i < registrations.length; i++) {
      registrations[i].seed = i + 1;
    }

    return this.registrationRepository.save(registrations);
  }

  async setManualSeed(dto: ManualSeedDto): Promise<TournamentRegistration> {
    const registration = await this.getRegistration(dto.registrationId);

    registration.seed = dto.seed;

    return this.registrationRepository.save(registration);
  }

  async setBulkSeeds(dto: BulkSeedDto): Promise<TournamentRegistration[]> {
    const registrations: TournamentRegistration[] = [];

    for (const seedEntry of dto.seeds) {
      const registration = await this.getRegistration(seedEntry.registrationId);
      registration.seed = seedEntry.seed;
      registrations.push(registration);
    }

    return this.registrationRepository.save(registrations);
  }

  async getRegistrationsByTournament(
    tournamentId: string,
    status?: RegistrationStatus | RegistrationStatus[],
  ): Promise<TournamentRegistration[]> {
    const where: Record<string, unknown> = { tournamentId };

    if (status) {
      where.status = Array.isArray(status) ? In(status) : status;
    }

    return this.registrationRepository.find({
      where,
      order: { seed: 'ASC', createdAt: 'ASC' },
    });
  }

  async getRegistration(id: string): Promise<TournamentRegistration> {
    const registration = await this.registrationRepository.findOne({
      where: { id },
    });

    if (!registration) {
      throw new NotFoundException(`Registration with ID ${id} not found`);
    }

    return registration;
  }

  async getRegistrationByParticipant(
    tournamentId: string,
    participantId: string,
  ): Promise<TournamentRegistration | null> {
    return this.registrationRepository.findOne({
      where: { tournamentId, participantId },
    });
  }

  async getConfirmedRegistrationCount(tournamentId: string): Promise<number> {
    return this.registrationRepository.count({
      where: {
        tournamentId,
        status: In([RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN]),
      },
    });
  }

  async getCheckedInCount(tournamentId: string): Promise<number> {
    return this.registrationRepository.count({
      where: {
        tournamentId,
        status: RegistrationStatus.CHECKED_IN,
      },
    });
  }

  private async getTournament(tournamentId: string): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with ID ${tournamentId} not found`);
    }

    return tournament;
  }

  private validateRegistrationOpen(tournament: Tournament): void {
    if (tournament.status !== TournamentStatus.REGISTRATION_OPEN) {
      throw new BadRequestException('Registration is not currently open for this tournament');
    }

    const now = new Date();

    if (tournament.registrationStartDate && now < tournament.registrationStartDate) {
      throw new BadRequestException('Registration has not started yet');
    }

    if (tournament.registrationEndDate && now > tournament.registrationEndDate) {
      throw new BadRequestException('Registration period has ended');
    }
  }

  private async getNextWaitlistPosition(tournamentId: string): Promise<number> {
    const lastWaitlisted = await this.registrationRepository.findOne({
      where: {
        tournamentId,
        status: RegistrationStatus.WAITLISTED,
      },
      order: { waitlistPosition: 'DESC' },
    });

    return (lastWaitlisted?.waitlistPosition ?? 0) + 1;
  }

  private async promoteFromWaitlist(tournamentId: string): Promise<void> {
    const nextInWaitlist = await this.registrationRepository.findOne({
      where: {
        tournamentId,
        status: RegistrationStatus.WAITLISTED,
      },
      order: { waitlistPosition: 'ASC' },
    });

    if (nextInWaitlist) {
      nextInWaitlist.status = RegistrationStatus.CONFIRMED;
      nextInWaitlist.waitlistPosition = null as unknown as number;
      await this.registrationRepository.save(nextInWaitlist);

      const remainingWaitlist = await this.getWaitlist(tournamentId);
      for (let i = 0; i < remainingWaitlist.length; i++) {
        remainingWaitlist[i].waitlistPosition = i + 1;
      }
      await this.registrationRepository.save(remainingWaitlist);
    }
  }

  private async createStandingEntry(
    registration: TournamentRegistration,
    tournament: Tournament,
  ): Promise<void> {
    void tournament;
    if (registration.status !== RegistrationStatus.CONFIRMED) {
      return;
    }

    const standing = this.standingRepository.create({
      tournamentId: registration.tournamentId,
      participantId: registration.participantId,
      participantName: registration.participantName,
      teamId: registration.teamId,
      teamName: registration.teamName,
      seed: registration.seed ?? 0,
    });

    await this.standingRepository.save(standing);
  }
}
