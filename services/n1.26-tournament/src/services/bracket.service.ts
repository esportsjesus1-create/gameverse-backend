import { TournamentFormat, MatchStatus } from '@prisma/client';
import prisma from '../models/prisma';
import { 
  BracketGenerationOptions, 
  GeneratedBracket, 
  BracketMatch 
} from '../types';
import { BadRequestError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

export class BracketService {
  /**
   * Generate bracket for a tournament based on its format
   */
  async generateBracket(
    tournamentId: string,
    options: BracketGenerationOptions = {}
  ): Promise<GeneratedBracket> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        participants: {
          where: { status: { in: ['REGISTERED', 'CHECKED_IN'] } },
          orderBy: { seed: 'asc' },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', tournamentId);
    }

    if (tournament.participants.length < tournament.minParticipants) {
      throw new BadRequestError(
        `Not enough participants. Minimum required: ${tournament.minParticipants}, current: ${tournament.participants.length}`
      );
    }

    // Clear existing brackets and matches
    await prisma.$transaction([
      prisma.match.deleteMany({ where: { tournamentId } }),
      prisma.bracket.deleteMany({ where: { tournamentId } }),
    ]);

    let generatedBracket: GeneratedBracket;

    switch (tournament.format) {
      case TournamentFormat.SINGLE_ELIMINATION:
        generatedBracket = this.generateSingleEliminationBracket(
          tournament.participants.map(p => p.id),
          options.shuffleSeeds
        );
        break;
      case TournamentFormat.DOUBLE_ELIMINATION:
        generatedBracket = this.generateDoubleEliminationBracket(
          tournament.participants.map(p => p.id),
          options.shuffleSeeds
        );
        break;
      case TournamentFormat.ROUND_ROBIN:
        generatedBracket = this.generateRoundRobinBracket(
          tournament.participants.map(p => p.id)
        );
        break;
      default:
        throw new BadRequestError(`Unsupported tournament format: ${tournament.format}`);
    }

    // Create bracket record
    const bracket = await prisma.bracket.create({
      data: {
        tournamentId,
        name: `${tournament.format} Bracket`,
        type: 'WINNERS',
        round: 1,
        position: 1,
      },
    });

    // Create matches with scheduling
    const matchDuration = options.matchDurationMinutes || 30;
    const breakDuration = options.breakBetweenMatchesMinutes || 10;
    let currentTime = options.schedulingStartTime || new Date();

    const matchesData = generatedBracket.matches.map((match, index) => {
      const scheduledAt = new Date(currentTime);
      if (match.round === 1) {
        currentTime = new Date(currentTime.getTime() + (matchDuration + breakDuration) * 60000);
      }

      return {
        tournamentId,
        bracketId: bracket.id,
        round: match.round,
        position: match.position,
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        status: match.isBye ? MatchStatus.BYE : MatchStatus.PENDING,
        scheduledAt: match.round === 1 ? scheduledAt : null,
      };
    });

    // Create matches
    await prisma.match.createMany({
      data: matchesData,
    });

    // Update match references for bracket progression
    const createdMatches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });

    // Set up next match references
    for (const bracketMatch of generatedBracket.matches) {
      if (bracketMatch.nextMatchPosition !== null) {
        const currentMatch = createdMatches.find(
          m => m.round === bracketMatch.round && m.position === bracketMatch.position
        );
        const nextMatch = createdMatches.find(
          m => m.round === bracketMatch.round + 1 && m.position === bracketMatch.nextMatchPosition
        );

        if (currentMatch && nextMatch) {
          await prisma.match.update({
            where: { id: currentMatch.id },
            data: {
              nextMatchId: nextMatch.id,
              nextMatchSlot: bracketMatch.nextMatchSlot,
            },
          });
        }
      }
    }

    // Process byes - advance players automatically
    await this.processByes(tournamentId);

    logger.info(`Generated ${tournament.format} bracket for tournament ${tournamentId}`);

    return generatedBracket;
  }

  /**
   * Generate single elimination bracket
   */
  generateSingleEliminationBracket(
    participantIds: string[],
    shuffle = false
  ): GeneratedBracket {
    const participants = shuffle 
      ? this.shuffleArray([...participantIds]) 
      : [...participantIds];

    const participantCount = participants.length;
    const totalRounds = Math.ceil(Math.log2(participantCount));
    const bracketSize = Math.pow(2, totalRounds);
    const byeCount = bracketSize - participantCount;

    // Seed participants with byes distributed evenly
    const seededParticipants = this.seedParticipantsWithByes(participants, bracketSize);
    
    const matches: BracketMatch[] = [];
    let matchPosition = 0;

    // Generate first round matches
    for (let i = 0; i < bracketSize / 2; i++) {
      const player1Index = i * 2;
      const player2Index = i * 2 + 1;
      const player1Id = seededParticipants[player1Index];
      const player2Id = seededParticipants[player2Index];
      
      const isBye = player1Id === null || player2Id === null;
      
      matches.push({
        round: 1,
        position: matchPosition++,
        player1Id,
        player2Id,
        nextMatchPosition: Math.floor(i / 2),
        nextMatchSlot: i % 2 === 0 ? 1 : 2,
        isBye,
      });
    }

    // Generate subsequent rounds
    let matchesInRound = bracketSize / 4;
    for (let round = 2; round <= totalRounds; round++) {
      for (let i = 0; i < matchesInRound; i++) {
        const isLastRound = round === totalRounds;
        matches.push({
          round,
          position: i,
          player1Id: null,
          player2Id: null,
          nextMatchPosition: isLastRound ? null : Math.floor(i / 2),
          nextMatchSlot: isLastRound ? null : (i % 2 === 0 ? 1 : 2),
          isBye: false,
        });
      }
      matchesInRound = Math.floor(matchesInRound / 2);
    }

    return { totalRounds, matches };
  }

  /**
   * Generate double elimination bracket
   */
  generateDoubleEliminationBracket(
    participantIds: string[],
    shuffle = false
  ): GeneratedBracket {
    // First generate winners bracket (same as single elimination)
    const winnersBracket = this.generateSingleEliminationBracket(participantIds, shuffle);
    
    const matches: BracketMatch[] = [...winnersBracket.matches];
    const winnersRounds = winnersBracket.totalRounds;
    
    // Generate losers bracket
    // Losers bracket has (winnersRounds - 1) * 2 rounds
    const losersRounds = (winnersRounds - 1) * 2;
    let losersMatchPosition = 0;
    
    // First losers round has half the matches of first winners round
    let matchesInLosersRound = Math.pow(2, winnersRounds - 2);
    
    for (let round = 1; round <= losersRounds; round++) {
      for (let i = 0; i < matchesInLosersRound; i++) {
        const isLastLosersRound = round === losersRounds;
        matches.push({
          round: winnersRounds + round,
          position: losersMatchPosition++,
          player1Id: null,
          player2Id: null,
          nextMatchPosition: isLastLosersRound ? null : Math.floor(i / 2),
          nextMatchSlot: isLastLosersRound ? null : (i % 2 === 0 ? 1 : 2),
          isBye: false,
        });
      }
      
      // Losers bracket alternates between same number of matches and half
      if (round % 2 === 0) {
        matchesInLosersRound = Math.max(1, Math.floor(matchesInLosersRound / 2));
      }
    }

    // Grand finals (winners bracket winner vs losers bracket winner)
    matches.push({
      round: winnersRounds + losersRounds + 1,
      position: 0,
      player1Id: null,
      player2Id: null,
      nextMatchPosition: null,
      nextMatchSlot: null,
      isBye: false,
    });

    return { 
      totalRounds: winnersRounds + losersRounds + 1, 
      matches 
    };
  }

  /**
   * Generate round robin bracket
   */
  generateRoundRobinBracket(participantIds: string[]): GeneratedBracket {
    const participants = [...participantIds];
    const n = participants.length;
    
    // If odd number of participants, add a bye
    if (n % 2 !== 0) {
      participants.push('BYE');
    }
    
    const totalParticipants = participants.length;
    const totalRounds = totalParticipants - 1;
    const matchesPerRound = totalParticipants / 2;
    
    const matches: BracketMatch[] = [];
    let matchPosition = 0;
    
    // Circle method for round robin scheduling
    const fixed = participants[0];
    const rotating = participants.slice(1);
    
    for (let round = 1; round <= totalRounds; round++) {
      const roundParticipants = [fixed, ...rotating];
      
      for (let i = 0; i < matchesPerRound; i++) {
        const player1Index = i;
        const player2Index = totalParticipants - 1 - i;
        const player1Id = roundParticipants[player1Index];
        const player2Id = roundParticipants[player2Index];
        
        // Skip bye matches
        if (player1Id === 'BYE' || player2Id === 'BYE') {
          continue;
        }
        
        matches.push({
          round,
          position: matchPosition++,
          player1Id,
          player2Id,
          nextMatchPosition: null,
          nextMatchSlot: null,
          isBye: false,
        });
      }
      
      // Rotate participants (keep first fixed, rotate rest)
      const last = rotating.pop()!;
      rotating.unshift(last);
    }
    
    return { totalRounds, matches };
  }

  /**
   * Process bye matches - automatically advance players
   */
  async processByes(tournamentId: string): Promise<void> {
    const byeMatches = await prisma.match.findMany({
      where: {
        tournamentId,
        status: MatchStatus.BYE,
      },
    });

    for (const match of byeMatches) {
      const winnerId = match.player1Id || match.player2Id;
      
      if (winnerId && match.nextMatchId) {
        await prisma.match.update({
          where: { id: match.id },
          data: {
            winnerId,
            status: MatchStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        // Advance winner to next match
        const updateData = match.nextMatchSlot === 1 
          ? { player1Id: winnerId }
          : { player2Id: winnerId };

        await prisma.match.update({
          where: { id: match.nextMatchId },
          data: updateData,
        });
      }
    }
  }

  /**
   * Get bracket for a tournament
   */
  async getBracket(tournamentId: string): Promise<{
    bracket: { id: string; name: string; type: string } | null;
    matches: Array<{
      id: string;
      round: number;
      position: number;
      player1: { id: string; name: string } | null;
      player2: { id: string; name: string } | null;
      winner: { id: string; name: string } | null;
      player1Score: number | null;
      player2Score: number | null;
      status: MatchStatus;
      scheduledAt: Date | null;
    }>;
  }> {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundError('Tournament', tournamentId);
    }

    const bracket = await prisma.bracket.findFirst({
      where: { tournamentId },
    });

    const matches = await prisma.match.findMany({
      where: { tournamentId },
      include: {
        player1: { select: { id: true, name: true } },
        player2: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
      },
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });

    return {
      bracket: bracket ? { id: bracket.id, name: bracket.name, type: bracket.type } : null,
      matches: matches.map(m => ({
        id: m.id,
        round: m.round,
        position: m.position,
        player1: m.player1,
        player2: m.player2,
        winner: m.winner,
        player1Score: m.player1Score,
        player2Score: m.player2Score,
        status: m.status,
        scheduledAt: m.scheduledAt,
      })),
    };
  }

  /**
   * Seed participants with byes distributed for fairness
   */
  private seedParticipantsWithByes(
    participants: string[],
    bracketSize: number
  ): (string | null)[] {
    const seeded: (string | null)[] = new Array(bracketSize).fill(null);
    const byeCount = bracketSize - participants.length;
    
    // Place top seeds in positions that give them byes
    // Standard seeding: 1 vs 16, 8 vs 9, 4 vs 13, 5 vs 12, etc.
    const seedPositions = this.generateSeedPositions(bracketSize);
    
    for (let i = 0; i < participants.length; i++) {
      seeded[seedPositions[i]] = participants[i];
    }
    
    return seeded;
  }

  /**
   * Generate standard tournament seed positions
   */
  private generateSeedPositions(bracketSize: number): number[] {
    if (bracketSize === 2) return [0, 1];
    
    const positions: number[] = [];
    const halfSize = bracketSize / 2;
    const upperHalf = this.generateSeedPositions(halfSize);
    
    for (let i = 0; i < halfSize; i++) {
      positions.push(upperHalf[i] * 2);
      positions.push(bracketSize - 1 - upperHalf[i] * 2);
    }
    
    return positions;
  }

  /**
   * Shuffle array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

export const bracketService = new BracketService();
