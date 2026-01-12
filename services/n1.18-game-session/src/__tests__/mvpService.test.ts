import { calculatePlayerScore } from '../services/mvpService';
import { PlayerStats } from '../types';

describe('MVP Service', () => {
  describe('calculatePlayerScore', () => {
    const createMockStats = (overrides: Partial<PlayerStats> = {}): PlayerStats => ({
      id: 'stat-1',
      sessionId: 'session-1',
      playerId: 'player-1',
      kills: 0,
      deaths: 0,
      assists: 0,
      damageDealt: 0,
      damageReceived: 0,
      objectivesCompleted: 0,
      score: 0,
      customStats: {},
      updatedAt: new Date(),
      ...overrides,
    });

    it('should return zero score for player with no stats', () => {
      const stats = createMockStats();
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(0);
      expect(result.breakdown.killScore).toBe(0);
      expect(result.breakdown.assistScore).toBe(0);
      expect(result.breakdown.objectiveScore).toBe(0);
      expect(result.breakdown.damageScore).toBe(0);
    });

    it('should calculate positive score for kills', () => {
      const stats = createMockStats({ kills: 10 });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(100);
      expect(result.breakdown.killScore).toBe(100);
    });

    it('should calculate negative score for deaths', () => {
      const stats = createMockStats({ deaths: 5 });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(-25);
    });

    it('should calculate positive score for assists', () => {
      const stats = createMockStats({ assists: 8 });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(40);
      expect(result.breakdown.assistScore).toBe(40);
    });

    it('should calculate positive score for damage dealt', () => {
      const stats = createMockStats({ damageDealt: 5000 });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(50);
      expect(result.breakdown.damageScore).toBe(50);
    });

    it('should calculate negative score for damage received', () => {
      const stats = createMockStats({ damageReceived: 2000 });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(-10);
    });

    it('should calculate positive score for objectives completed', () => {
      const stats = createMockStats({ objectivesCompleted: 3 });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBe(45);
      expect(result.breakdown.objectiveScore).toBe(45);
    });

    it('should calculate combined score correctly', () => {
      const stats = createMockStats({
        kills: 15,
        deaths: 3,
        assists: 10,
        damageDealt: 10000,
        damageReceived: 4000,
        objectivesCompleted: 2,
      });
      const result = calculatePlayerScore(stats);
      
      const expectedKillScore = 15 * 10;
      const expectedDeathPenalty = 3 * -5;
      const expectedAssistScore = 10 * 5;
      const expectedDamageScore = 10000 * 0.01;
      const expectedDamagePenalty = 4000 * -0.005;
      const expectedObjectiveScore = 2 * 15;
      
      const expectedTotal = expectedKillScore + expectedDeathPenalty + expectedAssistScore + 
                           expectedDamageScore + expectedDamagePenalty + expectedObjectiveScore;
      
      expect(result.totalScore).toBe(expectedTotal);
    });

    it('should handle high-performing player stats', () => {
      const stats = createMockStats({
        kills: 30,
        deaths: 2,
        assists: 20,
        damageDealt: 50000,
        damageReceived: 5000,
        objectivesCompleted: 5,
      });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBeGreaterThan(500);
      expect(result.breakdown.killScore).toBe(300);
      expect(result.breakdown.assistScore).toBe(100);
      expect(result.breakdown.objectiveScore).toBe(75);
    });

    it('should handle player with only deaths (worst case)', () => {
      const stats = createMockStats({
        kills: 0,
        deaths: 20,
        assists: 0,
        damageDealt: 0,
        damageReceived: 10000,
        objectivesCompleted: 0,
      });
      const result = calculatePlayerScore(stats);
      
      expect(result.totalScore).toBeLessThan(0);
    });
  });
});
