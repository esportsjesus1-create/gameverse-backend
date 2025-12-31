import { leaderboardService } from '../../src/services/leaderboard.service';
import { LeaderboardType, RankingPeriod, RankTier, TierDivision, Region, GameMode, SortField, SortOrder } from '../../src/types';

describe('LeaderboardService', () => {
  beforeEach(() => {
    leaderboardService.clearAllData();
  });

  describe('createLeaderboard', () => {
    it('should create a new leaderboard', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test Leaderboard',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      expect(leaderboard.id).toBeDefined();
      expect(leaderboard.name).toBe('Test Leaderboard');
      expect(leaderboard.type).toBe(LeaderboardType.GLOBAL);
      expect(leaderboard.period).toBe(RankingPeriod.ALL_TIME);
      expect(leaderboard.isActive).toBe(true);
      expect(leaderboard.totalEntries).toBe(0);
    });

    it('should create a leaderboard with all options', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Full Options Leaderboard',
        type: LeaderboardType.SEASONAL,
        period: RankingPeriod.SEASONAL,
        gameId: '123e4567-e89b-12d3-a456-426614174000',
        seasonId: '123e4567-e89b-12d3-a456-426614174001',
        region: Region.NA,
        gameMode: GameMode.RANKED,
        maxEntries: 1000,
        isPublic: true,
        metadata: { custom: 'data' },
      });

      expect(leaderboard.gameId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(leaderboard.seasonId).toBe('123e4567-e89b-12d3-a456-426614174001');
      expect(leaderboard.region).toBe(Region.NA);
      expect(leaderboard.gameMode).toBe(GameMode.RANKED);
      expect(leaderboard.maxEntries).toBe(1000);
      expect(leaderboard.isPublic).toBe(true);
      expect(leaderboard.metadata).toEqual({ custom: 'data' });
    });
  });

  describe('getLeaderboard', () => {
    it('should get an existing leaderboard', async () => {
      const created = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      const retrieved = await leaderboardService.getLeaderboard(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should throw error for non-existent leaderboard', async () => {
      await expect(
        leaderboardService.getLeaderboard('non-existent-id')
      ).rejects.toThrow('not found');
    });
  });

  describe('updateOrCreateEntry', () => {
    it('should create a new entry', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      const entry = await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        playerName: 'TestPlayer',
        score: 1000,
      });

      expect(entry.playerId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(entry.playerName).toBe('TestPlayer');
      expect(entry.score).toBe(1000);
      expect(entry.rank).toBe(1);
    });

    it('should update an existing entry', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        playerName: 'TestPlayer',
        score: 1000,
      });

      const updated = await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        playerName: 'TestPlayer',
        score: 2000,
      });

      expect(updated.score).toBe(2000);
    });

    it('should calculate correct ranks for multiple entries', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-1',
        playerName: 'Player1',
        score: 500,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-2',
        playerName: 'Player2',
        score: 1000,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-3',
        playerName: 'Player3',
        score: 750,
      });

      const entries = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(entries.data[0].playerId).toBe('player-2');
      expect(entries.data[0].rank).toBe(1);
      expect(entries.data[1].playerId).toBe('player-3');
      expect(entries.data[1].rank).toBe(2);
      expect(entries.data[2].playerId).toBe('player-1');
      expect(entries.data[2].rank).toBe(3);
    });

    it('should assign tier based on score', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      const entry = await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-1',
        playerName: 'Player1',
        score: 5000,
        mmr: 2500,
      });

      expect(entry.tier).toBeDefined();
      expect(entry.division).toBeDefined();
    });
  });

  describe('getLeaderboardEntries', () => {
    it('should return paginated entries', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 15; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      const page1 = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(page1.data).toHaveLength(10);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(10);
      expect(page1.pagination.total).toBe(15);
      expect(page1.pagination.totalPages).toBe(2);
      expect(page1.pagination.hasNext).toBe(true);
      expect(page1.pagination.hasPrev).toBe(false);

      const page2 = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 2,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(page2.data).toHaveLength(5);
      expect(page2.pagination.hasNext).toBe(false);
      expect(page2.pagination.hasPrev).toBe(true);
    });

    it('should sort entries by different fields', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-1',
        playerName: 'Player1',
        score: 1000,
        wins: 50,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-2',
        playerName: 'Player2',
        score: 500,
        wins: 100,
      });

      const byScore = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(byScore.data[0].playerId).toBe('player-1');

      const byWins = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.WINS,
        sortOrder: SortOrder.DESC,
      });

      expect(byWins.data[0].playerId).toBe('player-2');
    });

    it('should filter by score range', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 10; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      const filtered = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
        minScore: 300,
        maxScore: 700,
      });

      expect(filtered.data.every(e => e.score >= 300 && e.score <= 700)).toBe(true);
    });
  });

  describe('getTop100', () => {
    it('should return top 100 entries', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 150; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 10,
        });
      }

      const top100 = await leaderboardService.getTop100(leaderboard.id);
      expect(top100).toHaveLength(100);
      expect(top100[0].score).toBe(1490);
      expect(top100[99].score).toBe(500);
    });

    it('should return all entries if less than 100', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 50; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 10,
        });
      }

      const top100 = await leaderboardService.getTop100(leaderboard.id);
      expect(top100).toHaveLength(50);
    });
  });

  describe('getPlayerRank', () => {
    it('should return player rank', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 10; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      const rank = await leaderboardService.getPlayerRank(leaderboard.id, 'player-5');
      expect(rank.rank).toBe(5);
      expect(rank.score).toBe(500);
    });

    it('should throw error for non-existent player', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await expect(
        leaderboardService.getPlayerRank(leaderboard.id, 'non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getPlayerContext', () => {
    it('should return players around the target player', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 20; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      const context = await leaderboardService.getPlayerContext(leaderboard.id, 'player-10', 3);
      expect(context.player.playerId).toBe('player-10');
      expect(context.above.length).toBeLessThanOrEqual(3);
      expect(context.below.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getLeaderboardStatistics', () => {
    it('should return leaderboard statistics', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 10; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: (i + 1) * 100,
        });
      }

      const stats = await leaderboardService.getLeaderboardStatistics(leaderboard.id);
      expect(stats.totalPlayers).toBe(10);
      expect(stats.averageScore).toBe(550);
      expect(stats.highestScore).toBe(1000);
      expect(stats.lowestScore).toBe(100);
      expect(stats.medianScore).toBeDefined();
    });
  });

  describe('removeEntry', () => {
    it('should remove an entry and recalculate ranks', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 5; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      await leaderboardService.removeEntry(leaderboard.id, 'player-2');

      const entries = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(entries.data).toHaveLength(4);
      expect(entries.data.find(e => e.playerId === 'player-2')).toBeUndefined();
    });
  });

  describe('resetLeaderboard', () => {
    it('should reset all entries', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      for (let i = 0; i < 5; i++) {
        await leaderboardService.updateOrCreateEntry(leaderboard.id, {
          playerId: `player-${i}`,
          playerName: `Player${i}`,
          score: i * 100,
        });
      }

      await leaderboardService.resetLeaderboard(leaderboard.id);

      const entries = await leaderboardService.getLeaderboardEntries(leaderboard.id, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(entries.data).toHaveLength(0);
    });
  });

  describe('searchPlayers', () => {
    it('should search players by name', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-1',
        playerName: 'JohnDoe',
        score: 1000,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-2',
        playerName: 'JaneSmith',
        score: 2000,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-3',
        playerName: 'JohnSmith',
        score: 1500,
      });

      const results = await leaderboardService.searchPlayers(leaderboard.id, 'John');
      expect(results).toHaveLength(2);
      expect(results.every(r => r.playerName.includes('John'))).toBe(true);
    });
  });

  describe('getEntriesByTier', () => {
    it('should filter entries by tier', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-1',
        playerName: 'Player1',
        score: 1000,
        tier: RankTier.GOLD,
        division: TierDivision.I,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-2',
        playerName: 'Player2',
        score: 2000,
        tier: RankTier.DIAMOND,
        division: TierDivision.III,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-3',
        playerName: 'Player3',
        score: 1500,
        tier: RankTier.GOLD,
        division: TierDivision.II,
      });

      const goldEntries = await leaderboardService.getEntriesByTier(leaderboard.id, RankTier.GOLD, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(goldEntries.data).toHaveLength(2);
      expect(goldEntries.data.every(e => e.tier === RankTier.GOLD)).toBe(true);
    });
  });

  describe('getEntriesByRegion', () => {
    it('should filter entries by region', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-1',
        playerName: 'Player1',
        score: 1000,
        region: Region.NA,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-2',
        playerName: 'Player2',
        score: 2000,
        region: Region.EU,
      });

      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: 'player-3',
        playerName: 'Player3',
        score: 1500,
        region: Region.NA,
      });

      const naEntries = await leaderboardService.getEntriesByRegion(leaderboard.id, Region.NA, {
        page: 1,
        limit: 10,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });

      expect(naEntries.data).toHaveLength(2);
      expect(naEntries.data.every(e => e.region === Region.NA)).toBe(true);
    });
  });

  describe('getAllLeaderboards', () => {
    it('should return all leaderboards', async () => {
      await leaderboardService.createLeaderboard({
        name: 'Leaderboard 1',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.createLeaderboard({
        name: 'Leaderboard 2',
        type: LeaderboardType.SEASONAL,
        period: RankingPeriod.SEASONAL,
      });

      const all = await leaderboardService.getAllLeaderboards();
      expect(all).toHaveLength(2);
    });

    it('should filter leaderboards by type', async () => {
      await leaderboardService.createLeaderboard({
        name: 'Global',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
      });

      await leaderboardService.createLeaderboard({
        name: 'Seasonal',
        type: LeaderboardType.SEASONAL,
        period: RankingPeriod.SEASONAL,
      });

      const global = await leaderboardService.getAllLeaderboards({ type: LeaderboardType.GLOBAL });
      expect(global).toHaveLength(1);
      expect(global[0].type).toBe(LeaderboardType.GLOBAL);
    });
  });
});
