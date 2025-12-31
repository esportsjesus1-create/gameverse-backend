import {
  AppError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  LeaderboardNotFoundError,
  LeaderboardEntryNotFoundError,
  PlayerNotFoundError,
  SeasonNotFoundError,
  ScoreSubmissionNotFoundError,
  RankHistoryNotFoundError,
  FriendGroupNotFoundError,
  ChallengeNotFoundError,
  SnapshotNotFoundError,
  LeaderboardInactiveError,
  LeaderboardFullError,
  LeaderboardPrivateError,
  LeaderboardLockedError,
  LeaderboardResetInProgressError,
  InvalidScoreError,
  ScoreValidationFailedError,
  ScoreChecksumMismatchError,
  ScoreAlreadySubmittedError,
  ScoreSubmissionExpiredError,
  ScoreSubmissionPendingError,
  ScoreSubmissionRejectedError,
  ScoreDisputeAlreadyExistsError,
  ScoreDisputeNotAllowedError,
  ScoreRollbackNotAllowedError,
  AntiCheatViolationError,
  SuspiciousActivityError,
  PlayerBannedError,
  PlayerSuspendedError,
  RankDecayActiveError,
  RankDecayProtectedError,
  PlacementNotCompletedError,
  SeasonNotActiveError,
  SeasonEndedError,
  RegionNotSupportedError,
  RegionMismatchError,
  FriendshipNotFoundError,
  NotFriendsError,
  FriendGroupFullError,
  FriendGroupPermissionError,
  ChallengeAlreadyExistsError,
  ChallengeExpiredError,
  ChallengeNotActiveError,
  CannotChallengeSelfError,
  WebSocketConnectionError,
  WebSocketSubscriptionLimitError,
  WebSocketAuthenticationError,
  CacheError,
  CacheInvalidationError,
  DatabaseError,
  QueryTimeoutError,
  InvalidPaginationError,
  InvalidSortFieldError,
  InvalidFilterError,
  InvalidDateRangeError,
  BatchOperationError,
  BatchSizeLimitError,
  ConcurrencyError,
  VersionMismatchError,
  MaintenanceModeError,
  FeatureDisabledError,
  isAppError,
  handleError,
  ErrorCodes,
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with all properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', true, { key: 'value' });
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.details).toEqual({ key: 'value' });
      expect(error.stack).toBeDefined();
    });

    it('should default isOperational to true', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      expect(error.isOperational).toBe(true);
    });
  });

  describe('NotFoundError', () => {
    it('should create NotFoundError with resource name', () => {
      const error = new NotFoundError('User');
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create NotFoundError with resource name and id', () => {
      const error = new NotFoundError('User', '123');
      expect(error.message).toBe('User with id 123 not found');
    });
  });

  describe('BadRequestError', () => {
    it('should create BadRequestError', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create UnauthorizedError with default message', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });

    it('should create UnauthorizedError with custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('should create ForbiddenError with default message', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('ConflictError', () => {
    it('should create ConflictError', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ValidationError', () => {
    it('should create ValidationError with errors object', () => {
      const errors = { email: ['Invalid email format'] };
      const error = new ValidationError('Validation failed', errors);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.errors).toEqual(errors);
    });
  });

  describe('RateLimitError', () => {
    it('should create RateLimitError with default values', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Too many requests');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(60);
    });

    it('should create RateLimitError with custom values', () => {
      const error = new RateLimitError('Rate limit exceeded', 120);
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.retryAfter).toBe(120);
    });
  });

  describe('InternalServerError', () => {
    it('should create InternalServerError', () => {
      const error = new InternalServerError();
      expect(error.message).toBe('Internal server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.isOperational).toBe(false);
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create ServiceUnavailableError', () => {
      const error = new ServiceUnavailableError();
      expect(error.message).toBe('Service temporarily unavailable');
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('Leaderboard-specific errors', () => {
    it('should create LeaderboardNotFoundError', () => {
      const error = new LeaderboardNotFoundError('lb-123');
      expect(error.message).toBe('Leaderboard with id lb-123 not found');
      expect(error.statusCode).toBe(404);
    });

    it('should create LeaderboardEntryNotFoundError', () => {
      const error = new LeaderboardEntryNotFoundError('player-123', 'lb-123');
      expect(error.message).toContain('player-123');
      expect(error.message).toContain('lb-123');
    });

    it('should create LeaderboardInactiveError', () => {
      const error = new LeaderboardInactiveError('lb-123');
      expect(error.message).toContain('not active');
      expect(error.code).toBe('LEADERBOARD_INACTIVE');
    });

    it('should create LeaderboardFullError', () => {
      const error = new LeaderboardFullError('lb-123');
      expect(error.message).toContain('maximum entries');
      expect(error.code).toBe('LEADERBOARD_FULL');
    });

    it('should create LeaderboardPrivateError', () => {
      const error = new LeaderboardPrivateError('lb-123');
      expect(error.message).toContain('private');
      expect(error.statusCode).toBe(403);
    });

    it('should create LeaderboardLockedError', () => {
      const error = new LeaderboardLockedError('lb-123');
      expect(error.message).toContain('locked');
      expect(error.statusCode).toBe(423);
    });

    it('should create LeaderboardResetInProgressError', () => {
      const error = new LeaderboardResetInProgressError('lb-123');
      expect(error.message).toContain('reset is in progress');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('Score-specific errors', () => {
    it('should create InvalidScoreError', () => {
      const error = new InvalidScoreError('Score cannot be negative');
      expect(error.code).toBe('INVALID_SCORE');
    });

    it('should create ScoreValidationFailedError', () => {
      const error = new ScoreValidationFailedError('checksum mismatch');
      expect(error.message).toContain('checksum mismatch');
      expect(error.code).toBe('SCORE_VALIDATION_FAILED');
    });

    it('should create ScoreChecksumMismatchError', () => {
      const error = new ScoreChecksumMismatchError();
      expect(error.code).toBe('SCORE_CHECKSUM_MISMATCH');
    });

    it('should create ScoreAlreadySubmittedError', () => {
      const error = new ScoreAlreadySubmittedError('match-123');
      expect(error.message).toContain('match-123');
      expect(error.code).toBe('SCORE_ALREADY_SUBMITTED');
    });

    it('should create ScoreSubmissionExpiredError', () => {
      const error = new ScoreSubmissionExpiredError('sub-123');
      expect(error.code).toBe('SCORE_SUBMISSION_EXPIRED');
    });

    it('should create ScoreSubmissionPendingError', () => {
      const error = new ScoreSubmissionPendingError('sub-123');
      expect(error.code).toBe('SCORE_SUBMISSION_PENDING');
    });

    it('should create ScoreSubmissionRejectedError', () => {
      const error = new ScoreSubmissionRejectedError('sub-123', 'Invalid data');
      expect(error.message).toContain('Invalid data');
      expect(error.code).toBe('SCORE_SUBMISSION_REJECTED');
    });

    it('should create ScoreDisputeAlreadyExistsError', () => {
      const error = new ScoreDisputeAlreadyExistsError('sub-123');
      expect(error.code).toBe('SCORE_DISPUTE_EXISTS');
    });

    it('should create ScoreDisputeNotAllowedError', () => {
      const error = new ScoreDisputeNotAllowedError('Window expired');
      expect(error.code).toBe('SCORE_DISPUTE_NOT_ALLOWED');
    });

    it('should create ScoreRollbackNotAllowedError', () => {
      const error = new ScoreRollbackNotAllowedError('sub-123', 'Already processed');
      expect(error.code).toBe('SCORE_ROLLBACK_NOT_ALLOWED');
    });
  });

  describe('Anti-cheat errors', () => {
    it('should create AntiCheatViolationError', () => {
      const error = new AntiCheatViolationError('player-123', 'SCORE_MANIPULATION', { score: 999999 });
      expect(error.message).toContain('player-123');
      expect(error.message).toContain('SCORE_MANIPULATION');
      expect(error.code).toBe('ANTI_CHEAT_VIOLATION');
      expect(error.statusCode).toBe(403);
    });

    it('should create SuspiciousActivityError', () => {
      const error = new SuspiciousActivityError('player-123', 'RAPID_SCORE_INCREASE');
      expect(error.code).toBe('SUSPICIOUS_ACTIVITY');
    });

    it('should create PlayerBannedError', () => {
      const error = new PlayerBannedError('player-123', 'Cheating');
      expect(error.message).toContain('Cheating');
      expect(error.code).toBe('PLAYER_BANNED');
    });

    it('should create PlayerSuspendedError', () => {
      const until = new Date('2024-12-31');
      const error = new PlayerSuspendedError('player-123', until);
      expect(error.message).toContain('2024-12-31');
      expect(error.code).toBe('PLAYER_SUSPENDED');
    });
  });

  describe('Season-specific errors', () => {
    it('should create SeasonNotFoundError', () => {
      const error = new SeasonNotFoundError('season-123');
      expect(error.statusCode).toBe(404);
    });

    it('should create SeasonNotActiveError', () => {
      const error = new SeasonNotActiveError('season-123');
      expect(error.code).toBe('SEASON_NOT_ACTIVE');
    });

    it('should create SeasonEndedError', () => {
      const error = new SeasonEndedError('season-123');
      expect(error.code).toBe('SEASON_ENDED');
    });

    it('should create PlacementNotCompletedError', () => {
      const error = new PlacementNotCompletedError('player-123');
      expect(error.code).toBe('PLACEMENT_NOT_COMPLETED');
    });

    it('should create RankDecayActiveError', () => {
      const error = new RankDecayActiveError('player-123');
      expect(error.code).toBe('RANK_DECAY_ACTIVE');
    });

    it('should create RankDecayProtectedError', () => {
      const error = new RankDecayProtectedError('player-123');
      expect(error.code).toBe('RANK_DECAY_PROTECTED');
    });
  });

  describe('Region-specific errors', () => {
    it('should create RegionNotSupportedError', () => {
      const error = new RegionNotSupportedError('INVALID');
      expect(error.code).toBe('REGION_NOT_SUPPORTED');
    });

    it('should create RegionMismatchError', () => {
      const error = new RegionMismatchError('NA', 'EU');
      expect(error.message).toContain('NA');
      expect(error.message).toContain('EU');
      expect(error.code).toBe('REGION_MISMATCH');
    });
  });

  describe('Friend-specific errors', () => {
    it('should create FriendshipNotFoundError', () => {
      const error = new FriendshipNotFoundError('player-1', 'player-2');
      expect(error.code).toBe('FRIENDSHIP_NOT_FOUND');
    });

    it('should create NotFriendsError', () => {
      const error = new NotFriendsError('player-1', 'player-2');
      expect(error.code).toBe('NOT_FRIENDS');
    });

    it('should create FriendGroupNotFoundError', () => {
      const error = new FriendGroupNotFoundError('group-123');
      expect(error.statusCode).toBe(404);
    });

    it('should create FriendGroupFullError', () => {
      const error = new FriendGroupFullError('group-123');
      expect(error.code).toBe('FRIEND_GROUP_FULL');
    });

    it('should create FriendGroupPermissionError', () => {
      const error = new FriendGroupPermissionError('player-123', 'group-123');
      expect(error.code).toBe('FRIEND_GROUP_PERMISSION');
      expect(error.statusCode).toBe(403);
    });

    it('should create ChallengeNotFoundError', () => {
      const error = new ChallengeNotFoundError('challenge-123');
      expect(error.statusCode).toBe(404);
    });

    it('should create ChallengeAlreadyExistsError', () => {
      const error = new ChallengeAlreadyExistsError('player-1', 'player-2');
      expect(error.code).toBe('CHALLENGE_ALREADY_EXISTS');
    });

    it('should create ChallengeExpiredError', () => {
      const error = new ChallengeExpiredError('challenge-123');
      expect(error.code).toBe('CHALLENGE_EXPIRED');
    });

    it('should create ChallengeNotActiveError', () => {
      const error = new ChallengeNotActiveError('challenge-123');
      expect(error.code).toBe('CHALLENGE_NOT_ACTIVE');
    });

    it('should create CannotChallengeSelfError', () => {
      const error = new CannotChallengeSelfError();
      expect(error.code).toBe('CANNOT_CHALLENGE_SELF');
    });
  });

  describe('WebSocket errors', () => {
    it('should create WebSocketConnectionError', () => {
      const error = new WebSocketConnectionError('Connection refused');
      expect(error.code).toBe('WEBSOCKET_CONNECTION_ERROR');
    });

    it('should create WebSocketSubscriptionLimitError', () => {
      const error = new WebSocketSubscriptionLimitError(10);
      expect(error.message).toContain('10');
      expect(error.code).toBe('WEBSOCKET_SUBSCRIPTION_LIMIT');
    });

    it('should create WebSocketAuthenticationError', () => {
      const error = new WebSocketAuthenticationError();
      expect(error.code).toBe('WEBSOCKET_AUTH_FAILED');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('Infrastructure errors', () => {
    it('should create CacheError', () => {
      const error = new CacheError('GET operation');
      expect(error.code).toBe('CACHE_ERROR');
      expect(error.isOperational).toBe(false);
    });

    it('should create CacheInvalidationError', () => {
      const error = new CacheInvalidationError('leaderboard:123');
      expect(error.code).toBe('CACHE_INVALIDATION_ERROR');
    });

    it('should create DatabaseError', () => {
      const error = new DatabaseError('INSERT operation');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.isOperational).toBe(false);
    });

    it('should create QueryTimeoutError', () => {
      const error = new QueryTimeoutError('getLeaderboard', 100);
      expect(error.message).toContain('100ms');
      expect(error.code).toBe('QUERY_TIMEOUT');
      expect(error.statusCode).toBe(504);
    });
  });

  describe('Validation errors', () => {
    it('should create InvalidPaginationError', () => {
      const error = new InvalidPaginationError('Page must be positive');
      expect(error.code).toBe('INVALID_PAGINATION');
    });

    it('should create InvalidSortFieldError', () => {
      const error = new InvalidSortFieldError('invalid_field');
      expect(error.code).toBe('INVALID_SORT_FIELD');
    });

    it('should create InvalidFilterError', () => {
      const error = new InvalidFilterError('tier', 'Invalid tier value');
      expect(error.code).toBe('INVALID_FILTER');
    });

    it('should create InvalidDateRangeError', () => {
      const start = new Date('2024-12-31');
      const end = new Date('2024-01-01');
      const error = new InvalidDateRangeError(start, end);
      expect(error.code).toBe('INVALID_DATE_RANGE');
    });
  });

  describe('Batch errors', () => {
    it('should create BatchOperationError', () => {
      const failedItems = [{ index: 0, error: 'Invalid score' }];
      const error = new BatchOperationError('Batch failed', failedItems);
      expect(error.code).toBe('BATCH_OPERATION_ERROR');
      expect(error.failedItems).toEqual(failedItems);
    });

    it('should create BatchSizeLimitError', () => {
      const error = new BatchSizeLimitError(150, 100);
      expect(error.message).toContain('150');
      expect(error.message).toContain('100');
      expect(error.code).toBe('BATCH_SIZE_LIMIT');
    });
  });

  describe('Concurrency errors', () => {
    it('should create ConcurrencyError', () => {
      const error = new ConcurrencyError('leaderboard entry');
      expect(error.code).toBe('CONCURRENCY_ERROR');
      expect(error.statusCode).toBe(409);
    });

    it('should create VersionMismatchError', () => {
      const error = new VersionMismatchError(1, 2);
      expect(error.message).toContain('1');
      expect(error.message).toContain('2');
      expect(error.code).toBe('VERSION_MISMATCH');
    });
  });

  describe('System errors', () => {
    it('should create MaintenanceModeError without end time', () => {
      const error = new MaintenanceModeError();
      expect(error.code).toBe('MAINTENANCE_MODE');
      expect(error.statusCode).toBe(503);
    });

    it('should create MaintenanceModeError with end time', () => {
      const endTime = new Date('2024-12-31T12:00:00Z');
      const error = new MaintenanceModeError(endTime);
      expect(error.message).toContain('2024-12-31');
    });

    it('should create FeatureDisabledError', () => {
      const error = new FeatureDisabledError('friend_challenges');
      expect(error.message).toContain('friend_challenges');
      expect(error.code).toBe('FEATURE_DISABLED');
    });
  });

  describe('Helper functions', () => {
    describe('isAppError', () => {
      it('should return true for AppError instances', () => {
        const error = new AppError('Test', 400, 'TEST');
        expect(isAppError(error)).toBe(true);
      });

      it('should return true for AppError subclasses', () => {
        const error = new NotFoundError('Resource');
        expect(isAppError(error)).toBe(true);
      });

      it('should return false for regular Error', () => {
        const error = new Error('Test');
        expect(isAppError(error)).toBe(false);
      });

      it('should return false for non-Error objects', () => {
        expect(isAppError('string')).toBe(false);
        expect(isAppError(null)).toBe(false);
        expect(isAppError(undefined)).toBe(false);
        expect(isAppError({})).toBe(false);
      });
    });

    describe('handleError', () => {
      it('should return AppError as-is', () => {
        const error = new NotFoundError('Resource');
        const result = handleError(error);
        expect(result).toBe(error);
      });

      it('should wrap regular Error in InternalServerError', () => {
        const error = new Error('Something went wrong');
        const result = handleError(error);
        expect(result).toBeInstanceOf(InternalServerError);
        expect(result.message).toBe('Something went wrong');
      });

      it('should wrap unknown errors in InternalServerError', () => {
        const result = handleError('string error');
        expect(result).toBeInstanceOf(InternalServerError);
        expect(result.message).toBe('An unexpected error occurred');
      });
    });
  });

  describe('ErrorCodes', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(ErrorCodes.INTERNAL_SERVER_ERROR).toBe('INTERNAL_SERVER_ERROR');
      expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
      expect(ErrorCodes.LEADERBOARD_INACTIVE).toBe('LEADERBOARD_INACTIVE');
      expect(ErrorCodes.LEADERBOARD_FULL).toBe('LEADERBOARD_FULL');
      expect(ErrorCodes.ANTI_CHEAT_VIOLATION).toBe('ANTI_CHEAT_VIOLATION');
      expect(ErrorCodes.WEBSOCKET_CONNECTION_ERROR).toBe('WEBSOCKET_CONNECTION_ERROR');
      expect(ErrorCodes.CACHE_ERROR).toBe('CACHE_ERROR');
      expect(ErrorCodes.DATABASE_ERROR).toBe('DATABASE_ERROR');
      expect(ErrorCodes.MAINTENANCE_MODE).toBe('MAINTENANCE_MODE');
    });

    it('should have more than 40 error codes', () => {
      const errorCodeCount = Object.keys(ErrorCodes).length;
      expect(errorCodeCount).toBeGreaterThanOrEqual(40);
    });
  });
});
