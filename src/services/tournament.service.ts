import { v4 as uuidv4 } from 'uuid';
import {
  Tournament,
  Participant,
  Match,
  Bracket,
  BracketRound,
  CreateTournamentInput,
  RegisterParticipantInput,
  ReportMatchResultInput,
  PrizePool,
  DEFAULT_TOURNAMENT_SETTINGS,
  DEFAULT_PRIZE_DISTRIBUTION,
  TournamentError,
  TournamentNotFoundError,
  RegistrationClosedError,
  TournamentFullError,
  AlreadyRegisteredError,
  MatchNotFoundError,
  InvalidMatchResultError,
} from '../types';

const tournaments: Map<string, Tournament> = new Map();
const participants: Map<string, Map<string, Participant>> = new Map();
const matches: Map<string, Match> = new Map();

export class TournamentService {
  async createTournament(input: CreateTournamentInput): Promise<Tournament> {
    const tournamentId = uuidv4();
    const now = new Date();

    const prizePool: PrizePool = {
      total: input.prizePool?.total || 0,
      currency: input.prizePool?.currency || 'USD',
      distribution: input.prizePool?.distribution || DEFAULT_PRIZE_DISTRIBUTION.map(d => ({
        ...d,
        amount: ((input.prizePool?.total || 0) * d.percentage) / 100,
      })),
    };

    const tournament: Tournament = {
      id: tournamentId,
      name: input.name,
      description: input.description,
      gameMode: input.gameMode,
      format: input.format,
      status: 'draft',
      maxParticipants: input.maxParticipants,
      minParticipants: input.minParticipants || 2,
      entryFee: input.entryFee || 0,
      prizePool,
      rules: input.rules,
      settings: { ...DEFAULT_TOURNAMENT_SETTINGS, ...input.settings },
      registrationStartsAt: input.registrationStartsAt,
      registrationEndsAt: input.registrationEndsAt,
      startsAt: input.startsAt,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    tournaments.set(tournamentId, tournament);
    participants.set(tournamentId, new Map());

    return tournament;
  }

  async getTournamentById(id: string): Promise<Tournament | null> {
    return tournaments.get(id) || null;
  }

  async getTournaments(status?: string, page: number = 1, limit: number = 20): Promise<{ tournaments: Tournament[]; total: number }> {
    let result = Array.from(tournaments.values());

    if (status) {
      result = result.filter(t => t.status === status);
    }

    result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = result.length;
    const start = (page - 1) * limit;
    const paginatedResult = result.slice(start, start + limit);

    return { tournaments: paginatedResult, total };
  }

  async openRegistration(tournamentId: string): Promise<Tournament> {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError();
    }

    tournament.status = 'registration';
    tournament.updatedAt = new Date();

    return tournament;
  }

  async registerParticipant(input: RegisterParticipantInput): Promise<Participant> {
    const tournament = tournaments.get(input.tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError();
    }

    if (tournament.status !== 'registration') {
      throw new RegistrationClosedError();
    }

    const tournamentParticipants = participants.get(input.tournamentId)!;

    if (tournamentParticipants.size >= tournament.maxParticipants) {
      throw new TournamentFullError();
    }

    const existingParticipant = Array.from(tournamentParticipants.values()).find(
      p => p.userId === input.userId
    );
    if (existingParticipant) {
      throw new AlreadyRegisteredError();
    }

    const participantId = uuidv4();
    const participant: Participant = {
      id: participantId,
      tournamentId: input.tournamentId,
      userId: input.userId,
      username: input.username,
      teamId: input.teamId,
      teamName: input.teamName,
      status: 'registered',
      registeredAt: new Date(),
    };

    tournamentParticipants.set(participantId, participant);

    return participant;
  }

  async getParticipants(tournamentId: string): Promise<Participant[]> {
    const tournamentParticipants = participants.get(tournamentId);
    if (!tournamentParticipants) {
      throw new TournamentNotFoundError();
    }

    return Array.from(tournamentParticipants.values()).sort(
      (a, b) => a.registeredAt.getTime() - b.registeredAt.getTime()
    );
  }

  async checkInParticipant(tournamentId: string, odbyId: string): Promise<Participant> {
    const tournamentParticipants = participants.get(tournamentId);
    if (!tournamentParticipants) {
      throw new TournamentNotFoundError();
    }

    const participant = Array.from(tournamentParticipants.values()).find(
      p => p.userId === odbyId
    );
    if (!participant) {
      throw new TournamentError('Participant not found', 404, 'PARTICIPANT_NOT_FOUND');
    }

    participant.status = 'checked_in';
    participant.checkedInAt = new Date();

    return participant;
  }

  async startTournament(tournamentId: string): Promise<Bracket> {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError();
    }

    const tournamentParticipants = participants.get(tournamentId)!;
    const checkedInParticipants = Array.from(tournamentParticipants.values()).filter(
      p => p.status === 'checked_in' || (!tournament.settings.checkInRequired && p.status === 'registered')
    );

    if (checkedInParticipants.length < tournament.minParticipants) {
      throw new TournamentError('Not enough participants', 400, 'NOT_ENOUGH_PARTICIPANTS');
    }

    const seededParticipants = this.seedParticipants(checkedInParticipants, tournament.settings.seeding);
    const bracket = this.generateBracket(tournament, seededParticipants);

    tournament.status = 'in_progress';
    tournament.updatedAt = new Date();

    return bracket;
  }

  private seedParticipants(participantList: Participant[], seedingType: string): Participant[] {
    const seeded = [...participantList];

    if (seedingType === 'random') {
      for (let i = seeded.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seeded[i], seeded[j]] = [seeded[j], seeded[i]];
      }
    }

    seeded.forEach((p, index) => {
      p.seed = index + 1;
    });

    return seeded;
  }

  private generateBracket(tournament: Tournament, seededParticipants: Participant[]): Bracket {
    const bracket: Bracket = {
      tournamentId: tournament.id,
      format: tournament.format,
      rounds: [],
    };

    if (tournament.format === 'single_elimination') {
      bracket.rounds = this.generateSingleEliminationBracket(tournament.id, seededParticipants);
    } else if (tournament.format === 'double_elimination') {
      const { winnerBracket, loserBracket } = this.generateDoubleEliminationBracket(tournament.id, seededParticipants);
      bracket.rounds = winnerBracket;
      bracket.loserBracket = loserBracket;
    }

    return bracket;
  }

  private generateSingleEliminationBracket(tournamentId: string, seededParticipants: Participant[]): BracketRound[] {
    const rounds: BracketRound[] = [];
    const numParticipants = seededParticipants.length;
    const numRounds = Math.ceil(Math.log2(numParticipants));
    const bracketSize = Math.pow(2, numRounds);

    const paddedParticipants: (Participant | null)[] = [...seededParticipants];
    while (paddedParticipants.length < bracketSize) {
      paddedParticipants.push(null);
    }

    let matchNumber = 1;
    const roundMatches: Match[][] = [];

    for (let round = 1; round <= numRounds; round++) {
      const numMatches = bracketSize / Math.pow(2, round);
      const roundMatchList: Match[] = [];
      const roundName = this.getRoundName(round, numRounds);

      for (let i = 0; i < numMatches; i++) {
        const matchId = uuidv4();
        const match: Match = {
          id: matchId,
          tournamentId,
          round,
          matchNumber: matchNumber++,
          bracketPosition: `W${round}-${i + 1}`,
          status: 'pending',
        };

        if (round === 1) {
          const p1Index = i * 2;
          const p2Index = i * 2 + 1;
          match.participant1Id = paddedParticipants[p1Index]?.id;
          match.participant2Id = paddedParticipants[p2Index]?.id;

          if (!match.participant1Id && match.participant2Id) {
            match.winnerId = match.participant2Id;
            match.status = 'bye';
          } else if (match.participant1Id && !match.participant2Id) {
            match.winnerId = match.participant1Id;
            match.status = 'bye';
          }
        }

        matches.set(matchId, match);
        roundMatchList.push(match);
      }

      if (round > 1 && roundMatches[round - 2]) {
        const prevRoundMatches = roundMatches[round - 2];
        for (let i = 0; i < roundMatchList.length; i++) {
          const prevMatch1 = prevRoundMatches[i * 2];
          const prevMatch2 = prevRoundMatches[i * 2 + 1];
          if (prevMatch1) prevMatch1.nextMatchId = roundMatchList[i].id;
          if (prevMatch2) prevMatch2.nextMatchId = roundMatchList[i].id;
        }
      }

      roundMatches.push(roundMatchList);
      rounds.push({
        round,
        name: roundName,
        matches: roundMatchList,
      });
    }

    return rounds;
  }

  private generateDoubleEliminationBracket(tournamentId: string, seededParticipants: Participant[]): { winnerBracket: BracketRound[]; loserBracket: BracketRound[] } {
    const winnerBracket = this.generateSingleEliminationBracket(tournamentId, seededParticipants);
    const loserBracket: BracketRound[] = [];

    const numRounds = winnerBracket.length;
    let loserMatchNumber = 1000;

    for (let round = 1; round < numRounds * 2 - 1; round++) {
      const numMatches = Math.max(1, Math.floor(seededParticipants.length / Math.pow(2, Math.ceil(round / 2) + 1)));
      const roundMatchList: Match[] = [];

      for (let i = 0; i < numMatches; i++) {
        const matchId = uuidv4();
        const match: Match = {
          id: matchId,
          tournamentId,
          round,
          matchNumber: loserMatchNumber++,
          bracketPosition: `L${round}-${i + 1}`,
          status: 'pending',
        };

        matches.set(matchId, match);
        roundMatchList.push(match);
      }

      loserBracket.push({
        round,
        name: `Losers Round ${round}`,
        matches: roundMatchList,
      });
    }

    return { winnerBracket, loserBracket };
  }

  private getRoundName(round: number, totalRounds: number): string {
    const remaining = totalRounds - round;
    if (remaining === 0) return 'Finals';
    if (remaining === 1) return 'Semi-Finals';
    if (remaining === 2) return 'Quarter-Finals';
    return `Round ${round}`;
  }

  async reportMatchResult(input: ReportMatchResultInput): Promise<Match> {
    const match = matches.get(input.matchId);
    if (!match) {
      throw new MatchNotFoundError();
    }

    if (match.status === 'completed') {
      throw new TournamentError('Match already completed', 400, 'MATCH_ALREADY_COMPLETED');
    }

    if (input.winnerId !== match.participant1Id && input.winnerId !== match.participant2Id) {
      throw new InvalidMatchResultError();
    }

    match.winnerId = input.winnerId;
    match.loserId = input.winnerId === match.participant1Id ? match.participant2Id : match.participant1Id;
    match.score1 = input.score1;
    match.score2 = input.score2;
    match.status = 'completed';
    match.completedAt = new Date();

    if (match.nextMatchId) {
      const nextMatch = matches.get(match.nextMatchId);
      if (nextMatch) {
        if (!nextMatch.participant1Id) {
          nextMatch.participant1Id = match.winnerId;
        } else if (!nextMatch.participant2Id) {
          nextMatch.participant2Id = match.winnerId;
        }
      }
    }

    const tournament = tournaments.get(match.tournamentId);
    if (tournament && match.loserId) {
      const tournamentParticipants = participants.get(match.tournamentId);
      if (tournamentParticipants) {
        const loser = Array.from(tournamentParticipants.values()).find(p => p.id === match.loserId);
        if (loser && tournament.format === 'single_elimination') {
          loser.status = 'eliminated';
          loser.eliminatedAt = new Date();
        }
      }
    }

    await this.checkTournamentCompletion(match.tournamentId);

    return match;
  }

  private async checkTournamentCompletion(tournamentId: string): Promise<void> {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) return;

    const tournamentMatches = Array.from(matches.values()).filter(m => m.tournamentId === tournamentId);
    const allCompleted = tournamentMatches.every(m => m.status === 'completed' || m.status === 'bye');

    if (allCompleted) {
      tournament.status = 'completed';
      tournament.endsAt = new Date();
      tournament.updatedAt = new Date();

      const finalMatch = tournamentMatches.find(m => !m.nextMatchId && m.status === 'completed');
      if (finalMatch && finalMatch.winnerId) {
        const tournamentParticipants = participants.get(tournamentId);
        if (tournamentParticipants) {
          const winner = Array.from(tournamentParticipants.values()).find(p => p.id === finalMatch.winnerId);
          if (winner) {
            winner.status = 'winner';
            winner.finalPlacement = 1;
          }
        }
      }
    }
  }

  async getBracket(tournamentId: string): Promise<Bracket | null> {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError();
    }

    const tournamentMatches = Array.from(matches.values()).filter(m => m.tournamentId === tournamentId);
    if (tournamentMatches.length === 0) {
      return null;
    }

    const winnerMatches = tournamentMatches.filter(m => m.bracketPosition.startsWith('W'));
    const loserMatches = tournamentMatches.filter(m => m.bracketPosition.startsWith('L'));

    const rounds: BracketRound[] = [];
    const maxRound = Math.max(...winnerMatches.map(m => m.round));

    for (let round = 1; round <= maxRound; round++) {
      const roundMatches = winnerMatches.filter(m => m.round === round);
      rounds.push({
        round,
        name: this.getRoundName(round, maxRound),
        matches: roundMatches,
      });
    }

    const bracket: Bracket = {
      tournamentId,
      format: tournament.format,
      rounds,
    };

    if (loserMatches.length > 0) {
      const loserRounds: BracketRound[] = [];
      const maxLoserRound = Math.max(...loserMatches.map(m => m.round));

      for (let round = 1; round <= maxLoserRound; round++) {
        const roundMatches = loserMatches.filter(m => m.round === round);
        loserRounds.push({
          round,
          name: `Losers Round ${round}`,
          matches: roundMatches,
        });
      }

      bracket.loserBracket = loserRounds;
    }

    return bracket;
  }

  async getMatch(matchId: string): Promise<Match | null> {
    return matches.get(matchId) || null;
  }

  async cancelTournament(tournamentId: string): Promise<Tournament> {
    const tournament = tournaments.get(tournamentId);
    if (!tournament) {
      throw new TournamentNotFoundError();
    }

    tournament.status = 'cancelled';
    tournament.updatedAt = new Date();

    return tournament;
  }

  async withdrawParticipant(tournamentId: string, odbyId: string): Promise<void> {
    const tournamentParticipants = participants.get(tournamentId);
    if (!tournamentParticipants) {
      throw new TournamentNotFoundError();
    }

    const participant = Array.from(tournamentParticipants.values()).find(
      p => p.userId === odbyId
    );
    if (!participant) {
      throw new TournamentError('Participant not found', 404, 'PARTICIPANT_NOT_FOUND');
    }

    tournamentParticipants.delete(participant.id);
  }

  getParticipantCount(tournamentId: string): number {
    const tournamentParticipants = participants.get(tournamentId);
    return tournamentParticipants?.size || 0;
  }
}

export const tournamentService = new TournamentService();
