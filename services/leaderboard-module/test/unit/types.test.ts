import {
  LeaderboardEntrySchema,
  LeaderboardSchema,
  ScoreSubmissionSchema,
  RankHistorySchema,
  PlayerRankingSchema,
  FriendRankingSchema,
  LeaderboardQuerySchema,
  ScoreSubmissionRequestSchema,
  BatchScoreSubmissionSchema,
  RankContextQuerySchema,
  FriendLeaderboardQuerySchema,
  PlayerComparisonSchema,
  ScoreDisputeSchema,
  AdminScoreActionSchema,
  LeaderboardSnapshotSchema,
  RealTimeUpdateSchema,
  WebSocketSubscriptionSchema,
  LeaderboardType,
  RankingPeriod,
  RankTier,
  TierDivision,
  ScoreSubmissionStatus,
  RankChangeType,
  Region,
  GameMode,
  SortOrder,
  SortField,
} from '../../src/types';

describe('Types and Zod Schemas', () => {
  describe('Enums', () => {
    it('should have correct LeaderboardType values', () => {
      expect(LeaderboardType.GLOBAL).toBe('GLOBAL');
      expect(LeaderboardType.SEASONAL).toBe('SEASONAL');
      expect(LeaderboardType.REGIONAL).toBe('REGIONAL');
      expect(LeaderboardType.FRIEND).toBe('FRIEND');
      expect(LeaderboardType.TOURNAMENT).toBe('TOURNAMENT');
      expect(LeaderboardType.CUSTOM).toBe('CUSTOM');
    });

    it('should have correct RankingPeriod values', () => {
      expect(RankingPeriod.DAILY).toBe('DAILY');
      expect(RankingPeriod.WEEKLY).toBe('WEEKLY');
      expect(RankingPeriod.MONTHLY).toBe('MONTHLY');
      expect(RankingPeriod.SEASONAL).toBe('SEASONAL');
      expect(RankingPeriod.ALL_TIME).toBe('ALL_TIME');
    });

    it('should have correct RankTier values', () => {
      expect(RankTier.UNRANKED).toBe('UNRANKED');
      expect(RankTier.BRONZE).toBe('BRONZE');
      expect(RankTier.SILVER).toBe('SILVER');
      expect(RankTier.GOLD).toBe('GOLD');
      expect(RankTier.PLATINUM).toBe('PLATINUM');
      expect(RankTier.DIAMOND).toBe('DIAMOND');
      expect(RankTier.MASTER).toBe('MASTER');
      expect(RankTier.GRANDMASTER).toBe('GRANDMASTER');
      expect(RankTier.CHALLENGER).toBe('CHALLENGER');
      expect(RankTier.LEGEND).toBe('LEGEND');
    });

    it('should have correct TierDivision values', () => {
      expect(TierDivision.IV).toBe(4);
      expect(TierDivision.III).toBe(3);
      expect(TierDivision.II).toBe(2);
      expect(TierDivision.I).toBe(1);
    });

    it('should have correct ScoreSubmissionStatus values', () => {
      expect(ScoreSubmissionStatus.PENDING).toBe('PENDING');
      expect(ScoreSubmissionStatus.VALIDATED).toBe('VALIDATED');
      expect(ScoreSubmissionStatus.APPROVED).toBe('APPROVED');
      expect(ScoreSubmissionStatus.REJECTED).toBe('REJECTED');
      expect(ScoreSubmissionStatus.DISPUTED).toBe('DISPUTED');
      expect(ScoreSubmissionStatus.ROLLED_BACK).toBe('ROLLED_BACK');
    });

    it('should have correct RankChangeType values', () => {
      expect(RankChangeType.PROMOTION).toBe('PROMOTION');
      expect(RankChangeType.DEMOTION).toBe('DEMOTION');
      expect(RankChangeType.TIER_UP).toBe('TIER_UP');
      expect(RankChangeType.TIER_DOWN).toBe('TIER_DOWN');
      expect(RankChangeType.SCORE_UPDATE).toBe('SCORE_UPDATE');
      expect(RankChangeType.DECAY).toBe('DECAY');
      expect(RankChangeType.RESET).toBe('RESET');
      expect(RankChangeType.ADJUSTMENT).toBe('ADJUSTMENT');
    });

    it('should have correct Region values', () => {
      expect(Region.NA).toBe('NA');
      expect(Region.EU).toBe('EU');
      expect(Region.ASIA).toBe('ASIA');
      expect(Region.OCE).toBe('OCE');
      expect(Region.SA).toBe('SA');
      expect(Region.MENA).toBe('MENA');
      expect(Region.SEA).toBe('SEA');
      expect(Region.JP).toBe('JP');
      expect(Region.KR).toBe('KR');
      expect(Region.CN).toBe('CN');
      expect(Region.GLOBAL).toBe('GLOBAL');
    });

    it('should have correct GameMode values', () => {
      expect(GameMode.RANKED).toBe('RANKED');
      expect(GameMode.CASUAL).toBe('CASUAL');
      expect(GameMode.COMPETITIVE).toBe('COMPETITIVE');
      expect(GameMode.TOURNAMENT).toBe('TOURNAMENT');
      expect(GameMode.CUSTOM).toBe('CUSTOM');
    });

    it('should have correct SortOrder values', () => {
      expect(SortOrder.ASC).toBe('ASC');
      expect(SortOrder.DESC).toBe('DESC');
    });

    it('should have correct SortField values', () => {
      expect(SortField.RANK).toBe('RANK');
      expect(SortField.SCORE).toBe('SCORE');
      expect(SortField.WINS).toBe('WINS');
      expect(SortField.WIN_RATE).toBe('WIN_RATE');
      expect(SortField.MMR).toBe('MMR');
      expect(SortField.GAMES_PLAYED).toBe('GAMES_PLAYED');
      expect(SortField.LAST_ACTIVE).toBe('LAST_ACTIVE');
    });
  });

  describe('LeaderboardQuerySchema', () => {
    it('should validate valid query with defaults', () => {
      const result = LeaderboardQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.sortBy).toBe(SortField.RANK);
      expect(result.sortOrder).toBe(SortOrder.ASC);
    });

    it('should validate query with all fields', () => {
      const query = {
        leaderboardId: '123e4567-e89b-12d3-a456-426614174000',
        type: LeaderboardType.GLOBAL,
        period: RankingPeriod.ALL_TIME,
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        seasonId: '123e4567-e89b-12d3-a456-426614174002',
        region: Region.NA,
        gameMode: GameMode.RANKED,
        tier: RankTier.DIAMOND,
        page: 2,
        limit: 25,
        sortBy: SortField.SCORE,
        sortOrder: SortOrder.DESC,
        search: 'player',
        minScore: 100,
        maxScore: 1000,
        minRank: 1,
        maxRank: 100,
      };
      const result = LeaderboardQuerySchema.parse(query);
      expect(result).toMatchObject(query);
    });

    it('should reject invalid page number', () => {
      expect(() => LeaderboardQuerySchema.parse({ page: 0 })).toThrow();
      expect(() => LeaderboardQuerySchema.parse({ page: -1 })).toThrow();
    });

    it('should reject invalid limit', () => {
      expect(() => LeaderboardQuerySchema.parse({ limit: 0 })).toThrow();
      expect(() => LeaderboardQuerySchema.parse({ limit: 101 })).toThrow();
    });

    it('should reject invalid UUID', () => {
      expect(() => LeaderboardQuerySchema.parse({ leaderboardId: 'invalid' })).toThrow();
    });
  });

  describe('ScoreSubmissionRequestSchema', () => {
    it('should validate valid submission', () => {
      const submission = {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        score: 1000,
      };
      const result = ScoreSubmissionRequestSchema.parse(submission);
      expect(result.playerId).toBe(submission.playerId);
      expect(result.score).toBe(submission.score);
    });

    it('should validate submission with all fields', () => {
      const submission = {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        leaderboardId: '123e4567-e89b-12d3-a456-426614174001',
        score: 1000,
        gameId: '123e4567-e89b-12d3-a456-426614174002',
        matchId: '123e4567-e89b-12d3-a456-426614174003',
        sessionId: '123e4567-e89b-12d3-a456-426614174004',
        gameMode: GameMode.RANKED,
        region: Region.NA,
        validationChecksum: 'abc123',
        validationData: { key: 'value' },
        metadata: { extra: 'data' },
      };
      const result = ScoreSubmissionRequestSchema.parse(submission);
      expect(result).toMatchObject(submission);
    });

    it('should reject negative score', () => {
      expect(() =>
        ScoreSubmissionRequestSchema.parse({
          playerId: '123e4567-e89b-12d3-a456-426614174000',
          score: -1,
        })
      ).toThrow();
    });

    it('should reject invalid playerId', () => {
      expect(() =>
        ScoreSubmissionRequestSchema.parse({
          playerId: 'invalid',
          score: 100,
        })
      ).toThrow();
    });
  });

  describe('BatchScoreSubmissionSchema', () => {
    it('should validate valid batch', () => {
      const batch = {
        submissions: [
          { playerId: '123e4567-e89b-12d3-a456-426614174000', score: 100 },
          { playerId: '123e4567-e89b-12d3-a456-426614174001', score: 200 },
        ],
      };
      const result = BatchScoreSubmissionSchema.parse(batch);
      expect(result.submissions).toHaveLength(2);
    });

    it('should reject empty batch', () => {
      expect(() => BatchScoreSubmissionSchema.parse({ submissions: [] })).toThrow();
    });

    it('should reject batch exceeding 100 submissions', () => {
      const submissions = Array(101)
        .fill(null)
        .map((_, i) => ({
          playerId: `123e4567-e89b-12d3-a456-42661417400${i.toString().padStart(1, '0')}`,
          score: i * 10,
        }));
      expect(() => BatchScoreSubmissionSchema.parse({ submissions })).toThrow();
    });
  });

  describe('RankContextQuerySchema', () => {
    it('should validate valid query', () => {
      const query = {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = RankContextQuerySchema.parse(query);
      expect(result.playerId).toBe(query.playerId);
      expect(result.contextSize).toBe(5);
    });

    it('should validate query with custom context size', () => {
      const query = {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        contextSize: 10,
      };
      const result = RankContextQuerySchema.parse(query);
      expect(result.contextSize).toBe(10);
    });

    it('should reject context size exceeding 50', () => {
      expect(() =>
        RankContextQuerySchema.parse({
          playerId: '123e4567-e89b-12d3-a456-426614174000',
          contextSize: 51,
        })
      ).toThrow();
    });
  });

  describe('FriendLeaderboardQuerySchema', () => {
    it('should validate valid query', () => {
      const query = {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = FriendLeaderboardQuerySchema.parse(query);
      expect(result.playerId).toBe(query.playerId);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.includeMutual).toBe(false);
    });

    it('should validate query with all fields', () => {
      const query = {
        playerId: '123e4567-e89b-12d3-a456-426614174000',
        gameId: '123e4567-e89b-12d3-a456-426614174001',
        seasonId: '123e4567-e89b-12d3-a456-426614174002',
        period: RankingPeriod.WEEKLY,
        page: 2,
        limit: 25,
        includeMutual: true,
        groupId: '123e4567-e89b-12d3-a456-426614174003',
      };
      const result = FriendLeaderboardQuerySchema.parse(query);
      expect(result).toMatchObject(query);
    });
  });

  describe('PlayerComparisonSchema', () => {
    it('should validate valid comparison', () => {
      const comparison = {
        player1Id: '123e4567-e89b-12d3-a456-426614174000',
        player2Id: '123e4567-e89b-12d3-a456-426614174001',
      };
      const result = PlayerComparisonSchema.parse(comparison);
      expect(result.player1Id).toBe(comparison.player1Id);
      expect(result.player2Id).toBe(comparison.player2Id);
    });

    it('should reject invalid player IDs', () => {
      expect(() =>
        PlayerComparisonSchema.parse({
          player1Id: 'invalid',
          player2Id: '123e4567-e89b-12d3-a456-426614174001',
        })
      ).toThrow();
    });
  });

  describe('ScoreDisputeSchema', () => {
    it('should validate valid dispute', () => {
      const dispute = {
        submissionId: '123e4567-e89b-12d3-a456-426614174000',
        playerId: '123e4567-e89b-12d3-a456-426614174001',
        reason: 'This score was incorrectly recorded due to a server error.',
      };
      const result = ScoreDisputeSchema.parse(dispute);
      expect(result).toMatchObject(dispute);
    });

    it('should reject reason shorter than 10 characters', () => {
      expect(() =>
        ScoreDisputeSchema.parse({
          submissionId: '123e4567-e89b-12d3-a456-426614174000',
          playerId: '123e4567-e89b-12d3-a456-426614174001',
          reason: 'Short',
        })
      ).toThrow();
    });

    it('should reject reason longer than 1000 characters', () => {
      expect(() =>
        ScoreDisputeSchema.parse({
          submissionId: '123e4567-e89b-12d3-a456-426614174000',
          playerId: '123e4567-e89b-12d3-a456-426614174001',
          reason: 'a'.repeat(1001),
        })
      ).toThrow();
    });
  });

  describe('AdminScoreActionSchema', () => {
    it('should validate valid approve action', () => {
      const action = {
        submissionId: '123e4567-e89b-12d3-a456-426614174000',
        adminId: '123e4567-e89b-12d3-a456-426614174001',
        action: 'APPROVE' as const,
      };
      const result = AdminScoreActionSchema.parse(action);
      expect(result).toMatchObject(action);
    });

    it('should validate valid reject action', () => {
      const action = {
        submissionId: '123e4567-e89b-12d3-a456-426614174000',
        adminId: '123e4567-e89b-12d3-a456-426614174001',
        action: 'REJECT' as const,
        reason: 'Invalid submission',
      };
      const result = AdminScoreActionSchema.parse(action);
      expect(result).toMatchObject(action);
    });

    it('should validate valid rollback action', () => {
      const action = {
        submissionId: '123e4567-e89b-12d3-a456-426614174000',
        adminId: '123e4567-e89b-12d3-a456-426614174001',
        action: 'ROLLBACK' as const,
      };
      const result = AdminScoreActionSchema.parse(action);
      expect(result).toMatchObject(action);
    });

    it('should reject invalid action', () => {
      expect(() =>
        AdminScoreActionSchema.parse({
          submissionId: '123e4567-e89b-12d3-a456-426614174000',
          adminId: '123e4567-e89b-12d3-a456-426614174001',
          action: 'INVALID',
        })
      ).toThrow();
    });
  });

  describe('WebSocketSubscriptionSchema', () => {
    it('should validate valid subscribe action', () => {
      const subscription = {
        action: 'SUBSCRIBE' as const,
        leaderboardIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = WebSocketSubscriptionSchema.parse(subscription);
      expect(result).toMatchObject(subscription);
    });

    it('should validate valid unsubscribe action', () => {
      const subscription = {
        action: 'UNSUBSCRIBE' as const,
        leaderboardIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };
      const result = WebSocketSubscriptionSchema.parse(subscription);
      expect(result).toMatchObject(subscription);
    });

    it('should reject empty leaderboardIds', () => {
      expect(() =>
        WebSocketSubscriptionSchema.parse({
          action: 'SUBSCRIBE',
          leaderboardIds: [],
        })
      ).toThrow();
    });

    it('should reject more than 10 leaderboardIds', () => {
      const leaderboardIds = Array(11)
        .fill(null)
        .map((_, i) => `123e4567-e89b-12d3-a456-42661417400${i}`);
      expect(() =>
        WebSocketSubscriptionSchema.parse({
          action: 'SUBSCRIBE',
          leaderboardIds,
        })
      ).toThrow();
    });
  });
});
