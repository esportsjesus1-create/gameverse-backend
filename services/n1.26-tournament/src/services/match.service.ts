import { MatchStatus, ParticipantStatus, TournamentStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { UpdateMatchDto, MatchInfo } from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';

export class MatchService {
  /**
   * Get match by ID
   */
  async getById(matchId: string): Promise<MatchInfo> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        player1: true,
        player2: true,
        winner: true,
      },
    });

    if (!match) {
      throw new NotFoundError('Match', matchId);
    }

    return this.mapToMatchInfo(match);
  }

  /**
   * Get matches for a tournament
   */
  async getByTournament(tournamentId: string): Promise<MatchInfo[]> {
    const matches = await prisma.match.findMany({
      where: { tournamentId },
      include: {
        player1: true,
        player2: true,
        winner: true,
      },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });

    return matches.map(m => this.mapToMatchInfo(m));
  }

  /**
   * Update match result
   */
  async updateResult(matchId: string, data: UpdateMatchDto): Promise<MatchInfo> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        tournament: true,
        player1: true,
        player2: true,
      },
    });

    if (!match) {
      throw new NotFoundError('Match', matchId);
    }

    // Validate match can be updated
    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestError('Match has already been completed');
    }

    if (match.status === MatchStatus.CANCELLED) {
      throw new BadRequestError('Match has been cancelled');
    }

    // Validate winner if provided
    if (data.winnerId) {
      if (data.winnerId !== match.player1Id && data.winnerId !== match.player2Id) {
        throw new BadRequestError('Winner must be one of the match participants');
      }
    }

    // Determine winner from scores if not explicitly provided
    let winnerId: string | undefined = data.winnerId;
    if (!winnerId && data.player1Score !== undefined && data.player2Score !== undefined) {
      if (data.player1Score > data.player2Score) {
        winnerId = match.player1Id ?? undefined;
      } else if (data.player2Score > data.player1Score) {
        winnerId = match.player2Id ?? undefined;
      }
    }

    const updateData: Record<string, unknown> = {};

    if (data.player1Score !== undefined) {
      updateData.player1Score = data.player1Score;
    }

    if (data.player2Score !== undefined) {
      updateData.player2Score = data.player2Score;
    }

    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt;
    }

    if (data.status !== undefined) {
      updateData.status = data.status;

      if (data.status === MatchStatus.IN_PROGRESS && !match.startedAt) {
        updateData.startedAt = new Date();
      }

      if (data.status === MatchStatus.COMPLETED) {
        updateData.completedAt = new Date();
      }
    }

    if (winnerId) {
      updateData.winnerId = winnerId;
      updateData.status = MatchStatus.COMPLETED;
      updateData.completedAt = new Date();
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: updateData,
      include: {
        player1: true,
        player2: true,
        winner: true,
      },
    });

    // If match is completed, advance winner to next match
    if (updated.status === MatchStatus.COMPLETED && updated.winnerId && updated.nextMatchId) {
      await this.advanceWinner(updated.id, updated.winnerId, updated.nextMatchId, updated.nextMatchSlot);
    }

    // Update loser status if match completed
    if (updated.status === MatchStatus.COMPLETED && updated.winnerId) {
      const loserId = updated.winnerId === updated.player1Id ? updated.player2Id : updated.player1Id;
      if (loserId) {
        await prisma.participant.update({
          where: { id: loserId },
          data: { status: ParticipantStatus.ELIMINATED },
        });
      }
    }

    // Check if tournament is complete
    await this.checkTournamentCompletion(match.tournamentId);

    logger.info(`Updated match ${matchId} result`);

    return this.mapToMatchInfo(updated);
  }

  /**
   * Start a match
   */
  async startMatch(matchId: string): Promise<MatchInfo> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundError('Match', matchId);
    }

    if (match.status !== MatchStatus.PENDING && match.status !== MatchStatus.SCHEDULED) {
      throw new BadRequestError(`Cannot start match with status ${match.status}`);
    }

    if (!match.player1Id || !match.player2Id) {
      throw new BadRequestError('Both players must be assigned before starting the match');
    }

    return this.updateResult(matchId, { status: MatchStatus.IN_PROGRESS });
  }

  /**
   * Cancel a match
   */
  async cancelMatch(matchId: string): Promise<MatchInfo> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundError('Match', matchId);
    }

    if (match.status === MatchStatus.COMPLETED) {
      throw new BadRequestError('Cannot cancel a completed match');
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: { status: MatchStatus.CANCELLED },
      include: {
        player1: true,
        player2: true,
        winner: true,
      },
    });

    logger.info(`Cancelled match ${matchId}`);

    return this.mapToMatchInfo(updated);
  }

  /**
   * Schedule a match
   */
  async scheduleMatch(matchId: string, scheduledAt: Date): Promise<MatchInfo> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundError('Match', matchId);
    }

    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestError(`Cannot schedule match with status ${match.status}`);
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        scheduledAt,
        status: MatchStatus.SCHEDULED,
      },
      include: {
        player1: true,
        player2: true,
        winner: true,
      },
    });

    logger.info(`Scheduled match ${matchId} for ${scheduledAt.toISOString()}`);

    return this.mapToMatchInfo(updated);
  }

  /**
   * Advance winner to next match
   */
  private async advanceWinner(
    matchId: string,
    winnerId: string,
    nextMatchId: string,
    nextMatchSlot: number | null
  ): Promise<void> {
    const updateData = nextMatchSlot === 1 
      ? { player1Id: winnerId }
      : { player2Id: winnerId };

    await prisma.match.update({
      where: { id: nextMatchId },
      data: updateData,
    });

    logger.info(`Advanced winner ${winnerId} from match ${matchId} to match ${nextMatchId}`);
  }

  /**
   * Check if tournament is complete
   */
  private async checkTournamentCompletion(tournamentId: string): Promise<void> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { matches: true },
    });

    if (!tournament) return;

    // Check if all matches are completed
    const allCompleted = tournament.matches.every(
      m => m.status === MatchStatus.COMPLETED || m.status === MatchStatus.BYE || m.status === MatchStatus.CANCELLED
    );

    if (allCompleted && tournament.status === TournamentStatus.IN_PROGRESS) {
      // Find the final match winner
      const finalMatch = tournament.matches
        .filter(m => m.status === MatchStatus.COMPLETED)
        .sort((a, b) => b.round - a.round)[0];

      if (finalMatch?.winnerId) {
        // Update winner status
        await prisma.participant.update({
          where: { id: finalMatch.winnerId },
          data: { status: ParticipantStatus.WINNER },
        });
      }

      // Update tournament status
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: TournamentStatus.COMPLETED },
      });

      logger.info(`Tournament ${tournamentId} completed`);
    }
  }

  /**
   * Map database model to DTO
   */
  private mapToMatchInfo(match: {
    id: string;
    round: number;
    position: number;
    player1: { id: string; name: string; email: string | null; seed: number | null; status: string; checkedInAt: Date | null } | null;
    player2: { id: string; name: string; email: string | null; seed: number | null; status: string; checkedInAt: Date | null } | null;
    winner: { id: string; name: string; email: string | null; seed: number | null; status: string; checkedInAt: Date | null } | null;
    player1Score: number | null;
    player2Score: number | null;
    status: MatchStatus;
    scheduledAt: Date | null;
    startedAt: Date | null;
    completedAt: Date | null;
  }): MatchInfo {
    return {
      id: match.id,
      round: match.round,
      position: match.position,
      player1: match.player1 ? {
        id: match.player1.id,
        name: match.player1.name,
        email: match.player1.email,
        seed: match.player1.seed,
        status: match.player1.status as ParticipantStatus,
        checkedInAt: match.player1.checkedInAt,
      } : null,
      player2: match.player2 ? {
        id: match.player2.id,
        name: match.player2.name,
        email: match.player2.email,
        seed: match.player2.seed,
        status: match.player2.status as ParticipantStatus,
        checkedInAt: match.player2.checkedInAt,
      } : null,
      winner: match.winner ? {
        id: match.winner.id,
        name: match.winner.name,
        email: match.winner.email,
        seed: match.winner.seed,
        status: match.winner.status as ParticipantStatus,
        checkedInAt: match.winner.checkedInAt,
      } : null,
      player1Score: match.player1Score,
      player2Score: match.player2Score,
      status: match.status,
      scheduledAt: match.scheduledAt,
      startedAt: match.startedAt,
      completedAt: match.completedAt,
    };
  }
}

export const matchService = new MatchService();
