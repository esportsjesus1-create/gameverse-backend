import { AchievementService } from '../services/achievement.service';
import {
  AchievementNotFoundError,
  PrerequisitesNotMetError,
  RewardsAlreadyClaimedError,
} from '../types';

describe('AchievementService', () => {
  let achievementService: AchievementService;

  beforeEach(() => {
    achievementService = new AchievementService();
  });

  describe('createAchievement', () => {
    it('should create an achievement successfully', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'First Blood',
        description: 'Get your first kill',
        type: 'standard',
        category: 'combat',
        points: 10,
        trigger: {
          type: 'stat_threshold',
          statKey: 'kills',
          threshold: 1,
          comparison: 'gte',
        },
        rewards: [{ type: 'xp', amount: 100 }],
      });

      expect(achievement).toBeDefined();
      expect(achievement.name).toBe('First Blood');
      expect(achievement.isActive).toBe(true);
    });

    it('should create a tiered achievement', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'Kill Master',
        description: 'Accumulate kills',
        type: 'tiered',
        category: 'combat',
        points: 50,
        trigger: {
          type: 'cumulative',
          statKey: 'kills',
          threshold: 100,
          comparison: 'gte',
        },
        rewards: [],
        tiers: [
          { tier: 1, name: 'Bronze', threshold: 10, rewards: [{ type: 'xp', amount: 50 }], points: 10 },
          { tier: 2, name: 'Silver', threshold: 50, rewards: [{ type: 'xp', amount: 100 }], points: 20 },
          { tier: 3, name: 'Gold', threshold: 100, rewards: [{ type: 'xp', amount: 200 }], points: 50 },
        ],
      });

      expect(achievement.tiers).toHaveLength(3);
    });
  });

  describe('updateProgress', () => {
    it('should update progress and unlock achievement', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'First Win',
        description: 'Win your first match',
        type: 'standard',
        category: 'progression',
        points: 20,
        trigger: {
          type: 'stat_threshold',
          statKey: 'wins',
          threshold: 1,
          comparison: 'gte',
        },
        rewards: [{ type: 'currency', amount: 500 }],
      });

      const result = await achievementService.updateProgress({
        odbyId: 'user-1',
        achievementId: achievement.id,
        progress: 1,
      });

      expect(result).toBeDefined();
      expect(result!.isNewUnlock).toBe(true);
      expect(result!.rewards).toHaveLength(1);
    });

    it('should increment progress when flag is set', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'Collector',
        description: 'Collect 10 items',
        type: 'standard',
        category: 'collection',
        points: 15,
        trigger: {
          type: 'cumulative',
          statKey: 'items_collected',
          threshold: 10,
          comparison: 'gte',
        },
        rewards: [{ type: 'badge', amount: 1 }],
      });

      await achievementService.updateProgress({
        odbyId: 'user-2',
        achievementId: achievement.id,
        progress: 5,
        increment: true,
      });

      const progress = await achievementService.getUserProgress('user-2', achievement.id);
      expect(progress!.progress).toBe(5);

      await achievementService.updateProgress({
        odbyId: 'user-2',
        achievementId: achievement.id,
        progress: 5,
        increment: true,
      });

      const finalProgress = await achievementService.getUserProgress('user-2', achievement.id);
      expect(finalProgress!.progress).toBe(10);
      expect(finalProgress!.isUnlocked).toBe(true);
    });

    it('should throw error for non-existent achievement', async () => {
      await expect(
        achievementService.updateProgress({
          odbyId: 'user-x',
          achievementId: '00000000-0000-0000-0000-000000000000',
          progress: 1,
        })
      ).rejects.toThrow(AchievementNotFoundError);
    });

    it('should throw error when prerequisites not met', async () => {
      const prereq = await achievementService.createAchievement({
        name: 'Prerequisite',
        description: 'Must complete first',
        type: 'standard',
        category: 'progression',
        points: 5,
        trigger: { type: 'event', eventType: 'tutorial_complete', threshold: 1, comparison: 'gte' },
        rewards: [],
      });

      const achievement = await achievementService.createAchievement({
        name: 'Advanced',
        description: 'Requires prerequisite',
        type: 'standard',
        category: 'progression',
        points: 25,
        trigger: { type: 'stat_threshold', statKey: 'level', threshold: 10, comparison: 'gte' },
        rewards: [],
        prerequisites: [prereq.id],
      });

      await expect(
        achievementService.updateProgress({
          odbyId: 'user-3',
          achievementId: achievement.id,
          progress: 10,
        })
      ).rejects.toThrow(PrerequisitesNotMetError);
    });
  });

  describe('updateStat', () => {
    it('should update stat and trigger achievement unlock', async () => {
      await achievementService.createAchievement({
        name: 'Damage Dealer',
        description: 'Deal 1000 damage',
        type: 'standard',
        category: 'combat',
        points: 30,
        trigger: {
          type: 'stat_threshold',
          statKey: 'damage_dealt',
          threshold: 1000,
          comparison: 'gte',
        },
        rewards: [{ type: 'title', amount: 1, itemId: 'damage_dealer_title' }],
      });

      const results = await achievementService.updateStat({
        odbyId: 'user-4',
        statKey: 'damage_dealt',
        value: 1000,
      });

      expect(results).toHaveLength(1);
      expect(results[0].isNewUnlock).toBe(true);
    });

    it('should increment stat value', async () => {
      await achievementService.updateStat({
        odbyId: 'user-5',
        statKey: 'gold_earned',
        value: 100,
        increment: true,
      });

      await achievementService.updateStat({
        odbyId: 'user-5',
        statKey: 'gold_earned',
        value: 50,
        increment: true,
      });

      const stats = achievementService.getUserStats('user-5');
      expect(stats!.stats['gold_earned']).toBe(150);
    });
  });

  describe('triggerEvent', () => {
    it('should trigger event-based achievement', async () => {
      await achievementService.createAchievement({
        name: 'Welcome',
        description: 'Complete the tutorial',
        type: 'standard',
        category: 'progression',
        points: 5,
        trigger: {
          type: 'first_time',
          eventType: 'tutorial_complete',
          threshold: 1,
          comparison: 'gte',
        },
        rewards: [{ type: 'currency', amount: 100 }],
      });

      const results = await achievementService.triggerEvent({
        odbyId: 'user-6',
        eventType: 'tutorial_complete',
      });

      expect(results).toHaveLength(1);
      expect(results[0].achievement.name).toBe('Welcome');
    });
  });

  describe('claimRewards', () => {
    it('should claim rewards for unlocked achievement', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'Claimable',
        description: 'Test claiming',
        type: 'standard',
        category: 'special',
        points: 10,
        trigger: { type: 'stat_threshold', statKey: 'test', threshold: 1, comparison: 'gte' },
        rewards: [{ type: 'currency', amount: 1000 }],
      });

      await achievementService.updateProgress({
        odbyId: 'user-7',
        achievementId: achievement.id,
        progress: 1,
      });

      const result = await achievementService.claimRewards('user-7', achievement.id);

      expect(result.rewards).toHaveLength(1);
      expect(result.rewards[0].amount).toBe(1000);
    });

    it('should throw error when rewards already claimed', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'Double Claim',
        description: 'Test double claiming',
        type: 'standard',
        category: 'special',
        points: 10,
        trigger: { type: 'stat_threshold', statKey: 'test2', threshold: 1, comparison: 'gte' },
        rewards: [{ type: 'xp', amount: 50 }],
      });

      await achievementService.updateProgress({
        odbyId: 'user-8',
        achievementId: achievement.id,
        progress: 1,
      });

      await achievementService.claimRewards('user-8', achievement.id);

      await expect(
        achievementService.claimRewards('user-8', achievement.id)
      ).rejects.toThrow(RewardsAlreadyClaimedError);
    });
  });

  describe('getAchievementStats', () => {
    it('should return user achievement stats', async () => {
      const ach1 = await achievementService.createAchievement({
        name: 'Stats Test 1',
        description: 'Test 1',
        type: 'standard',
        category: 'combat',
        points: 10,
        trigger: { type: 'stat_threshold', statKey: 's1', threshold: 1, comparison: 'gte' },
        rewards: [],
      });

      await achievementService.createAchievement({
        name: 'Stats Test 2',
        description: 'Test 2',
        type: 'standard',
        category: 'combat',
        points: 20,
        trigger: { type: 'stat_threshold', statKey: 's2', threshold: 1, comparison: 'gte' },
        rewards: [],
      });

      await achievementService.updateProgress({
        odbyId: 'user-9',
        achievementId: ach1.id,
        progress: 1,
      });

      const stats = await achievementService.getAchievementStats('user-9');

      expect(stats.totalAchievements).toBe(2);
      expect(stats.unlockedCount).toBe(1);
      expect(stats.earnedPoints).toBe(10);
      expect(stats.completionPercent).toBe(50);
    });
  });

  describe('tiered achievements', () => {
    it('should progress through tiers', async () => {
      const achievement = await achievementService.createAchievement({
        name: 'Tier Test',
        description: 'Test tiers',
        type: 'tiered',
        category: 'progression',
        points: 100,
        trigger: { type: 'cumulative', statKey: 'tier_test', threshold: 100, comparison: 'gte' },
        rewards: [],
        tiers: [
          { tier: 1, name: 'Bronze', threshold: 10, rewards: [{ type: 'xp', amount: 10 }], points: 10 },
          { tier: 2, name: 'Silver', threshold: 50, rewards: [{ type: 'xp', amount: 50 }], points: 30 },
          { tier: 3, name: 'Gold', threshold: 100, rewards: [{ type: 'xp', amount: 100 }], points: 60 },
        ],
      });

      const result1 = await achievementService.updateProgress({
        odbyId: 'user-10',
        achievementId: achievement.id,
        progress: 10,
      });

      expect(result1!.tier).toBe(1);
      expect(result1!.isTierUp).toBe(true);

      const result2 = await achievementService.updateProgress({
        odbyId: 'user-10',
        achievementId: achievement.id,
        progress: 50,
      });

      expect(result2!.tier).toBe(2);
    });
  });
});
