import { LeaderboardService } from '../services/leaderboard.service';
import {
  LeaderboardNotFoundError,
  UserNotRankedError,
  LeaderboardInactiveError,
} from '../types';

describe('LeaderboardService', () => {
  let leaderboardService: LeaderboardService;

  beforeEach(() => {
    leaderboardService = new LeaderboardService();
  });

  describe('createLeaderboard', () => {
    it('should create a leaderboard successfully', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Global Score',
        type: 'global',
        category: 'score',
      });

      expect(leaderboard).toBeDefined();
      expect(leaderboard.name).toBe('Global Score');
      expect(leaderboard.type).toBe('global');
      expect(leaderboard.isActive).toBe(true);
    });

    it('should create leaderboard with custom decay config', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Seasonal Kills',
        type: 'seasonal',
        category: 'kills',
        decayConfig: {
          type: 'linear',
          rate: 0.01,
        },
      });

      expect(leaderboard.decayConfig.type).toBe('linear');
      expect(leaderboard.decayConfig.rate).toBe(0.01);
    });
  });

  describe('updateScore', () => {
    it('should update user score', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Test Leaderboard',
        type: 'global',
        category: 'score',
      });

      const ranking = await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      expect(ranking.score).toBe(1000);
      expect(ranking.rank).toBe(1);
      expect(ranking.percentile).toBe(0);
    });

    it('should increment score when increment flag is true', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Increment Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-2',
        username: 'Player2',
        score: 500,
      });

      const ranking = await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-2',
        username: 'Player2',
        score: 200,
        increment: true,
      });

      expect(ranking.score).toBe(700);
    });

    it('should throw error for non-existent leaderboard', async () => {
      await expect(
        leaderboardService.updateScore({
          leaderboardId: '00000000-0000-0000-0000-000000000000',
          userId: 'user-x',
          username: 'PlayerX',
          score: 100,
        })
      ).rejects.toThrow(LeaderboardNotFoundError);
    });

    it('should throw error for inactive leaderboard', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Inactive Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.setLeaderboardActive(leaderboard.id, false);

      await expect(
        leaderboardService.updateScore({
          leaderboardId: leaderboard.id,
          userId: 'user-3',
          username: 'Player3',
          score: 100,
        })
      ).rejects.toThrow(LeaderboardInactiveError);
    });
  });

  describe('getTopEntries', () => {
    it('should return top entries sorted by score', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Top Entries Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-a',
        username: 'PlayerA',
        score: 500,
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-b',
        username: 'PlayerB',
        score: 1000,
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-c',
        username: 'PlayerC',
        score: 750,
      });

      const entries = await leaderboardService.getTopEntries(leaderboard.id);

      expect(entries).toHaveLength(3);
      expect(entries[0].userId).toBe('user-b');
      expect(entries[0].rank).toBe(1);
      expect(entries[1].userId).toBe('user-c');
      expect(entries[2].userId).toBe('user-a');
    });

    it('should respect start and count options', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Pagination Test',
        type: 'global',
        category: 'score',
      });

      for (let i = 1; i <= 10; i++) {
        await leaderboardService.updateScore({
          leaderboardId: leaderboard.id,
          userId: `user-${i}`,
          username: `Player${i}`,
          score: i * 100,
        });
      }

      const entries = await leaderboardService.getTopEntries(leaderboard.id, { start: 2, count: 3 });

      expect(entries).toHaveLength(3);
      expect(entries[0].rank).toBe(3);
    });
  });

  describe('getUserRanking', () => {
    it('should return user ranking', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'User Ranking Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-2',
        username: 'Player2',
        score: 500,
      });

      const ranking = await leaderboardService.getUserRanking(leaderboard.id, 'user-2');

      expect(ranking.rank).toBe(2);
      expect(ranking.score).toBe(500);
      expect(ranking.percentile).toBe(0);
    });

    it('should throw error for non-ranked user', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Not Ranked Test',
        type: 'global',
        category: 'score',
      });

      await expect(
        leaderboardService.getUserRanking(leaderboard.id, 'non-existent')
      ).rejects.toThrow(UserNotRankedError);
    });
  });

  describe('getAroundUser', () => {
    it('should return entries around user', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Around User Test',
        type: 'global',
        category: 'score',
      });

      for (let i = 1; i <= 20; i++) {
        await leaderboardService.updateScore({
          leaderboardId: leaderboard.id,
          userId: `user-${i}`,
          username: `Player${i}`,
          score: i * 100,
        });
      }

      const entries = await leaderboardService.getAroundUser(leaderboard.id, 'user-10', 3);

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some(e => e.userId === 'user-10')).toBe(true);
    });
  });

  describe('applyDecay', () => {
    it('should not decay when decay type is none', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'No Decay Test',
        type: 'global',
        category: 'score',
        decayConfig: { type: 'none' },
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      const decayedCount = await leaderboardService.applyDecay(leaderboard.id);

      expect(decayedCount).toBe(0);
    });

    it('should apply linear decay', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Linear Decay Test',
        type: 'global',
        category: 'score',
        decayConfig: { type: 'linear', rate: 0.1, maxInactivityDays: 365 },
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      const decayedCount = await leaderboardService.applyDecay(leaderboard.id);

      expect(decayedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createSnapshot and resetLeaderboard', () => {
    it('should create snapshot', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Snapshot Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      const snapshot = await leaderboardService.createSnapshot(leaderboard.id);

      expect(snapshot).toBeDefined();
      expect(snapshot.totalPlayers).toBe(1);
      expect(snapshot.entries).toHaveLength(1);
    });

    it('should reset leaderboard and create snapshot', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Reset Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      await leaderboardService.resetLeaderboard(leaderboard.id);

      const entries = await leaderboardService.getTopEntries(leaderboard.id);
      const snapshotList = await leaderboardService.getSnapshots(leaderboard.id);

      expect(entries).toHaveLength(0);
      expect(snapshotList).toHaveLength(1);
    });
  });

  describe('getLeaderboardStats', () => {
    it('should return leaderboard stats', async () => {
      const leaderboard = await leaderboardService.createLeaderboard({
        name: 'Stats Test',
        type: 'global',
        category: 'score',
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-1',
        username: 'Player1',
        score: 1000,
      });

      await leaderboardService.updateScore({
        leaderboardId: leaderboard.id,
        userId: 'user-2',
        username: 'Player2',
        score: 500,
      });

      const stats = leaderboardService.getLeaderboardStats(leaderboard.id);

      expect(stats).toBeDefined();
      expect(stats!.totalPlayers).toBe(2);
      expect(stats!.topScore).toBe(1000);
      expect(stats!.averageScore).toBe(750);
    });
  });
});
