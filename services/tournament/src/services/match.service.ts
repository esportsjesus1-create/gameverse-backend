import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual, Between } from 'typeorm';
import { TournamentMatch, MatchStatus, MatchType } from '../entities/tournament-match.entity';
import { Tournament } from '../entities/tournament.entity';
import { TournamentBracket, BracketStatus } from '../entities/tournament-bracket.entity';
import { TournamentStanding } from '../entities/tournament-standing.entity';
import {
  ScheduleMatchDto,
  SubmitMatchResultDto,
  ConfirmMatchResultDto,
  AdminOverrideResultDto,
  UpdateMatchStatusDto,
  MatchCheckInDto,
  RaiseDisputeDto,
  ResolveDisputeDto,
  PostponeMatchDto,
  AssignServerDto,
} from '../dto/match.dto';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(TournamentMatch)
    private readonly matchRepository: Repository<TournamentMatch>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentBracket)
    private readonly bracketRepository: Repository<TournamentBracket>,
    @InjectRepository(TournamentStanding)
    private readonly standingRepository: Repository<TournamentStanding>,
  ) {}

  async autoScheduleMatches(tournamentId: string): Promise<TournamentMatch[]> {
    const tournament = await this.getTournament(tournamentId);

    const pendingMatches = await this.matchRepository.find({
      where: {
        tournamentId,
        status: MatchStatus.PENDING,
      },
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    let currentTime = new Date(tournament.startDate);
    const intervalMs = tournament.matchIntervalMinutes * 60 * 1000;

    const matchesByRound = new Map<number, TournamentMatch[]>();
    for (const match of pendingMatches) {
      if (!matchesByRound.has(match.round)) {
        matchesByRound.set(match.round, []);
      }
      matchesByRound.get(match.round)!.push(match);
    }

    const scheduledMatches: TournamentMatch[] = [];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [round, matches] of matchesByRound) {
      for (const match of matches) {
        if (match.participant1Id && match.participant2Id) {
          match.scheduledAt = new Date(currentTime);
          match.status = MatchStatus.SCHEDULED;
          scheduledMatches.push(await this.matchRepository.save(match));
          currentTime = new Date(currentTime.getTime() + intervalMs);
        }
      }

      currentTime = new Date(currentTime.getTime() + intervalMs);
    }

    return scheduledMatches;
  }

  async scheduleMatch(dto: ScheduleMatchDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (match.status !== MatchStatus.PENDING && match.status !== MatchStatus.SCHEDULED) {
      throw new BadRequestException('Can only schedule pending or already scheduled matches');
    }

    match.scheduledAt = new Date(dto.scheduledAt);
    match.status = MatchStatus.SCHEDULED;

    if (dto.serverId) {
      match.serverId = dto.serverId;
    }

    if (dto.serverName) {
      match.serverName = dto.serverName;
    }

    if (dto.lobbyCode) {
      match.lobbyCode = dto.lobbyCode;
    }

    return this.matchRepository.save(match);
  }

  async rescheduleMatch(dto: PostponeMatchDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot reschedule a completed or cancelled match');
    }

    match.scheduledAt = new Date(dto.newScheduledAt);
    match.status = MatchStatus.POSTPONED;

    if (dto.reason) {
      match.metadata = {
        ...match.metadata,
        postponementReason: dto.reason,
        postponedAt: new Date(),
      };
    }

    return this.matchRepository.save(match);
  }

  async assignServer(dto: AssignServerDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    match.serverId = dto.serverId;
    if (dto.serverName) {
      match.serverName = dto.serverName;
    }
    match.lobbyCode = dto.lobbyCode ?? this.generateLobbyCodeSync();

    return this.matchRepository.save(match);
  }

  generateLobbyCodeSync(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async generateLobbyCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async checkInToMatch(dto: MatchCheckInDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (match.status !== MatchStatus.SCHEDULED && match.status !== MatchStatus.CHECK_IN) {
      throw new BadRequestException('Match is not ready for check-in');
    }

    const now = new Date();

    if (dto.participantId === match.participant1Id) {
      match.participant1CheckedIn = true;
      match.participant1CheckedInAt = now;
    } else if (dto.participantId === match.participant2Id) {
      match.participant2CheckedIn = true;
      match.participant2CheckedInAt = now;
    } else {
      throw new BadRequestException('Participant is not part of this match');
    }

    if (match.participant1CheckedIn && match.participant2CheckedIn) {
      match.status = MatchStatus.IN_PROGRESS;
      match.startedAt = now;
    } else {
      match.status = MatchStatus.CHECK_IN;
    }

    return this.matchRepository.save(match);
  }

  async submitResult(dto: SubmitMatchResultDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (
      match.status !== MatchStatus.IN_PROGRESS &&
      match.status !== MatchStatus.CHECK_IN &&
      match.status !== MatchStatus.SCHEDULED
    ) {
      throw new BadRequestException('Match is not in a state that accepts results');
    }

    if (dto.winnerId !== match.participant1Id && dto.winnerId !== match.participant2Id) {
      throw new BadRequestException('Winner must be one of the match participants');
    }

    match.participant1Score = dto.participant1Score;
    match.participant2Score = dto.participant2Score;
    match.winnerId = dto.winnerId;
    match.winnerName =
      dto.winnerId === match.participant1Id ? match.participant1Name : match.participant2Name;
    match.loserId =
      dto.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
    match.loserName =
      dto.winnerId === match.participant1Id ? match.participant2Name : match.participant1Name;

    if (dto.gameStats) {
      match.gameStats = dto.gameStats;
    }

    if (dto.submitterId === match.participant1Id) {
      match.participant1Confirmed = true;
    } else if (dto.submitterId === match.participant2Id) {
      match.participant2Confirmed = true;
    }

    match.status = MatchStatus.AWAITING_CONFIRMATION;

    return this.matchRepository.save(match);
  }

  async confirmResult(dto: ConfirmMatchResultDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (match.status !== MatchStatus.AWAITING_CONFIRMATION) {
      throw new BadRequestException('Match is not awaiting confirmation');
    }

    if (dto.participantId === match.participant1Id) {
      match.participant1Confirmed = dto.confirmed;
    } else if (dto.participantId === match.participant2Id) {
      match.participant2Confirmed = dto.confirmed;
    } else {
      throw new BadRequestException('Participant is not part of this match');
    }

    if (!dto.confirmed) {
      match.status = MatchStatus.DISPUTED;
      match.disputeReason = 'Result confirmation rejected';
      match.disputeRaisedBy = dto.participantId;
      match.disputeRaisedAt = new Date();
    } else if (match.participant1Confirmed && match.participant2Confirmed) {
      match.status = MatchStatus.COMPLETED;
      match.completedAt = new Date();

      await this.updateStandingsAfterMatch(match);
      await this.advanceWinner(match);
      await this.handleLoser(match);
    }

    return this.matchRepository.save(match);
  }

  async adminOverrideResult(dto: AdminOverrideResultDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (dto.winnerId !== match.participant1Id && dto.winnerId !== match.participant2Id) {
      throw new BadRequestException('Winner must be one of the match participants');
    }

    match.participant1Score = dto.participant1Score;
    match.participant2Score = dto.participant2Score;
    match.winnerId = dto.winnerId;
    match.winnerName =
      dto.winnerId === match.participant1Id ? match.participant1Name : match.participant2Name;
    match.loserId =
      dto.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
    match.loserName =
      dto.winnerId === match.participant1Id ? match.participant2Name : match.participant1Name;

    match.adminOverride = true;
    match.adminOverrideBy = dto.adminId;
    match.adminOverrideAt = new Date();
    match.adminOverrideReason = dto.reason;

    match.participant1Confirmed = true;
    match.participant2Confirmed = true;
    match.status = MatchStatus.COMPLETED;
    match.completedAt = new Date();

    const savedMatch = await this.matchRepository.save(match);

    await this.updateStandingsAfterMatch(savedMatch);
    await this.advanceWinner(savedMatch);
    await this.handleLoser(savedMatch);

    return savedMatch;
  }

  async raiseDispute(dto: RaiseDisputeDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (dto.participantId !== match.participant1Id && dto.participantId !== match.participant2Id) {
      throw new BadRequestException('Only match participants can raise disputes');
    }

    match.status = MatchStatus.DISPUTED;
    match.disputeReason = dto.reason;
    match.disputeRaisedBy = dto.participantId;
    match.disputeRaisedAt = new Date();

    return this.matchRepository.save(match);
  }

  async resolveDispute(dto: ResolveDisputeDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (match.status !== MatchStatus.DISPUTED) {
      throw new BadRequestException('Match is not in disputed state');
    }

    match.disputeResolution = dto.resolution;
    match.disputeResolvedBy = dto.adminId;
    match.disputeResolvedAt = new Date();

    if (
      dto.winnerId &&
      dto.participant1Score !== undefined &&
      dto.participant2Score !== undefined
    ) {
      match.participant1Score = dto.participant1Score;
      match.participant2Score = dto.participant2Score;
      match.winnerId = dto.winnerId;
      match.winnerName =
        dto.winnerId === match.participant1Id ? match.participant1Name : match.participant2Name;
      match.loserId =
        dto.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
      match.loserName =
        dto.winnerId === match.participant1Id ? match.participant2Name : match.participant1Name;

      match.adminOverride = true;
      match.adminOverrideBy = dto.adminId;
      match.adminOverrideAt = new Date();
      match.adminOverrideReason = dto.resolution;

      match.status = MatchStatus.COMPLETED;
      match.completedAt = new Date();

      const savedMatch = await this.matchRepository.save(match);

      await this.updateStandingsAfterMatch(savedMatch);
      await this.advanceWinner(savedMatch);
      await this.handleLoser(savedMatch);

      return savedMatch;
    }

    match.status = MatchStatus.IN_PROGRESS;
    return this.matchRepository.save(match);
  }

  async updateMatchStatus(dto: UpdateMatchStatusDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    match.status = dto.status;

    if (dto.reason) {
      match.metadata = {
        ...match.metadata,
        statusChangeReason: dto.reason,
        statusChangedAt: new Date(),
      };
    }

    if (dto.status === MatchStatus.IN_PROGRESS && !match.startedAt) {
      match.startedAt = new Date();
    }

    if (dto.status === MatchStatus.COMPLETED && !match.completedAt) {
      match.completedAt = new Date();
    }

    return this.matchRepository.save(match);
  }

  async postponeMatch(dto: PostponeMatchDto): Promise<TournamentMatch> {
    const match = await this.getMatch(dto.matchId);

    if (match.status === MatchStatus.COMPLETED || match.status === MatchStatus.CANCELLED) {
      throw new BadRequestException('Cannot postpone a completed or cancelled match');
    }

    match.status = MatchStatus.POSTPONED;
    match.scheduledAt = new Date(dto.newScheduledAt);

    if (dto.reason) {
      match.metadata = {
        ...match.metadata,
        postponementReason: dto.reason,
        postponedAt: new Date(),
      };
    }

    return this.matchRepository.save(match);
  }

  async getMatch(id: string): Promise<TournamentMatch> {
    const match = await this.matchRepository.findOne({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException(`Match with ID ${id} not found`);
    }

    return match;
  }

  async getMatchesByTournament(
    tournamentId: string,
    options?: {
      status?: MatchStatus | MatchStatus[];
      round?: number;
      bracketId?: string;
      participantId?: string;
    },
  ): Promise<TournamentMatch[]> {
    const where: Record<string, unknown> = { tournamentId };

    if (options?.status) {
      where.status = Array.isArray(options.status) ? In(options.status) : options.status;
    }

    if (options?.round) {
      where.round = options.round;
    }

    if (options?.bracketId) {
      where.bracketId = options.bracketId;
    }

    const matches = await this.matchRepository.find({
      where,
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    if (options?.participantId) {
      return matches.filter(
        (m) =>
          m.participant1Id === options.participantId || m.participant2Id === options.participantId,
      );
    }

    return matches;
  }

  async getUpcomingMatches(tournamentId: string, limit = 10): Promise<TournamentMatch[]> {
    const now = new Date();

    return this.matchRepository.find({
      where: {
        tournamentId,
        status: In([MatchStatus.SCHEDULED, MatchStatus.CHECK_IN]),
        scheduledAt: MoreThanOrEqual(now),
      },
      order: { scheduledAt: 'ASC' },
      take: limit,
    });
  }

  async getMatchesInTimeRange(
    tournamentId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<TournamentMatch[]> {
    return this.matchRepository.find({
      where: {
        tournamentId,
        scheduledAt: Between(startTime, endTime),
      },
      order: { scheduledAt: 'ASC' },
    });
  }

  async getParticipantMatches(
    tournamentId: string,
    participantId: string,
  ): Promise<TournamentMatch[]> {
    return this.matchRepository.find({
      where: [
        { tournamentId, participant1Id: participantId },
        { tournamentId, participant2Id: participantId },
      ],
      order: { round: 'ASC', matchNumber: 'ASC' },
    });
  }

  async getDisputedMatches(tournamentId: string): Promise<TournamentMatch[]> {
    return this.matchRepository.find({
      where: {
        tournamentId,
        status: MatchStatus.DISPUTED,
      },
      order: { disputeRaisedAt: 'ASC' },
    });
  }

  async detectResultManipulation(matchId: string): Promise<boolean> {
    const match = await this.getMatch(matchId);

    if (!match.gameStats || !Array.isArray(match.gameStats)) {
      return false;
    }

    const suspiciousPatterns: boolean[] = [];

    if (match.participant1Score === 0 && match.participant2Score === 0) {
      suspiciousPatterns.push(true);
    }

    const totalGames = (match.participant1Score ?? 0) + (match.participant2Score ?? 0);
    if (totalGames > 0 && match.gamesPlayed !== totalGames) {
      suspiciousPatterns.push(true);
    }

    return suspiciousPatterns.some((p) => p);
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

  private async updateStandingsAfterMatch(match: TournamentMatch): Promise<void> {
    if (!match.winnerId || !match.loserId) return;

    const winnerStanding = await this.standingRepository.findOne({
      where: {
        tournamentId: match.tournamentId,
        participantId: match.winnerId,
      },
    });

    if (winnerStanding) {
      winnerStanding.wins += 1;
      winnerStanding.matchesPlayed += 1;
      winnerStanding.gamesWon +=
        match.participant1Id === match.winnerId
          ? (match.participant1Score ?? 0)
          : (match.participant2Score ?? 0);
      winnerStanding.gamesLost +=
        match.participant1Id === match.winnerId
          ? (match.participant2Score ?? 0)
          : (match.participant1Score ?? 0);
      winnerStanding.points += 3;
      winnerStanding.winRate =
        winnerStanding.matchesPlayed > 0 ? winnerStanding.wins / winnerStanding.matchesPlayed : 0;

      if (winnerStanding.streakType === 'win') {
        winnerStanding.currentStreak += 1;
      } else {
        winnerStanding.streakType = 'win';
        winnerStanding.currentStreak = 1;
      }

      if (winnerStanding.currentStreak > winnerStanding.longestWinStreak) {
        winnerStanding.longestWinStreak = winnerStanding.currentStreak;
      }

      await this.standingRepository.save(winnerStanding);
    }

    const loserStanding = await this.standingRepository.findOne({
      where: {
        tournamentId: match.tournamentId,
        participantId: match.loserId,
      },
    });

    if (loserStanding) {
      loserStanding.losses += 1;
      loserStanding.matchesPlayed += 1;
      loserStanding.gamesWon +=
        match.participant1Id === match.loserId
          ? (match.participant1Score ?? 0)
          : (match.participant2Score ?? 0);
      loserStanding.gamesLost +=
        match.participant1Id === match.loserId
          ? (match.participant2Score ?? 0)
          : (match.participant1Score ?? 0);
      loserStanding.winRate =
        loserStanding.matchesPlayed > 0 ? loserStanding.wins / loserStanding.matchesPlayed : 0;

      if (loserStanding.streakType === 'loss') {
        loserStanding.currentStreak += 1;
      } else {
        loserStanding.streakType = 'loss';
        loserStanding.currentStreak = 1;
      }

      await this.standingRepository.save(loserStanding);
    }

    await this.updateRankings(match.tournamentId);
  }

  private async updateRankings(tournamentId: string): Promise<void> {
    const standings = await this.standingRepository.find({
      where: { tournamentId },
      order: { points: 'DESC', wins: 'DESC', winRate: 'DESC' },
    });

    for (let i = 0; i < standings.length; i++) {
      standings[i].rank = i + 1;
    }

    await this.standingRepository.save(standings);
  }

  private async advanceWinner(match: TournamentMatch): Promise<void> {
    if (!match.winnerId || !match.nextMatchId) return;

    const nextMatch = await this.matchRepository.findOne({
      where: { id: match.nextMatchId },
    });

    if (!nextMatch) return;

    if (!nextMatch.participant1Id) {
      nextMatch.participant1Id = match.winnerId;
      nextMatch.participant1Name = match.winnerName;
      nextMatch.participant1Seed =
        match.participant1Id === match.winnerId ? match.participant1Seed : match.participant2Seed;
    } else if (!nextMatch.participant2Id) {
      nextMatch.participant2Id = match.winnerId;
      nextMatch.participant2Name = match.winnerName;
      nextMatch.participant2Seed =
        match.participant1Id === match.winnerId ? match.participant1Seed : match.participant2Seed;
    }

    await this.matchRepository.save(nextMatch);

    await this.updateBracketProgress(match.bracketId);
  }

  private async handleLoser(match: TournamentMatch): Promise<void> {
    if (!match.loserId) return;

    if (match.loserNextMatchId) {
      const loserMatch = await this.matchRepository.findOne({
        where: { id: match.loserNextMatchId },
      });

      if (loserMatch) {
        if (!loserMatch.participant1Id) {
          loserMatch.participant1Id = match.loserId;
          loserMatch.participant1Name = match.loserName;
        } else if (!loserMatch.participant2Id) {
          loserMatch.participant2Id = match.loserId;
          loserMatch.participant2Name = match.loserName;
        }

        await this.matchRepository.save(loserMatch);
      }
    } else if (match.matchType === MatchType.WINNERS || match.matchType === MatchType.LOSERS) {
      const bracket = await this.bracketRepository.findOne({
        where: { id: match.bracketId },
      });

      if (bracket?.format === 'single_elimination' || match.matchType === MatchType.LOSERS) {
        const loserStanding = await this.standingRepository.findOne({
          where: {
            tournamentId: match.tournamentId,
            participantId: match.loserId,
          },
        });

        if (loserStanding) {
          loserStanding.isEliminated = true;
          loserStanding.eliminatedInRound = match.round;
          loserStanding.eliminatedBy = match.winnerId;
          await this.standingRepository.save(loserStanding);
        }
      }
    }
  }

  private async updateBracketProgress(bracketId: string | null): Promise<void> {
    if (!bracketId) return;

    const bracket = await this.bracketRepository.findOne({
      where: { id: bracketId },
    });

    if (!bracket) return;

    const completedMatches = await this.matchRepository.count({
      where: {
        bracketId,
        status: MatchStatus.COMPLETED,
      },
    });

    bracket.completedMatches = completedMatches;

    if (completedMatches > 0 && bracket.status === BracketStatus.GENERATED) {
      bracket.status = BracketStatus.IN_PROGRESS;
    }

    if (completedMatches === bracket.totalMatches) {
      bracket.status = BracketStatus.COMPLETED;
    }

    const highestCompletedRound = await this.matchRepository
      .createQueryBuilder('match')
      .select('MAX(match.round)', 'maxRound')
      .where('match.bracketId = :bracketId', { bracketId })
      .andWhere('match.status = :status', { status: MatchStatus.COMPLETED })
      .getRawOne();

    if (highestCompletedRound?.maxRound) {
      bracket.currentRound = highestCompletedRound.maxRound;
    }

    await this.bracketRepository.save(bracket);
  }
}
