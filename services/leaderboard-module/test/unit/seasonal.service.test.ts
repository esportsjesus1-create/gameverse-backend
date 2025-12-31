import { seasonalRankingService } from '../../src/services/seasonal.service';
import { RankTier, TierDivision, Region, GameMode } from '../../src/types';

describe('SeasonalRankingService', () => {
  beforeEach(() => {
    seasonalRankingService.clearAllData();
  });

  describe('getActiveSeason', () => {
    it('should return the active season', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      expect(season).toBeDefined();
      expect(season.isActive).toBe(true);
      expect(season.name).toBeDefined();
      expect(season.startDate).toBeDefined();
      expect(season.endDate).toBeDefined();
    });
  });

  describe('getSeasonById', () => {
    it('should return a season by ID', async () => {
      const activeSeason = await seasonalRankingService.getActiveSeason();
      const season = await seasonalRankingService.getSeasonById(activeSeason.id);
      expect(season).toEqual(activeSeason);
    });

    it('should throw error for non-existent season', async () => {
      await expect(
        seasonalRankingService.getSeasonById('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('updateSeasonalRank', () => {
    it('should create a new seasonal rank entry', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      const entry = await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
        wins: 10,
        losses: 5,
        gamesPlayed: 15,
      });

      expect(entry.playerId).toBe('player-1');
      expect(entry.score).toBe(1000);
      expect(entry.mmr).toBe(1500);
      expect(entry.tier).toBeDefined();
      expect(entry.division).toBeDefined();
    });

    it('should update an existing seasonal rank entry', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
      });

      const updated = await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 2000,
        mmr: 1800,
      });

      expect(updated.score).toBe(2000);
      expect(updated.mmr).toBe(1800);
    });

    it('should calculate tier based on MMR', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      const bronzeEntry = await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'bronze-player',
        playerName: 'BronzePlayer',
        score: 100,
        mmr: 800,
      });
      expect(bronzeEntry.tier).toBe(RankTier.BRONZE);

      const diamondEntry = await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'diamond-player',
        playerName: 'DiamondPlayer',
        score: 5000,
        mmr: 2200,
      });
      expect(diamondEntry.tier).toBe(RankTier.DIAMOND);
    });
  });

  describe('getSeasonalLeaderboard', () => {
    it('should return paginated seasonal leaderboard', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      for (let i = 0; i < 15; i++) {
        await seasonalRankingService.updateSeasonalRank(season.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
          mmr: 1000 + i * 50,
        });
      }

      const leaderboard = await seasonalRankingService.getSeasonalLeaderboard(season.id, {
        page: 1,
        limit: 10,
      });

      expect(leaderboard.data).toHaveLength(10);
      expect(leaderboard.pagination.total).toBe(15);
      expect(leaderboard.pagination.totalPages).toBe(2);
    });

    it('should filter by tier', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'gold-player',
        playerName: 'GoldPlayer',
        score: 1000,
        mmr: 1500,
      });

      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'diamond-player',
        playerName: 'DiamondPlayer',
        score: 5000,
        mmr: 2200,
      });

      const goldLeaderboard = await seasonalRankingService.getSeasonalLeaderboard(season.id, {
        page: 1,
        limit: 10,
        tier: RankTier.GOLD,
      });

      expect(goldLeaderboard.data.every(e => e.tier === RankTier.GOLD)).toBe(true);
    });
  });

  describe('getPlayerSeasonalRank', () => {
    it('should return player seasonal rank', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      for (let i = 0; i < 10; i++) {
        await seasonalRankingService.updateSeasonalRank(season.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
          mmr: 1000 + i * 50,
        });
      }

      const rank = await seasonalRankingService.getPlayerSeasonalRank(season.id, 'player-5');
      expect(rank.playerId).toBe('player-5');
      expect(rank.rank).toBeDefined();
      expect(rank.tier).toBeDefined();
    });

    it('should throw error for non-existent player', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await expect(
        seasonalRankingService.getPlayerSeasonalRank(season.id, 'non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getPlayerSeasonalData', () => {
    it('should return comprehensive player seasonal data', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
        wins: 20,
        losses: 10,
        gamesPlayed: 30,
      });

      const data = await seasonalRankingService.getPlayerSeasonalData(season.id, 'player-1');
      expect(data.playerId).toBe('player-1');
      expect(data.wins).toBe(20);
      expect(data.losses).toBe(10);
      expect(data.gamesPlayed).toBe(30);
      expect(data.winRate).toBeCloseTo(66.67, 1);
    });
  });

  describe('getSeasonalRewardPreview', () => {
    it('should return reward preview based on tier', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 5000,
        mmr: 2200,
      });

      const preview = await seasonalRankingService.getSeasonalRewardPreview(season.id, 'player-1');
      expect(preview.tier).toBeDefined();
      expect(preview.rewards).toBeDefined();
      expect(preview.rewards.length).toBeGreaterThan(0);
    });
  });

  describe('getDecayStatus', () => {
    it('should return decay status for player', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 5000,
        mmr: 2200,
      });

      const status = await seasonalRankingService.getDecayStatus(season.id, 'player-1');
      expect(status.playerId).toBe('player-1');
      expect(status.isDecaying).toBeDefined();
      expect(status.daysUntilDecay).toBeDefined();
      expect(status.decayProtected).toBeDefined();
    });
  });

  describe('getSeasonalTierDistribution', () => {
    it('should return tier distribution', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'bronze-1',
        playerName: 'Bronze1',
        score: 100,
        mmr: 800,
      });

      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'bronze-2',
        playerName: 'Bronze2',
        score: 150,
        mmr: 850,
      });

      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'gold-1',
        playerName: 'Gold1',
        score: 1000,
        mmr: 1500,
      });

      const distribution = await seasonalRankingService.getSeasonalTierDistribution(season.id);
      expect(distribution).toBeDefined();
      expect(distribution[RankTier.BRONZE]).toBe(2);
      expect(distribution[RankTier.GOLD]).toBe(1);
    });
  });

  describe('getPlacementStatus', () => {
    it('should return placement status for new player', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 0,
        mmr: 1000,
        gamesPlayed: 3,
        placementGamesPlayed: 3,
        placementGamesRequired: 10,
      });

      const status = await seasonalRankingService.getPlacementStatus(season.id, 'player-1');
      expect(status.playerId).toBe('player-1');
      expect(status.placementGamesPlayed).toBe(3);
      expect(status.placementGamesRequired).toBe(10);
      expect(status.isPlacementComplete).toBe(false);
    });

    it('should show completed placement', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
        gamesPlayed: 15,
        placementGamesPlayed: 10,
        placementGamesRequired: 10,
      });

      const status = await seasonalRankingService.getPlacementStatus(season.id, 'player-1');
      expect(status.isPlacementComplete).toBe(true);
    });
  });

  describe('getSeasonalLeaderboardByTier', () => {
    it('should return leaderboard filtered by tier', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      for (let i = 0; i < 5; i++) {
        await seasonalRankingService.updateSeasonalRank(season.id, {
          playerId: `gold-${i}`,
          playerName: `Gold${i}`,
          score: 1000 + i * 100,
          mmr: 1500 + i * 20,
        });
      }

      for (let i = 0; i < 3; i++) {
        await seasonalRankingService.updateSeasonalRank(season.id, {
          playerId: `diamond-${i}`,
          playerName: `Diamond${i}`,
          score: 5000 + i * 100,
          mmr: 2200 + i * 20,
        });
      }

      const goldLeaderboard = await seasonalRankingService.getSeasonalLeaderboardByTier(
        season.id,
        RankTier.GOLD,
        { page: 1, limit: 10 }
      );

      expect(goldLeaderboard.data.every(e => e.tier === RankTier.GOLD)).toBe(true);
    });
  });

  describe('getPlayerSeasonalProgression', () => {
    it('should return player progression history', async () => {
      const season = await seasonalRankingService.getActiveSeason();
      
      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1000,
        mmr: 1500,
      });

      await seasonalRankingService.updateSeasonalRank(season.id, {
        playerId: 'player-1',
        playerName: 'TestPlayer',
        score: 1500,
        mmr: 1700,
      });

      const progression = await seasonalRankingService.getPlayerSeasonalProgression(season.id, 'player-1');
      expect(progression.playerId).toBe('player-1');
      expect(progression.history).toBeDefined();
      expect(progression.history.length).toBeGreaterThan(0);
    });
  });
});
