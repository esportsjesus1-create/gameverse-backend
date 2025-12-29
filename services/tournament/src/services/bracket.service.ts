import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  TournamentBracket,
  BracketType,
  BracketStatus,
} from '../entities/tournament-bracket.entity';
import { TournamentMatch, MatchStatus, MatchType } from '../entities/tournament-match.entity';
import { Tournament, TournamentFormat, TournamentStatus } from '../entities/tournament.entity';
import {
  TournamentRegistration,
  RegistrationStatus,
} from '../entities/tournament-registration.entity';
import { TournamentStanding } from '../entities/tournament-standing.entity';
import {
  GenerateBracketDto,
  SeedEntryDto,
  ReseedBracketDto,
  DisqualifyParticipantDto,
  BracketResetDto,
  SwissPairingDto,
} from '../dto/bracket.dto';

interface BracketNode {
  matchNumber: number;
  round: number;
  participant1?: SeedEntryDto;
  participant2?: SeedEntryDto;
  nextMatchNumber?: number;
  loserNextMatchNumber?: number;
  isBye?: boolean;
}

interface SwissPairing {
  participant1: SeedEntryDto;
  participant2: SeedEntryDto | null;
}

@Injectable()
export class BracketService {
  constructor(
    @InjectRepository(TournamentBracket)
    private readonly bracketRepository: Repository<TournamentBracket>,
    @InjectRepository(TournamentMatch)
    private readonly matchRepository: Repository<TournamentMatch>,
    @InjectRepository(Tournament)
    private readonly tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentRegistration)
    private readonly registrationRepository: Repository<TournamentRegistration>,
    @InjectRepository(TournamentStanding)
    private readonly standingRepository: Repository<TournamentStanding>,
  ) {}

  async generateBracket(dto: GenerateBracketDto): Promise<TournamentBracket[]> {
    const tournament = await this.getTournament(dto.tournamentId);

    if (
      tournament.status !== TournamentStatus.REGISTRATION_CLOSED &&
      tournament.status !== TournamentStatus.CHECK_IN
    ) {
      throw new BadRequestException('Bracket can only be generated after registration is closed');
    }

    const existingBrackets = await this.bracketRepository.find({
      where: { tournamentId: dto.tournamentId },
    });

    if (existingBrackets.length > 0) {
      throw new BadRequestException(
        'Bracket already exists for this tournament. Delete existing bracket first.',
      );
    }

    const seeds = dto.seeds ?? (await this.getSeededParticipants(dto.tournamentId));

    if (seeds.length < 2) {
      throw new BadRequestException('At least 2 participants are required to generate a bracket');
    }

    const format = dto.format ?? tournament.format;

    switch (format) {
      case TournamentFormat.SINGLE_ELIMINATION:
        return this.generateSingleEliminationBracket(tournament, seeds);
      case TournamentFormat.DOUBLE_ELIMINATION:
        return this.generateDoubleEliminationBracket(
          tournament,
          seeds,
          dto.grandFinalsReset ?? tournament.grandFinalsReset,
        );
      case TournamentFormat.SWISS:
        return this.generateSwissBracket(
          tournament,
          seeds,
          dto.swissRounds ?? tournament.swissRounds,
        );
      case TournamentFormat.ROUND_ROBIN:
        return this.generateRoundRobinBracket(tournament, seeds);
      default:
        throw new BadRequestException(`Unsupported tournament format: ${format}`);
    }
  }

  async generateSingleEliminationBracket(
    tournament: Tournament,
    seeds: SeedEntryDto[],
  ): Promise<TournamentBracket[]> {
    const participantCount = seeds.length;
    const bracketSize = this.getNextPowerOfTwo(participantCount);
    const totalRounds = Math.log2(bracketSize);
    const byeCount = bracketSize - participantCount;

    const bracket = this.bracketRepository.create({
      tournamentId: tournament.id,
      bracketType: BracketType.WINNERS,
      format: TournamentFormat.SINGLE_ELIMINATION,
      status: BracketStatus.GENERATED,
      totalRounds,
      currentRound: 1,
      participantCount,
      byeCount,
      seeds,
    });

    const savedBracket = await this.bracketRepository.save(bracket);

    const bracketNodes = this.createSingleEliminationNodes(seeds, bracketSize, totalRounds);

    await this.createMatchesFromNodes(
      tournament.id,
      savedBracket.id,
      bracketNodes,
      MatchType.WINNERS,
    );

    savedBracket.totalMatches = bracketNodes.length;
    savedBracket.visualizationData = this.generateVisualizationData(bracketNodes);
    await this.bracketRepository.save(savedBracket);

    return [savedBracket];
  }

  async generateDoubleEliminationBracket(
    tournament: Tournament,
    seeds: SeedEntryDto[],
    grandFinalsReset: boolean,
  ): Promise<TournamentBracket[]> {
    const participantCount = seeds.length;
    const bracketSize = this.getNextPowerOfTwo(participantCount);
    const winnersRounds = Math.log2(bracketSize);
    const losersRounds = (winnersRounds - 1) * 2;
    const byeCount = bracketSize - participantCount;

    const winnersBracket = this.bracketRepository.create({
      tournamentId: tournament.id,
      bracketType: BracketType.WINNERS,
      format: TournamentFormat.DOUBLE_ELIMINATION,
      status: BracketStatus.GENERATED,
      totalRounds: winnersRounds,
      currentRound: 1,
      participantCount,
      byeCount,
      seeds,
    });

    const losersBracket = this.bracketRepository.create({
      tournamentId: tournament.id,
      bracketType: BracketType.LOSERS,
      format: TournamentFormat.DOUBLE_ELIMINATION,
      status: BracketStatus.PENDING,
      totalRounds: losersRounds,
      currentRound: 0,
      participantCount: 0,
      byeCount: 0,
    });

    const grandFinalsBracket = this.bracketRepository.create({
      tournamentId: tournament.id,
      bracketType: BracketType.GRAND_FINALS,
      format: TournamentFormat.DOUBLE_ELIMINATION,
      status: BracketStatus.PENDING,
      totalRounds: grandFinalsReset ? 2 : 1,
      currentRound: 0,
      participantCount: 2,
      byeCount: 0,
    });

    const savedWinners = await this.bracketRepository.save(winnersBracket);
    const savedLosers = await this.bracketRepository.save(losersBracket);
    const savedGrandFinals = await this.bracketRepository.save(grandFinalsBracket);

    const winnersNodes = this.createSingleEliminationNodes(seeds, bracketSize, winnersRounds);
    const losersNodes = this.createLosersNodes(bracketSize, losersRounds);
    const grandFinalsNodes = this.createGrandFinalsNodes(grandFinalsReset);

    this.linkDoubleEliminationBrackets(winnersNodes, losersNodes, grandFinalsNodes);

    await this.createMatchesFromNodes(
      tournament.id,
      savedWinners.id,
      winnersNodes,
      MatchType.WINNERS,
    );

    await this.createMatchesFromNodes(tournament.id, savedLosers.id, losersNodes, MatchType.LOSERS);

    await this.createMatchesFromNodes(
      tournament.id,
      savedGrandFinals.id,
      grandFinalsNodes,
      MatchType.GRAND_FINALS,
    );

    savedWinners.totalMatches = winnersNodes.length;
    savedWinners.visualizationData = this.generateVisualizationData(winnersNodes);
    await this.bracketRepository.save(savedWinners);

    savedLosers.totalMatches = losersNodes.length;
    savedLosers.visualizationData = this.generateVisualizationData(losersNodes);
    await this.bracketRepository.save(savedLosers);

    savedGrandFinals.totalMatches = grandFinalsNodes.length;
    await this.bracketRepository.save(savedGrandFinals);

    return [savedWinners, savedLosers, savedGrandFinals];
  }

  async generateSwissBracket(
    tournament: Tournament,
    seeds: SeedEntryDto[],
    totalRounds: number,
  ): Promise<TournamentBracket[]> {
    const participantCount = seeds.length;

    const bracket = this.bracketRepository.create({
      tournamentId: tournament.id,
      bracketType: BracketType.SWISS,
      format: TournamentFormat.SWISS,
      status: BracketStatus.GENERATED,
      totalRounds,
      currentRound: 1,
      participantCount,
      byeCount: participantCount % 2,
      seeds,
    });

    const savedBracket = await this.bracketRepository.save(bracket);

    const pairings = this.generateSwissPairings(seeds, [], 1);
    await this.createSwissRoundMatches(tournament.id, savedBracket.id, pairings, 1);

    savedBracket.totalMatches = Math.floor(participantCount / 2) * totalRounds;
    await this.bracketRepository.save(savedBracket);

    return [savedBracket];
  }

  async generateSwissRound(dto: SwissPairingDto): Promise<TournamentMatch[]> {
    const bracket = await this.bracketRepository.findOne({
      where: {
        tournamentId: dto.tournamentId,
        bracketType: BracketType.SWISS,
      },
    });

    if (!bracket) {
      throw new NotFoundException('Swiss bracket not found');
    }

    if (dto.round !== bracket.currentRound + 1) {
      throw new BadRequestException(
        `Cannot generate round ${dto.round}. Current round is ${bracket.currentRound}`,
      );
    }

    const previousMatches = await this.matchRepository.find({
      where: {
        tournamentId: dto.tournamentId,
        bracketId: bracket.id,
        round: { $lt: dto.round } as unknown as number,
      },
    });

    const standings = await this.standingRepository.find({
      where: { tournamentId: dto.tournamentId },
      order: { points: 'DESC', buchholzScore: 'DESC' },
    });

    const seeds: SeedEntryDto[] = standings.map((s, index) => ({
      participantId: s.participantId,
      seed: index + 1,
      name: s.participantName,
    }));

    const pairings = this.generateSwissPairings(seeds, previousMatches, dto.round);
    const matches = await this.createSwissRoundMatches(
      dto.tournamentId,
      bracket.id,
      pairings,
      dto.round,
    );

    bracket.currentRound = dto.round;
    await this.bracketRepository.save(bracket);

    return matches;
  }

  async generateRoundRobinBracket(
    tournament: Tournament,
    seeds: SeedEntryDto[],
  ): Promise<TournamentBracket[]> {
    const participantCount = seeds.length;
    const totalRounds = participantCount % 2 === 0 ? participantCount - 1 : participantCount;
    const matchesPerRound = Math.floor(participantCount / 2);
    const totalMatches = totalRounds * matchesPerRound;

    const bracket = this.bracketRepository.create({
      tournamentId: tournament.id,
      bracketType: BracketType.ROUND_ROBIN,
      format: TournamentFormat.ROUND_ROBIN,
      status: BracketStatus.GENERATED,
      totalRounds,
      currentRound: 1,
      totalMatches,
      participantCount,
      byeCount: participantCount % 2,
      seeds,
    });

    const savedBracket = await this.bracketRepository.save(bracket);

    const schedule = this.generateRoundRobinSchedule(seeds);

    let matchNumber = 1;
    for (let round = 0; round < schedule.length; round++) {
      for (const pairing of schedule[round]) {
        if (pairing.participant2) {
          const match = this.matchRepository.create({
            tournamentId: tournament.id,
            bracketId: savedBracket.id,
            round: round + 1,
            matchNumber: matchNumber++,
            matchType: MatchType.ROUND_ROBIN,
            status: MatchStatus.PENDING,
            participant1Id: pairing.participant1.participantId,
            participant1Name: pairing.participant1.name,
            participant1Seed: pairing.participant1.seed,
            participant2Id: pairing.participant2.participantId,
            participant2Name: pairing.participant2.name,
            participant2Seed: pairing.participant2.seed,
          });

          await this.matchRepository.save(match);
        }
      }
    }

    savedBracket.visualizationData = { schedule };
    await this.bracketRepository.save(savedBracket);

    return [savedBracket];
  }

  async handleByes(bracketId: string): Promise<void> {
    const matches = await this.matchRepository.find({
      where: {
        bracketId,
        status: MatchStatus.PENDING,
      },
    });

    for (const match of matches) {
      if (match.participant1Id && !match.participant2Id) {
        match.status = MatchStatus.COMPLETED;
        match.winnerId = match.participant1Id;
        match.winnerName = match.participant1Name;
        match.participant1Score = 1;
        match.participant2Score = 0;
        match.completedAt = new Date();
        await this.matchRepository.save(match);
        await this.advanceWinner(match);
      } else if (!match.participant1Id && match.participant2Id) {
        match.status = MatchStatus.COMPLETED;
        match.winnerId = match.participant2Id;
        match.winnerName = match.participant2Name;
        match.participant1Score = 0;
        match.participant2Score = 1;
        match.completedAt = new Date();
        await this.matchRepository.save(match);
        await this.advanceWinner(match);
      }
    }
  }

  async reseedBracket(dto: ReseedBracketDto): Promise<TournamentBracket> {
    const bracket = await this.getBracket(dto.bracketId);

    if (bracket.status !== BracketStatus.GENERATED) {
      throw new BadRequestException('Can only reseed a bracket that has not started');
    }

    let newSeeds: SeedEntryDto[];

    if (dto.useCurrentStandings) {
      const standings = await this.standingRepository.find({
        where: { tournamentId: dto.tournamentId },
        order: { points: 'DESC', wins: 'DESC' },
      });

      newSeeds = standings.map((s, index) => ({
        participantId: s.participantId,
        seed: index + 1,
        name: s.participantName,
      }));
    } else if (dto.seeds) {
      newSeeds = dto.seeds;
    } else {
      throw new BadRequestException('Either seeds or useCurrentStandings must be provided');
    }

    await this.matchRepository.delete({ bracketId: bracket.id });

    bracket.seeds = newSeeds;
    bracket.status = BracketStatus.PENDING;

    return this.bracketRepository.save(bracket);
  }

  async disqualifyParticipant(dto: DisqualifyParticipantDto): Promise<void> {
    const standing = await this.standingRepository.findOne({
      where: {
        tournamentId: dto.tournamentId,
        participantId: dto.participantId,
      },
    });

    if (!standing) {
      throw new NotFoundException('Participant not found in tournament');
    }

    standing.isDisqualified = true;
    standing.disqualificationReason = dto.reason;
    standing.isEliminated = true;
    await this.standingRepository.save(standing);

    const pendingMatches = await this.matchRepository.find({
      where: [
        {
          tournamentId: dto.tournamentId,
          participant1Id: dto.participantId,
          status: In([MatchStatus.PENDING, MatchStatus.SCHEDULED, MatchStatus.CHECK_IN]),
        },
        {
          tournamentId: dto.tournamentId,
          participant2Id: dto.participantId,
          status: In([MatchStatus.PENDING, MatchStatus.SCHEDULED, MatchStatus.CHECK_IN]),
        },
      ],
    });

    for (const match of pendingMatches) {
      if (match.participant1Id === dto.participantId && match.participant2Id) {
        match.status = MatchStatus.FORFEIT;
        match.winnerId = match.participant2Id;
        match.winnerName = match.participant2Name;
        match.loserId = dto.participantId;
        match.participant1Score = 0;
        match.participant2Score = 1;
        match.completedAt = new Date();
      } else if (match.participant2Id === dto.participantId && match.participant1Id) {
        match.status = MatchStatus.FORFEIT;
        match.winnerId = match.participant1Id;
        match.winnerName = match.participant1Name;
        match.loserId = dto.participantId;
        match.participant1Score = 1;
        match.participant2Score = 0;
        match.completedAt = new Date();
      }

      await this.matchRepository.save(match);
      await this.advanceWinner(match);
    }
  }

  async handleBracketReset(dto: BracketResetDto): Promise<TournamentMatch> {
    const match = await this.matchRepository.findOne({
      where: { id: dto.matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    if (match.matchType !== MatchType.GRAND_FINALS) {
      throw new BadRequestException('Bracket reset is only applicable to grand finals');
    }

    const resetMatch = this.matchRepository.create({
      tournamentId: dto.tournamentId,
      bracketId: match.bracketId,
      round: match.round + 1,
      matchNumber: match.matchNumber + 1,
      matchType: MatchType.GRAND_FINALS_RESET,
      status: MatchStatus.PENDING,
      participant1Id: match.participant1Id,
      participant1Name: match.participant1Name,
      participant2Id: match.participant2Id,
      participant2Name: match.participant2Name,
    });

    return this.matchRepository.save(resetMatch);
  }

  async getBracketVisualization(bracketId: string): Promise<Record<string, unknown>> {
    const bracket = await this.getBracket(bracketId);

    const matches = await this.matchRepository.find({
      where: { bracketId },
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    return {
      bracket: {
        id: bracket.id,
        type: bracket.bracketType,
        format: bracket.format,
        status: bracket.status,
        totalRounds: bracket.totalRounds,
        currentRound: bracket.currentRound,
      },
      matches: matches.map((m) => ({
        id: m.id,
        round: m.round,
        matchNumber: m.matchNumber,
        status: m.status,
        participant1: {
          id: m.participant1Id,
          name: m.participant1Name,
          seed: m.participant1Seed,
          score: m.participant1Score,
        },
        participant2: {
          id: m.participant2Id,
          name: m.participant2Name,
          seed: m.participant2Seed,
          score: m.participant2Score,
        },
        winner: {
          id: m.winnerId,
          name: m.winnerName,
        },
        nextMatchId: m.nextMatchId,
        loserNextMatchId: m.loserNextMatchId,
      })),
      visualization: bracket.visualizationData,
    };
  }

  async exportBracket(
    tournamentId: string,
    bracketId?: string,
    format: 'json' | 'image' | 'pdf' = 'json',
  ): Promise<Record<string, unknown>> {
    const brackets = bracketId
      ? [await this.getBracket(bracketId)]
      : await this.bracketRepository.find({ where: { tournamentId } });

    const exportData: Record<string, unknown> = {
      tournament: await this.getTournament(tournamentId),
      brackets: [],
      exportedAt: new Date(),
      format,
    };

    for (const bracket of brackets) {
      const visualization = await this.getBracketVisualization(bracket.id);
      (exportData.brackets as Record<string, unknown>[]).push(visualization);
    }

    return exportData;
  }

  async getBracket(id: string): Promise<TournamentBracket> {
    const bracket = await this.bracketRepository.findOne({
      where: { id },
    });

    if (!bracket) {
      throw new NotFoundException(`Bracket with ID ${id} not found`);
    }

    return bracket;
  }

  async getBracketsByTournament(tournamentId: string): Promise<TournamentBracket[]> {
    return this.bracketRepository.find({
      where: { tournamentId },
      order: { bracketType: 'ASC' },
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

  private async getSeededParticipants(tournamentId: string): Promise<SeedEntryDto[]> {
    const registrations = await this.registrationRepository.find({
      where: {
        tournamentId,
        status: In([RegistrationStatus.CONFIRMED, RegistrationStatus.CHECKED_IN]),
      },
      order: { mmr: 'DESC', createdAt: 'ASC' },
    });

    return registrations.map((r, index) => ({
      participantId: r.participantId,
      seed: r.seed ?? index + 1,
      name: r.participantName,
    }));
  }

  private getNextPowerOfTwo(n: number): number {
    let power = 1;
    while (power < n) {
      power *= 2;
    }
    return power;
  }

  private createSingleEliminationNodes(
    seeds: SeedEntryDto[],
    bracketSize: number,
    totalRounds: number,
  ): BracketNode[] {
    const nodes: BracketNode[] = [];
    let matchNumber = 1;

    const seededPositions = this.getSeededPositions(bracketSize);
    const participantPositions = new Map<number, SeedEntryDto>();

    for (let i = 0; i < seeds.length; i++) {
      participantPositions.set(seededPositions[i], seeds[i]);
    }

    const firstRoundMatches = bracketSize / 2;
    for (let i = 0; i < firstRoundMatches; i++) {
      const pos1 = i * 2;
      const pos2 = i * 2 + 1;
      const participant1 = participantPositions.get(pos1);
      const participant2 = participantPositions.get(pos2);

      nodes.push({
        matchNumber: matchNumber++,
        round: 1,
        participant1,
        participant2,
        isBye: !participant1 || !participant2,
      });
    }

    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round);
      for (let i = 0; i < matchesInRound; i++) {
        nodes.push({
          matchNumber: matchNumber++,
          round,
        });
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.round < totalRounds) {
        const nextRoundStartIndex = nodes.findIndex((n) => n.round === node.round + 1);
        const positionInRound = i - nodes.findIndex((n) => n.round === node.round);
        node.nextMatchNumber =
          nodes[nextRoundStartIndex + Math.floor(positionInRound / 2)]?.matchNumber;
      }
    }

    return nodes;
  }

  private createLosersNodes(bracketSize: number, totalRounds: number): BracketNode[] {
    const nodes: BracketNode[] = [];
    let matchNumber = 1000;

    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = Math.max(1, bracketSize / Math.pow(2, Math.ceil(round / 2) + 1));
      for (let i = 0; i < matchesInRound; i++) {
        nodes.push({
          matchNumber: matchNumber++,
          round,
        });
      }
    }

    return nodes;
  }

  private createGrandFinalsNodes(hasReset: boolean): BracketNode[] {
    const nodes: BracketNode[] = [
      {
        matchNumber: 9000,
        round: 1,
      },
    ];

    if (hasReset) {
      nodes.push({
        matchNumber: 9001,
        round: 2,
      });
    }

    return nodes;
  }

  private linkDoubleEliminationBrackets(
    winnersNodes: BracketNode[],
    losersNodes: BracketNode[],
    grandFinalsNodes: BracketNode[],
  ): void {
    const winnersFinal = winnersNodes[winnersNodes.length - 1];
    if (winnersFinal) {
      winnersFinal.nextMatchNumber = grandFinalsNodes[0]?.matchNumber;
    }

    const losersFinal = losersNodes[losersNodes.length - 1];
    if (losersFinal) {
      losersFinal.nextMatchNumber = grandFinalsNodes[0]?.matchNumber;
    }

    for (const node of winnersNodes) {
      if (node.round === 1 && losersNodes.length > 0) {
        node.loserNextMatchNumber = losersNodes[0]?.matchNumber;
      }
    }
  }

  private async createMatchesFromNodes(
    tournamentId: string,
    bracketId: string,
    nodes: BracketNode[],
    matchType: MatchType,
  ): Promise<TournamentMatch[]> {
    const matches: TournamentMatch[] = [];

    for (const node of nodes) {
      const match = this.matchRepository.create({
        tournamentId,
        bracketId,
        round: node.round,
        matchNumber: node.matchNumber,
        matchType,
        status: node.isBye ? MatchStatus.COMPLETED : MatchStatus.PENDING,
        participant1Id: node.participant1?.participantId,
        participant1Name: node.participant1?.name,
        participant1Seed: node.participant1?.seed,
        participant2Id: node.participant2?.participantId,
        participant2Name: node.participant2?.name,
        participant2Seed: node.participant2?.seed,
      });

      if (node.isBye) {
        if (node.participant1 && !node.participant2) {
          match.winnerId = node.participant1.participantId;
          match.winnerName = node.participant1.name;
          match.participant1Score = 1;
          match.participant2Score = 0;
        } else if (!node.participant1 && node.participant2) {
          match.winnerId = node.participant2.participantId;
          match.winnerName = node.participant2.name;
          match.participant1Score = 0;
          match.participant2Score = 1;
        }
        match.completedAt = new Date();
      }

      matches.push(await this.matchRepository.save(match));
    }

    const matchMap = new Map<number, TournamentMatch>();
    for (const match of matches) {
      matchMap.set(match.matchNumber, match);
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const match = matches[i];

      if (node.nextMatchNumber) {
        const nextMatch = matchMap.get(node.nextMatchNumber);
        if (nextMatch) {
          match.nextMatchId = nextMatch.id;
          await this.matchRepository.save(match);
        }
      }

      if (node.loserNextMatchNumber) {
        const loserNextMatch = matchMap.get(node.loserNextMatchNumber);
        if (loserNextMatch) {
          match.loserNextMatchId = loserNextMatch.id;
          await this.matchRepository.save(match);
        }
      }
    }

    return matches;
  }

  private generateSwissPairings(
    seeds: SeedEntryDto[],
    previousMatches: TournamentMatch[],
    round: number,
  ): SwissPairing[] {
    void round;
    const pairings: SwissPairing[] = [];
    const paired = new Set<string>();

    const previousPairings = new Set<string>();
    for (const match of previousMatches) {
      if (match.participant1Id && match.participant2Id) {
        previousPairings.add(`${match.participant1Id}-${match.participant2Id}`);
        previousPairings.add(`${match.participant2Id}-${match.participant1Id}`);
      }
    }

    const sortedSeeds = [...seeds];

    for (let i = 0; i < sortedSeeds.length; i++) {
      const participant1 = sortedSeeds[i];
      if (paired.has(participant1.participantId)) continue;

      let participant2: SeedEntryDto | null = null;

      for (let j = i + 1; j < sortedSeeds.length; j++) {
        const candidate = sortedSeeds[j];
        if (paired.has(candidate.participantId)) continue;

        const pairingKey = `${participant1.participantId}-${candidate.participantId}`;
        if (!previousPairings.has(pairingKey)) {
          participant2 = candidate;
          break;
        }
      }

      if (!participant2) {
        for (let j = i + 1; j < sortedSeeds.length; j++) {
          const candidate = sortedSeeds[j];
          if (!paired.has(candidate.participantId)) {
            participant2 = candidate;
            break;
          }
        }
      }

      paired.add(participant1.participantId);
      if (participant2) {
        paired.add(participant2.participantId);
      }

      pairings.push({ participant1, participant2 });
    }

    return pairings;
  }

  private async createSwissRoundMatches(
    tournamentId: string,
    bracketId: string,
    pairings: SwissPairing[],
    round: number,
  ): Promise<TournamentMatch[]> {
    const matches: TournamentMatch[] = [];

    for (let i = 0; i < pairings.length; i++) {
      const pairing = pairings[i];

      if (pairing.participant2) {
        const match = this.matchRepository.create({
          tournamentId,
          bracketId,
          round,
          matchNumber: (round - 1) * 100 + i + 1,
          matchType: MatchType.SWISS,
          status: MatchStatus.PENDING,
          participant1Id: pairing.participant1.participantId,
          participant1Name: pairing.participant1.name,
          participant1Seed: pairing.participant1.seed,
          participant2Id: pairing.participant2.participantId,
          participant2Name: pairing.participant2.name,
          participant2Seed: pairing.participant2.seed,
        });

        matches.push(await this.matchRepository.save(match));
      } else {
        const byeMatch = this.matchRepository.create({
          tournamentId,
          bracketId,
          round,
          matchNumber: (round - 1) * 100 + i + 1,
          matchType: MatchType.SWISS,
          status: MatchStatus.COMPLETED,
          participant1Id: pairing.participant1.participantId,
          participant1Name: pairing.participant1.name,
          participant1Seed: pairing.participant1.seed,
          winnerId: pairing.participant1.participantId,
          winnerName: pairing.participant1.name,
          participant1Score: 1,
          participant2Score: 0,
          completedAt: new Date(),
        });

        matches.push(await this.matchRepository.save(byeMatch));
      }
    }

    return matches;
  }

  private generateRoundRobinSchedule(seeds: SeedEntryDto[]): SwissPairing[][] {
    const participants = [...seeds];
    if (participants.length % 2 !== 0) {
      participants.push({ participantId: 'BYE', seed: 0, name: 'BYE' });
    }

    const n = participants.length;
    const rounds: SwissPairing[][] = [];

    for (let round = 0; round < n - 1; round++) {
      const roundPairings: SwissPairing[] = [];

      for (let i = 0; i < n / 2; i++) {
        const home = participants[i];
        const away = participants[n - 1 - i];

        if (home.participantId !== 'BYE' && away.participantId !== 'BYE') {
          roundPairings.push({
            participant1: home,
            participant2: away,
          });
        } else {
          roundPairings.push({
            participant1: home.participantId !== 'BYE' ? home : away,
            participant2: null,
          });
        }
      }

      rounds.push(roundPairings);

      const last = participants.pop()!;
      participants.splice(1, 0, last);
    }

    return rounds;
  }

  private getSeededPositions(bracketSize: number): number[] {
    if (bracketSize === 2) return [0, 1];

    const positions: number[] = [];
    const half = bracketSize / 2;
    const topHalf = this.getSeededPositions(half);
    const bottomHalf = this.getSeededPositions(half);

    for (let i = 0; i < half; i++) {
      positions.push(topHalf[i] * 2);
      positions.push(bottomHalf[i] * 2 + 1);
    }

    return positions;
  }

  private generateVisualizationData(nodes: BracketNode[]): Record<string, unknown> {
    const rounds: Record<number, BracketNode[]> = {};

    for (const node of nodes) {
      if (!rounds[node.round]) {
        rounds[node.round] = [];
      }
      rounds[node.round].push(node);
    }

    return {
      rounds,
      totalNodes: nodes.length,
    };
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
    } else if (!nextMatch.participant2Id) {
      nextMatch.participant2Id = match.winnerId;
      nextMatch.participant2Name = match.winnerName;
    }

    await this.matchRepository.save(nextMatch);
  }
}
