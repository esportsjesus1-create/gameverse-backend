import {
  uuidSchema,
  positiveIntSchema,
  nonNegativeIntSchema,
  paginationSchema,
  createSeasonSchema,
  registerPlayerSchema,
  updateMMRSchema,
  createRewardSchema,
  claimRewardSchema,
  leaderboardQuerySchema,
  createSeasonChallengeSchema,
  updateChallengeProgressSchema,
  validateInput,
} from '../../src/utils/validation';
import { RewardType, ChallengeType, RankedTier } from '../../src/types';

describe('Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const result = uuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000');
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = uuidSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('positiveIntSchema', () => {
    it('should accept positive integers', () => {
      expect(positiveIntSchema.safeParse(1).success).toBe(true);
      expect(positiveIntSchema.safeParse(100).success).toBe(true);
    });

    it('should reject zero', () => {
      expect(positiveIntSchema.safeParse(0).success).toBe(false);
    });

    it('should reject negative numbers', () => {
      expect(positiveIntSchema.safeParse(-1).success).toBe(false);
    });

    it('should reject floats', () => {
      expect(positiveIntSchema.safeParse(1.5).success).toBe(false);
    });
  });

  describe('nonNegativeIntSchema', () => {
    it('should accept zero', () => {
      expect(nonNegativeIntSchema.safeParse(0).success).toBe(true);
    });

    it('should accept positive integers', () => {
      expect(nonNegativeIntSchema.safeParse(100).success).toBe(true);
    });

    it('should reject negative numbers', () => {
      expect(nonNegativeIntSchema.safeParse(-1).success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should accept valid pagination', () => {
      const result = paginationSchema.safeParse({ page: 1, limit: 50 });
      expect(result.success).toBe(true);
    });

    it('should use defaults when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('should reject page less than 1', () => {
      const result = paginationSchema.safeParse({ page: 0, limit: 50 });
      expect(result.success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      const result = paginationSchema.safeParse({ page: 1, limit: 101 });
      expect(result.success).toBe(false);
    });
  });

  describe('createSeasonSchema', () => {
    const validSeason = {
      name: 'Season 1',
      number: 1,
      startDate: new Date(Date.now() + 86400000).toISOString(),
    };

    it('should accept valid season data', () => {
      const result = createSeasonSchema.safeParse(validSeason);
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createSeasonSchema.safeParse({ ...validSeason, name: '' });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 100 characters', () => {
      const result = createSeasonSchema.safeParse({ ...validSeason, name: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive season number', () => {
      const result = createSeasonSchema.safeParse({ ...validSeason, number: 0 });
      expect(result.success).toBe(false);
    });

    it('should accept optional endDate', () => {
      const result = createSeasonSchema.safeParse({
        ...validSeason,
        endDate: new Date(Date.now() + 86400000 * 90).toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('should apply default soft reset factor', () => {
      const result = createSeasonSchema.parse(validSeason);
      expect(result.softResetFactor).toBe(0.5);
    });

    it('should reject soft reset factor outside 0-1 range', () => {
      expect(createSeasonSchema.safeParse({ ...validSeason, softResetFactor: -0.1 }).success).toBe(false);
      expect(createSeasonSchema.safeParse({ ...validSeason, softResetFactor: 1.1 }).success).toBe(false);
    });

    it('should apply default placement matches', () => {
      const result = createSeasonSchema.parse(validSeason);
      expect(result.placementMatchesRequired).toBe(10);
    });

    it('should reject placement matches outside 1-20 range', () => {
      expect(createSeasonSchema.safeParse({ ...validSeason, placementMatchesRequired: 0 }).success).toBe(false);
      expect(createSeasonSchema.safeParse({ ...validSeason, placementMatchesRequired: 21 }).success).toBe(false);
    });
  });

  describe('registerPlayerSchema', () => {
    it('should accept valid player registration', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        seasonId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional gamerstakePlayerId', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        seasonId: '550e8400-e29b-41d4-a716-446655440001',
        gamerstakePlayerId: 'gs_player_123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid playerId', () => {
      const result = registerPlayerSchema.safeParse({
        playerId: 'invalid',
        seasonId: '550e8400-e29b-41d4-a716-446655440001',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateMMRSchema', () => {
    it('should accept valid MMR update', () => {
      const result = updateMMRSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        opponentId: '550e8400-e29b-41d4-a716-446655440001',
        isWin: true,
      });
      expect(result.success).toBe(true);
    });

    it('should reject same player and opponent', () => {
      const result = updateMMRSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        opponentId: '550e8400-e29b-41d4-a716-446655440000',
        isWin: true,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid playerId', () => {
      const result = updateMMRSchema.safeParse({
        playerId: 'invalid',
        opponentId: '550e8400-e29b-41d4-a716-446655440001',
        isWin: true,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createRewardSchema', () => {
    it('should accept valid reward data', () => {
      const result = createRewardSchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        tier: RankedTier.GOLD,
        rewardType: RewardType.CURRENCY,
        rewardId: 'gold_reward_1',
        rewardName: 'Gold Reward',
        rewardDescription: 'Reward for reaching Gold tier',
        quantity: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty rewardId', () => {
      const result = createRewardSchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        tier: RankedTier.GOLD,
        rewardType: RewardType.CURRENCY,
        rewardId: '',
        rewardName: 'Gold Reward',
        rewardDescription: 'Test',
        quantity: 100,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('claimRewardSchema', () => {
    it('should accept valid claim request', () => {
      const result = claimRewardSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        rewardId: 'reward_123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid playerId', () => {
      const result = claimRewardSchema.safeParse({
        playerId: 'invalid',
        rewardId: 'reward_123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('leaderboardQuerySchema', () => {
    it('should accept valid leaderboard query', () => {
      const result = leaderboardQuerySchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        page: 1,
        limit: 50,
      });
      expect(result.success).toBe(true);
    });

    it('should accept optional tier filter', () => {
      const result = leaderboardQuerySchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        tier: 'GOLD',
      });
      expect(result.success).toBe(true);
    });

    it('should use default pagination', () => {
      const result = leaderboardQuerySchema.parse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });
  });

  describe('createSeasonChallengeSchema', () => {
    it('should accept valid challenge data', () => {
      const result = createSeasonChallengeSchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Weekly Challenge',
        description: 'Complete 10 matches',
        challengeType: ChallengeType.GAMES_PLAYED,
        targetValue: 10,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty name', () => {
      const result = createSeasonChallengeSchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        name: '',
        description: 'Test',
        challengeType: ChallengeType.WINS,
        targetValue: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive target value', () => {
      const result = createSeasonChallengeSchema.safeParse({
        seasonId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Test Challenge',
        challengeType: ChallengeType.WINS,
        targetValue: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updateChallengeProgressSchema', () => {
    it('should accept valid progress update', () => {
      const result = updateChallengeProgressSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        challengeId: '550e8400-e29b-41d4-a716-446655440001',
        progressValue: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative progress', () => {
      const result = updateChallengeProgressSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        challengeId: '550e8400-e29b-41d4-a716-446655440001',
        progressValue: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should accept zero progress', () => {
      const result = updateChallengeProgressSchema.safeParse({
        playerId: '550e8400-e29b-41d4-a716-446655440000',
        challengeId: '550e8400-e29b-41d4-a716-446655440001',
        progressValue: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  describe('validateInput', () => {
    it('should return parsed data for valid input', () => {
      const result = validateInput(uuidSchema, '550e8400-e29b-41d4-a716-446655440000');
      expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should throw ValidationError for invalid input', () => {
      expect(() => validateInput(uuidSchema, 'invalid')).toThrow();
    });
  });
});
