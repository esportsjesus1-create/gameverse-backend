import { regionalRankingService } from '../../src/services/regional.service';
import { Region, RankTier, SortField, SortOrder } from '../../src/types';

describe('RegionalRankingService', () => {
  beforeEach(() => {
    regionalRankingService.clearAllData();
  });

  describe('updateRegionalRank', () => {
    it('should create a new regional rank entry', async () => {
      const entry = await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
      });

      expect(entry.playerId).toBe('player-1');
      expect(entry.region).toBe(Region.NA);
      expect(entry.score).toBe(1000);
      expect(entry.rank).toBeDefined();
    });

    it('should update an existing regional rank entry', async () => {
      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
      });

      const updated = await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 2000,
        mmr: 1800,
      });

      expect(updated.score).toBe(2000);
      expect(updated.mmr).toBe(1800);
    });

    it('should calculate correct ranks within region', async () => {
      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-1',
        playerName: 'Player1',
        score: 500,
      });

      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-2',
        playerName: 'Player2',
        score: 1000,
      });

      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-3',
        playerName: 'Player3',
        score: 750,
      });

      const rank1 = await regionalRankingService.getPlayerRegionalRank(Region.NA, 'player-2');
      const rank2 = await regionalRankingService.getPlayerRegionalRank(Region.NA, 'player-3');
      const rank3 = await regionalRankingService.getPlayerRegionalRank(Region.NA, 'player-1');

      expect(rank1.rank).toBe(1);
      expect(rank2.rank).toBe(2);
      expect(rank3.rank).toBe(3);
    });
  });

  describe('getRegionalLeaderboard', () => {
    it('should return paginated regional leaderboard', async () => {
      for (let i = 0; i < 15; i++) {
        await regionalRankingService.updateRegionalRank(Region.EU, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      const leaderboard = await regionalRankingService.getRegionalLeaderboard(Region.EU, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(leaderboard.data).toHaveLength(10);
      expect(leaderboard.pagination.total).toBe(15);
      expect(leaderboard.pagination.totalPages).toBe(2);
    });

    it('should only return entries from specified region', async () => {
      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'na-player',
        playerName: 'NAPlayer',
        score: 1000,
      });

      await regionalRankingService.updateRegionalRank(Region.EU, {
        playerId: 'eu-player',
        playerName: 'EUPlayer',
        score: 2000,
      });

      const naLeaderboard = await regionalRankingService.getRegionalLeaderboard(Region.NA, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(naLeaderboard.data).toHaveLength(1);
      expect(naLeaderboard.data[0].region).toBe(Region.NA);
    });
  });

  describe('getPlayerRegionalRank', () => {
    it('should return player regional rank', async () => {
      for (let i = 0; i < 10; i++) {
        await regionalRankingService.updateRegionalRank(Region.ASIA, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      const rank = await regionalRankingService.getPlayerRegionalRank(Region.ASIA, 'player-5');
      expect(rank.playerId).toBe('player-5');
      expect(rank.region).toBe(Region.ASIA);
      expect(rank.rank).toBeDefined();
    });

    it('should throw error for non-existent player', async () => {
      await expect(
        regionalRankingService.getPlayerRegionalRank(Region.NA, 'non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getRegionalStatistics', () => {
    it('should return regional statistics', async () => {
      for (let i = 0; i < 10; i++) {
        await regionalRankingService.updateRegionalRank(Region.KR, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: (i + 1) * 100,
        });
      }

      const stats = await regionalRankingService.getRegionalStatistics(Region.KR);
      expect(stats.region).toBe(Region.KR);
      expect(stats.totalPlayers).toBe(10);
      expect(stats.averageScore).toBe(550);
      expect(stats.highestScore).toBe(1000);
      expect(stats.lowestScore).toBe(100);
    });

    it('should return empty statistics for region with no players', async () => {
      const stats = await regionalRankingService.getRegionalStatistics(Region.OCE);
      expect(stats.totalPlayers).toBe(0);
    });
  });

  describe('getAllRegionalStatistics', () => {
    it('should return statistics for all regions', async () => {
      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'na-player',
        playerName: 'NAPlayer',
        score: 1000,
      });

      await regionalRankingService.updateRegionalRank(Region.EU, {
        playerId: 'eu-player',
        playerName: 'EUPlayer',
        score: 2000,
      });

      const allStats = await regionalRankingService.getAllRegionalStatistics();
      expect(allStats).toBeDefined();
      expect(allStats[Region.NA]).toBeDefined();
      expect(allStats[Region.EU]).toBeDefined();
      expect(allStats[Region.NA].totalPlayers).toBe(1);
      expect(allStats[Region.EU].totalPlayers).toBe(1);
    });
  });

  describe('getCrossRegionComparison', () => {
    it('should compare player rank across regions', async () => {
      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
      });

      for (let i = 0; i < 5; i++) {
        await regionalRankingService.updateRegionalRank(Region.EU, {
          playerId: `eu-player-${i}`,
          playerName: `EUPlayer${i}`,
          score: 500 + i * 200,
        });
      }

      const comparison = await regionalRankingService.getCrossRegionComparison('player-1');
      expect(comparison.playerId).toBe('player-1');
      expect(comparison.homeRegion).toBe(Region.NA);
      expect(comparison.comparisons).toBeDefined();
      expect(comparison.comparisons[Region.NA]).toBeDefined();
    });

    it('should throw error for non-existent player', async () => {
      await expect(
        regionalRankingService.getCrossRegionComparison('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getRegionalTopPerformers', () => {
    it('should return top performers from each region', async () => {
      await regionalRankingService.updateRegionalRank(Region.NA, {
        playerId: 'na-top',
        playerName: 'NATop',
        score: 5000,
      });

      await regionalRankingService.updateRegionalRank(Region.EU, {
        playerId: 'eu-top',
        playerName: 'EUTop',
        score: 6000,
      });

      const topPerformers = await regionalRankingService.getRegionalTopPerformers(1);
      expect(topPerformers[Region.NA]).toBeDefined();
      expect(topPerformers[Region.NA]).toHaveLength(1);
      expect(topPerformers[Region.EU]).toBeDefined();
      expect(topPerformers[Region.EU]).toHaveLength(1);
    });
  });

  describe('getRegionalLeaderboardByTier', () => {
    it('should filter regional leaderboard by tier', async () => {
      await regionalRankingService.updateRegionalRank(Region.JP, {
        playerId: 'gold-player',
        playerName: 'GoldPlayer',
        score: 1000,
        tier: RankTier.GOLD,
      });

      await regionalRankingService.updateRegionalRank(Region.JP, {
        playerId: 'diamond-player',
        playerName: 'DiamondPlayer',
        score: 5000,
        tier: RankTier.DIAMOND,
      });

      const goldLeaderboard = await regionalRankingService.getRegionalLeaderboardByTier(
        Region.JP,
        RankTier.GOLD,
        { page: 1, limit: 10 }
      );

      expect(goldLeaderboard.data.every(e => e.tier === RankTier.GOLD)).toBe(true);
    });
  });

  describe('getRegionalTierDistribution', () => {
    it('should return tier distribution for region', async () => {
      await regionalRankingService.updateRegionalRank(Region.SEA, {
        playerId: 'bronze-1',
        playerName: 'Bronze1',
        score: 100,
        tier: RankTier.BRONZE,
      });

      await regionalRankingService.updateRegionalRank(Region.SEA, {
        playerId: 'bronze-2',
        playerName: 'Bronze2',
        score: 150,
        tier: RankTier.BRONZE,
      });

      await regionalRankingService.updateRegionalRank(Region.SEA, {
        playerId: 'gold-1',
        playerName: 'Gold1',
        score: 1000,
        tier: RankTier.GOLD,
      });

      const distribution = await regionalRankingService.getRegionalTierDistribution(Region.SEA);
      expect(distribution[RankTier.BRONZE]).toBe(2);
      expect(distribution[RankTier.GOLD]).toBe(1);
    });
  });

  describe('searchPlayersInRegion', () => {
    it('should search players by name within region', async () => {
      await regionalRankingService.updateRegionalRank(Region.CN, {
        playerId: 'john-1',
        playerName: 'JohnDoe',
        score: 1000,
      });

      await regionalRankingService.updateRegionalRank(Region.CN, {
        playerId: 'jane-1',
        playerName: 'JaneSmith',
        score: 2000,
      });

      await regionalRankingService.updateRegionalRank(Region.CN, {
        playerId: 'john-2',
        playerName: 'JohnSmith',
        score: 1500,
      });

      const results = await regionalRankingService.searchPlayersInRegion(Region.CN, 'John');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.playerName.includes('John'))).toBe(true);
    });
  });

  describe('removePlayerFromRegion', () => {
    it('should remove player from region', async () => {
      await regionalRankingService.updateRegionalRank(Region.MENA, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
      });

      await regionalRankingService.removePlayerFromRegion(Region.MENA, 'player-1');

      await expect(
        regionalRankingService.getPlayerRegionalRank(Region.MENA, 'player-1')
      ).rejects.toThrow();
    });
  });
});
