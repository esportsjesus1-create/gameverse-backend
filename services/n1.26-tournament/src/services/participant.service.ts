import { ParticipantStatus, TournamentStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { CreateParticipantDto, UpdateParticipantDto, ParticipantInfo } from '../types';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import logger from '../utils/logger';

export class ParticipantService {
  /**
   * Add participant to tournament
   */
  async addParticipant(
    tournamentId: string,
    data: CreateParticipantDto
  ): Promise<ParticipantInfo> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { participants: true },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', tournamentId);
    }

    // Check if registration is open
    if (
      tournament.status !== TournamentStatus.DRAFT &&
      tournament.status !== TournamentStatus.REGISTRATION_OPEN
    ) {
      throw new BadRequestError('Tournament registration is not open');
    }

    // Check max participants
    if (tournament.participants.length >= tournament.maxParticipants) {
      throw new BadRequestError('Tournament has reached maximum participants');
    }

    // Check for duplicate registration
    if (data.userId) {
      const existingByUser = await prisma.participant.findFirst({
        where: { tournamentId, userId: data.userId },
      });
      if (existingByUser) {
        throw new ConflictError('User is already registered for this tournament');
      }
    }

    if (data.teamId) {
      const existingByTeam = await prisma.participant.findFirst({
        where: { tournamentId, teamId: data.teamId },
      });
      if (existingByTeam) {
        throw new ConflictError('Team is already registered for this tournament');
      }
    }

    // Assign seed if not provided
    const seed = data.seed ?? tournament.participants.length + 1;

    const participant = await prisma.participant.create({
      data: {
        tournamentId,
        userId: data.userId,
        teamId: data.teamId,
        name: data.name,
        email: data.email,
        seed,
      },
    });

    logger.info(`Added participant ${participant.id} to tournament ${tournamentId}`);

    return {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      seed: participant.seed,
      status: participant.status,
      checkedInAt: participant.checkedInAt,
    };
  }

  /**
   * Remove participant from tournament
   */
  async removeParticipant(tournamentId: string, participantId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', tournamentId);
    }

    const participant = await prisma.participant.findFirst({
      where: { id: participantId, tournamentId },
    });

    if (!participant) {
      throw new NotFoundError('Participant', participantId);
    }

    // Cannot remove if tournament has started
    if (tournament.status === TournamentStatus.IN_PROGRESS) {
      throw new BadRequestError('Cannot remove participant from an in-progress tournament');
    }

    await prisma.participant.delete({
      where: { id: participantId },
    });

    // Re-seed remaining participants
    await this.reorderSeeds(tournamentId);

    logger.info(`Removed participant ${participantId} from tournament ${tournamentId}`);
  }

  /**
   * Update participant
   */
  async updateParticipant(
    tournamentId: string,
    participantId: string,
    data: UpdateParticipantDto
  ): Promise<ParticipantInfo> {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, tournamentId },
    });

    if (!participant) {
      throw new NotFoundError('Participant', participantId);
    }

    const updated = await prisma.participant.update({
      where: { id: participantId },
      data,
    });

    logger.info(`Updated participant ${participantId}`);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      seed: updated.seed,
      status: updated.status,
      checkedInAt: updated.checkedInAt,
    };
  }

  /**
   * Check in participant
   */
  async checkIn(tournamentId: string, participantId: string): Promise<ParticipantInfo> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', tournamentId);
    }

    const participant = await prisma.participant.findFirst({
      where: { id: participantId, tournamentId },
    });

    if (!participant) {
      throw new NotFoundError('Participant', participantId);
    }

    if (participant.status === ParticipantStatus.CHECKED_IN) {
      throw new BadRequestError('Participant is already checked in');
    }

    const updated = await prisma.participant.update({
      where: { id: participantId },
      data: {
        status: ParticipantStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });

    logger.info(`Participant ${participantId} checked in to tournament ${tournamentId}`);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      seed: updated.seed,
      status: updated.status,
      checkedInAt: updated.checkedInAt,
    };
  }

  /**
   * Get participants for a tournament
   */
  async getParticipants(tournamentId: string): Promise<ParticipantInfo[]> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', tournamentId);
    }

    const participants = await prisma.participant.findMany({
      where: { tournamentId },
      orderBy: { seed: 'asc' },
    });

    return participants.map(p => ({
      id: p.id,
      name: p.name,
      email: p.email,
      seed: p.seed,
      status: p.status,
      checkedInAt: p.checkedInAt,
    }));
  }

  /**
   * Withdraw participant from tournament
   */
  async withdraw(tournamentId: string, participantId: string): Promise<ParticipantInfo> {
    const participant = await prisma.participant.findFirst({
      where: { id: participantId, tournamentId },
    });

    if (!participant) {
      throw new NotFoundError('Participant', participantId);
    }

    const updated = await prisma.participant.update({
      where: { id: participantId },
      data: {
        status: ParticipantStatus.WITHDRAWN,
      },
    });

    logger.info(`Participant ${participantId} withdrew from tournament ${tournamentId}`);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      seed: updated.seed,
      status: updated.status,
      checkedInAt: updated.checkedInAt,
    };
  }

  /**
   * Reorder seeds after participant removal
   */
  private async reorderSeeds(tournamentId: string): Promise<void> {
    const participants = await prisma.participant.findMany({
      where: { tournamentId },
      orderBy: { seed: 'asc' },
    });

    for (let i = 0; i < participants.length; i++) {
      await prisma.participant.update({
        where: { id: participants[i].id },
        data: { seed: i + 1 },
      });
    }
  }
}

export const participantService = new ParticipantService();
