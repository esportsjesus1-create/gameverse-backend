import { RankedTier, TierDivision, LeaderboardEntry, TierLeaderboard } from '../../src/types';

describe('Leaderboard', () => {
  describe('tier leaderboard structure', () => {
    it('should have correct TierLeaderboard structure', () => {
      const tierLeaderboard: TierLeaderboard = {
        tier: RankedTier.GOLD,
        entries: [],
        total: 0,
      };

      expect(tierLeaderboard.tier).toBe(RankedTier.GOLD);
      expect(tierLeaderboard.entries).toEqual([]);
      expect(tierLeaderboard.total).toBe(0);
    });

    it('should have correct LeaderboardEntry structure', () => {
      const entry: LeaderboardEntry = {
        rank: 1,
        playerId: 'player-123',
        playerName: 'TestPlayer',
        tier: RankedTier.DIAMOND,
        division: TierDivision.I,
        leaguePoints: 75,
        mmr: 2500,
        wins: 100,
        losses: 50,
        winRate: 67,
      };

      expect(entry.rank).toBe(1);
      expect(entry.playerId).toBe('player-123');
      expect(entry.tier).toBe(RankedTier.DIAMOND);
      expect(entry.division).toBe(TierDivision.I);
      expect(entry.winRate).toBe(67);
    });
  });

  describe('leaderboard sorting', () => {
    it('should sort by MMR descending', () => {
      const players = [
        { playerId: 'p1', mmr: 1500, wins: 10 },
        { playerId: 'p2', mmr: 2000, wins: 20 },
        { playerId: 'p3', mmr: 1800, wins: 15 },
      ];

      const sorted = [...players].sort((a, b) => b.mmr - a.mmr);

      expect(sorted[0].playerId).toBe('p2');
      expect(sorted[1].playerId).toBe('p3');
      expect(sorted[2].playerId).toBe('p1');
    });

    it('should sort by wins as secondary criteria', () => {
      const players = [
        { playerId: 'p1', mmr: 2000, wins: 10 },
        { playerId: 'p2', mmr: 2000, wins: 20 },
        { playerId: 'p3', mmr: 2000, wins: 15 },
      ];

      const sorted = [...players].sort((a, b) => {
        if (b.mmr !== a.mmr) return b.mmr - a.mmr;
        return b.wins - a.wins;
      });

      expect(sorted[0].playerId).toBe('p2');
      expect(sorted[1].playerId).toBe('p3');
      expect(sorted[2].playerId).toBe('p1');
    });
  });

  describe('pagination', () => {
    it('should calculate correct skip value', () => {
      const page = 3;
      const limit = 50;
      const skip = (page - 1) * limit;
      expect(skip).toBe(100);
    });

    it('should calculate correct skip for first page', () => {
      const page = 1;
      const limit = 50;
      const skip = (page - 1) * limit;
      expect(skip).toBe(0);
    });

    it('should limit results correctly', () => {
      const players = Array.from({ length: 100 }, (_, i) => ({
        playerId: `player-${i}`,
        mmr: 2000 - i,
      }));

      const page = 1;
      const limit = 10;
      const skip = (page - 1) * limit;
      const paginated = players.slice(skip, skip + limit);

      expect(paginated).toHaveLength(10);
      expect(paginated[0].playerId).toBe('player-0');
      expect(paginated[9].playerId).toBe('player-9');
    });

    it('should handle second page correctly', () => {
      const players = Array.from({ length: 100 }, (_, i) => ({
        playerId: `player-${i}`,
        mmr: 2000 - i,
      }));

      const page = 2;
      const limit = 10;
      const skip = (page - 1) * limit;
      const paginated = players.slice(skip, skip + limit);

      expect(paginated).toHaveLength(10);
      expect(paginated[0].playerId).toBe('player-10');
      expect(paginated[9].playerId).toBe('player-19');
    });
  });

  describe('win rate calculation', () => {
    it('should calculate win rate correctly', () => {
      const wins = 75;
      const losses = 25;
      const winRate = wins + losses > 0
        ? Math.round((wins / (wins + losses)) * 100)
        : 0;
      expect(winRate).toBe(75);
    });

    it('should handle zero games', () => {
      const wins = 0;
      const losses = 0;
      const winRate = wins + losses > 0
        ? Math.round((wins / (wins + losses)) * 100)
        : 0;
      expect(winRate).toBe(0);
    });

    it('should round win rate correctly', () => {
      const wins = 33;
      const losses = 67;
      const winRate = wins + losses > 0
        ? Math.round((wins / (wins + losses)) * 100)
        : 0;
      expect(winRate).toBe(33);
    });
  });

  describe('tier filtering', () => {
    const tierOrder = [
      RankedTier.BRONZE,
      RankedTier.SILVER,
      RankedTier.GOLD,
      RankedTier.PLATINUM,
      RankedTier.DIAMOND,
      RankedTier.MASTER,
      RankedTier.GRANDMASTER,
      RankedTier.CHALLENGER,
    ];

    it('should filter players by tier', () => {
      const players = [
        { playerId: 'p1', tier: RankedTier.GOLD, mmr: 1500 },
        { playerId: 'p2', tier: RankedTier.GOLD, mmr: 1600 },
        { playerId: 'p3', tier: RankedTier.PLATINUM, mmr: 1800 },
        { playerId: 'p4', tier: RankedTier.GOLD, mmr: 1550 },
      ];

      const targetTier = RankedTier.GOLD;
      const filtered = players.filter(p => p.tier === targetTier);

      expect(filtered).toHaveLength(3);
      expect(filtered.every(p => p.tier === RankedTier.GOLD)).toBe(true);
    });

    it('should return empty array for tier with no players', () => {
      const players = [
        { playerId: 'p1', tier: RankedTier.GOLD, mmr: 1500 },
        { playerId: 'p2', tier: RankedTier.PLATINUM, mmr: 1800 },
      ];

      const targetTier = RankedTier.CHALLENGER;
      const filtered = players.filter(p => p.tier === targetTier);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('top players by tier', () => {
    it('should get top N players from each tier', () => {
      const players = [
        { playerId: 'g1', tier: RankedTier.GOLD, mmr: 1500 },
        { playerId: 'g2', tier: RankedTier.GOLD, mmr: 1600 },
        { playerId: 'g3', tier: RankedTier.GOLD, mmr: 1550 },
        { playerId: 'p1', tier: RankedTier.PLATINUM, mmr: 1800 },
        { playerId: 'p2', tier: RankedTier.PLATINUM, mmr: 1900 },
      ];

      const topN = 2;
      const tiers = [RankedTier.GOLD, RankedTier.PLATINUM];
      const result: Record<RankedTier, typeof players> = {} as Record<RankedTier, typeof players>;

      for (const tier of tiers) {
        const tierPlayers = players
          .filter(p => p.tier === tier)
          .sort((a, b) => b.mmr - a.mmr)
          .slice(0, topN);
        result[tier] = tierPlayers;
      }

      expect(result[RankedTier.GOLD]).toHaveLength(2);
      expect(result[RankedTier.GOLD][0].playerId).toBe('g2');
      expect(result[RankedTier.GOLD][1].playerId).toBe('g3');
      expect(result[RankedTier.PLATINUM]).toHaveLength(2);
      expect(result[RankedTier.PLATINUM][0].playerId).toBe('p2');
    });
  });

  describe('rank assignment', () => {
    it('should assign correct ranks with pagination offset', () => {
      const players = [
        { playerId: 'p1', mmr: 2000 },
        { playerId: 'p2', mmr: 1900 },
        { playerId: 'p3', mmr: 1800 },
      ];

      const skip = 10;
      const entries = players.map((player, index) => ({
        rank: skip + index + 1,
        playerId: player.playerId,
        mmr: player.mmr,
      }));

      expect(entries[0].rank).toBe(11);
      expect(entries[1].rank).toBe(12);
      expect(entries[2].rank).toBe(13);
    });

    it('should assign correct ranks for first page', () => {
      const players = [
        { playerId: 'p1', mmr: 2000 },
        { playerId: 'p2', mmr: 1900 },
        { playerId: 'p3', mmr: 1800 },
      ];

      const skip = 0;
      const entries = players.map((player, index) => ({
        rank: skip + index + 1,
        playerId: player.playerId,
        mmr: player.mmr,
      }));

      expect(entries[0].rank).toBe(1);
      expect(entries[1].rank).toBe(2);
      expect(entries[2].rank).toBe(3);
    });
  });
});
