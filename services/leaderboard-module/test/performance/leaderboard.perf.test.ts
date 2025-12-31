import { leaderboardService } from '../../src/services/leaderboard.service';
import { LeaderboardType, RankingPeriod, SortField, SortOrder } from '../../src/types';

describe('Leaderboard Performance Tests', () => {
  const PERFORMANCE_THRESHOLD_MS = 100;

  beforeAll(async () => {
    leaderboardService.clearAllData();

    const leaderboard = await leaderboardService.createLeaderboard({
      name: 'Performance Test Leaderboard',
      type: LeaderboardType.GLOBAL,
      period: RankingPeriod.ALL_TIME,
    });

    for (let i = 0; i < 10000; i++) {
      await leaderboardService.updateOrCreateEntry(leaderboard.id, {
        playerId: `player-${i}`,
        playerName: `Player${i}`,
        score: Math.floor(Math.random() * 100000),
        mmr: 1000 + Math.floor(Math.random() * 2000),
        wins: Math.floor(Math.random() * 100),
        losses: Math.floor(Math.random() * 50),
        gamesPlayed: Math.floor(Math.random() * 150),
      });
    }
  });

  afterAll(() => {
    leaderboardService.clearAllData();
  });

  describe('Query Performance', () => {
    it('should retrieve top 100 in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getTop100(leaderboardId);
      const duration = performance.now() - start;

      console.log(`getTop100 duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should retrieve paginated entries in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getLeaderboardEntries(leaderboardId, {
        page: 1,
        limit: 50,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });
      const duration = performance.now() - start;

      console.log(`getLeaderboardEntries (page 1) duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should retrieve deep pagination in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getLeaderboardEntries(leaderboardId, {
        page: 100,
        limit: 50,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
      });
      const duration = performance.now() - start;

      console.log(`getLeaderboardEntries (page 100) duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should retrieve player rank in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getPlayerRank(leaderboardId, 'player-5000');
      const duration = performance.now() - start;

      console.log(`getPlayerRank duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should retrieve player context in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getPlayerContext(leaderboardId, 'player-5000', 5);
      const duration = performance.now() - start;

      console.log(`getPlayerContext duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should calculate statistics in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getLeaderboardStatistics(leaderboardId);
      const duration = performance.now() - start;

      console.log(`getLeaderboardStatistics duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should search players in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.searchPlayers(leaderboardId, 'Player50');
      const duration = performance.now() - start;

      console.log(`searchPlayers duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should filter by score range in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.getLeaderboardEntries(leaderboardId, {
        page: 1,
        limit: 50,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
        minScore: 25000,
        maxScore: 75000,
      });
      const duration = performance.now() - start;

      console.log(`getLeaderboardEntries (filtered) duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Write Performance', () => {
    it('should update entry in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.updateOrCreateEntry(leaderboardId, {
        playerId: 'player-0',
        playerName: 'Player0',
        score: 99999,
      });
      const duration = performance.now() - start;

      console.log(`updateOrCreateEntry duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });

    it('should create new entry in under 100ms', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      await leaderboardService.updateOrCreateEntry(leaderboardId, {
        playerId: 'new-player-perf-test',
        playerName: 'NewPlayerPerfTest',
        score: 50000,
      });
      const duration = performance.now() - start;

      console.log(`updateOrCreateEntry (new) duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle 100 concurrent reads in under 500ms total', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      const promises = Array(100)
        .fill(null)
        .map((_, i) =>
          leaderboardService.getPlayerRank(leaderboardId, `player-${i * 100}`)
        );

      await Promise.all(promises);
      const duration = performance.now() - start;

      console.log(`100 concurrent reads duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(500);
    });

    it('should handle mixed read/write operations efficiently', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const start = performance.now();
      const promises = [
        leaderboardService.getTop100(leaderboardId),
        leaderboardService.getLeaderboardEntries(leaderboardId, {
          page: 1,
          limit: 50,
          sortBy: SortField.SCORE,
          sortOrder: SortOrder.DESC,
        }),
        leaderboardService.getPlayerRank(leaderboardId, 'player-1000'),
        leaderboardService.updateOrCreateEntry(leaderboardId, {
          playerId: 'concurrent-test-player',
          playerName: 'ConcurrentTestPlayer',
          score: 12345,
        }),
        leaderboardService.getLeaderboardStatistics(leaderboardId),
      ];

      await Promise.all(promises);
      const duration = performance.now() - start;

      console.log(`Mixed operations duration: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during repeated operations', async () => {
      const leaderboards = await leaderboardService.getAllLeaderboards();
      const leaderboardId = leaderboards[0].id;

      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 1000; i++) {
        await leaderboardService.getTop100(leaderboardId);
        await leaderboardService.getLeaderboardEntries(leaderboardId, {
          page: Math.floor(Math.random() * 100) + 1,
          limit: 50,
          sortBy: SortField.SCORE,
          sortOrder: SortOrder.DESC,
        });
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory increase after 1000 operations: ${memoryIncrease.toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});
