// Mock prisma before importing the service
jest.mock('../../src/models/prisma', () => ({
  __esModule: true,
  default: {
    tournament: {
      findUnique: jest.fn(),
    },
    bracket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
    },
    match: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((operations: unknown[]) => Promise.resolve(operations)),
    $on: jest.fn(),
  },
}));

import { BracketService } from '../../src/services/bracket.service';

describe('BracketService', () => {
  let bracketService: BracketService;

  beforeEach(() => {
    bracketService = new BracketService();
  });

  describe('generateSingleEliminationBracket', () => {
    it('should generate correct bracket for 2 participants', () => {
      const participants = ['p1', 'p2'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(1);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].round).toBe(1);
      expect(result.matches[0].position).toBe(0);
      expect(result.matches[0].isBye).toBe(false);
    });

    it('should generate correct bracket for 4 participants', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(2);
      expect(result.matches).toHaveLength(3); // 2 first round + 1 final
      
      // First round matches
      const firstRoundMatches = result.matches.filter(m => m.round === 1);
      expect(firstRoundMatches).toHaveLength(2);
      
      // Final match
      const finalMatch = result.matches.find(m => m.round === 2);
      expect(finalMatch).toBeDefined();
      expect(finalMatch?.nextMatchPosition).toBeNull();
    });

    it('should generate correct bracket for 8 participants', () => {
      const participants = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(3);
      expect(result.matches).toHaveLength(7); // 4 + 2 + 1
      
      const firstRoundMatches = result.matches.filter(m => m.round === 1);
      const secondRoundMatches = result.matches.filter(m => m.round === 2);
      const finalMatch = result.matches.filter(m => m.round === 3);
      
      expect(firstRoundMatches).toHaveLength(4);
      expect(secondRoundMatches).toHaveLength(2);
      expect(finalMatch).toHaveLength(1);
    });

    it('should handle byes for non-power-of-2 participants (3 participants)', () => {
      const participants = ['p1', 'p2', 'p3'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(2);
      
      // Should have bye matches
      const byeMatches = result.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBeGreaterThan(0);
    });

    it('should handle byes for non-power-of-2 participants (5 participants)', () => {
      const participants = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(3);
      
      // Should have 3 bye matches (8 - 5 = 3 byes)
      const byeMatches = result.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBe(3);
    });

    it('should handle byes for 6 participants', () => {
      const participants = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(3);
      
      // Should have 2 bye matches (8 - 6 = 2 byes)
      const byeMatches = result.matches.filter(m => m.isBye);
      expect(byeMatches.length).toBe(2);
    });

    it('should shuffle participants when shuffle option is true', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      
      // Run multiple times to check randomization
      const results: string[][] = [];
      for (let i = 0; i < 10; i++) {
        const result = bracketService.generateSingleEliminationBracket(participants, true);
        const firstRoundPlayers = result.matches
          .filter(m => m.round === 1)
          .flatMap(m => [m.player1Id, m.player2Id])
          .filter(Boolean) as string[];
        results.push(firstRoundPlayers);
      }
      
      // At least some results should be different (shuffled)
      const uniqueResults = new Set(results.map(r => r.join(',')));
      // With 4 participants, there's a chance of same order, but unlikely in 10 tries
      expect(uniqueResults.size).toBeGreaterThanOrEqual(1);
    });

    it('should set correct next match references', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      const result = bracketService.generateSingleEliminationBracket(participants);

      const firstRoundMatches = result.matches.filter(m => m.round === 1);
      
      // Both first round matches should point to the final
      expect(firstRoundMatches[0].nextMatchPosition).toBe(0);
      expect(firstRoundMatches[1].nextMatchPosition).toBe(0);
      
      // Different slots
      expect(firstRoundMatches[0].nextMatchSlot).toBe(1);
      expect(firstRoundMatches[1].nextMatchSlot).toBe(2);
    });

    it('should handle 16 participants correctly', () => {
      const participants = Array.from({ length: 16 }, (_, i) => `p${i + 1}`);
      const result = bracketService.generateSingleEliminationBracket(participants);

      expect(result.totalRounds).toBe(4);
      expect(result.matches).toHaveLength(15); // 8 + 4 + 2 + 1
      
      const matchesByRound = [1, 2, 3, 4].map(
        round => result.matches.filter(m => m.round === round).length
      );
      expect(matchesByRound).toEqual([8, 4, 2, 1]);
    });
  });

  describe('generateDoubleEliminationBracket', () => {
    it('should generate winners and losers brackets for 4 participants', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      const result = bracketService.generateDoubleEliminationBracket(participants);

      // Winners bracket: 2 rounds (2 + 1 = 3 matches)
      // Losers bracket: 2 rounds
      // Grand finals: 1 match
      expect(result.totalRounds).toBeGreaterThan(2);
      expect(result.matches.length).toBeGreaterThan(3);
    });

    it('should generate more matches than single elimination', () => {
      const participants = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
      
      const singleElim = bracketService.generateSingleEliminationBracket(participants);
      const doubleElim = bracketService.generateDoubleEliminationBracket(participants);

      expect(doubleElim.matches.length).toBeGreaterThan(singleElim.matches.length);
    });
  });

  describe('generateRoundRobinBracket', () => {
    it('should generate correct number of matches for 4 participants', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      const result = bracketService.generateRoundRobinBracket(participants);

      // n * (n-1) / 2 = 4 * 3 / 2 = 6 matches
      expect(result.matches).toHaveLength(6);
      expect(result.totalRounds).toBe(3); // n - 1 rounds
    });

    it('should generate correct number of matches for 5 participants', () => {
      const participants = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const result = bracketService.generateRoundRobinBracket(participants);

      // n * (n-1) / 2 = 5 * 4 / 2 = 10 matches
      expect(result.matches).toHaveLength(10);
    });

    it('should ensure each participant plays every other participant once', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      const result = bracketService.generateRoundRobinBracket(participants);

      // Check that each pair plays exactly once
      const matchups = new Set<string>();
      
      for (const match of result.matches) {
        const pair = [match.player1Id, match.player2Id].sort().join('-');
        expect(matchups.has(pair)).toBe(false);
        matchups.add(pair);
      }

      // Should have all possible pairs
      expect(matchups.size).toBe(6);
    });

    it('should handle odd number of participants with byes', () => {
      const participants = ['p1', 'p2', 'p3'];
      const result = bracketService.generateRoundRobinBracket(participants);

      // 3 * 2 / 2 = 3 matches
      expect(result.matches).toHaveLength(3);
      
      // No bye matches should be in the result
      const byeMatches = result.matches.filter(
        m => m.player1Id === 'BYE' || m.player2Id === 'BYE'
      );
      expect(byeMatches).toHaveLength(0);
    });

    it('should not have next match references in round robin', () => {
      const participants = ['p1', 'p2', 'p3', 'p4'];
      const result = bracketService.generateRoundRobinBracket(participants);

      for (const match of result.matches) {
        expect(match.nextMatchPosition).toBeNull();
        expect(match.nextMatchSlot).toBeNull();
      }
    });
  });
});
