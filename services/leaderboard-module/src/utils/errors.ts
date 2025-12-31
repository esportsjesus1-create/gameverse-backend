export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

export class ValidationError extends AppError {
  public readonly errors: Record<string, string[]>;

  constructor(message: string, errors: Record<string, string[]> = {}) {
    super(message, 422, 'VALIDATION_ERROR', true, errors);
    this.errors = errors;
  }
}

export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_SERVER_ERROR', false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export class LeaderboardNotFoundError extends NotFoundError {
  constructor(leaderboardId: string) {
    super('Leaderboard', leaderboardId);
  }
}

export class LeaderboardEntryNotFoundError extends NotFoundError {
  constructor(playerId: string, leaderboardId?: string) {
    const message = leaderboardId
      ? `Leaderboard entry for player ${playerId} in leaderboard ${leaderboardId} not found`
      : `Leaderboard entry for player ${playerId} not found`;
    super(message);
  }
}

export class PlayerNotFoundError extends NotFoundError {
  constructor(playerId: string) {
    super('Player', playerId);
  }
}

export class SeasonNotFoundError extends NotFoundError {
  constructor(seasonId: string) {
    super('Season', seasonId);
  }
}

export class ScoreSubmissionNotFoundError extends NotFoundError {
  constructor(submissionId: string) {
    super('Score submission', submissionId);
  }
}

export class RankHistoryNotFoundError extends NotFoundError {
  constructor(playerId: string) {
    super(`Rank history for player ${playerId}`);
  }
}

export class FriendGroupNotFoundError extends NotFoundError {
  constructor(groupId: string) {
    super('Friend group', groupId);
  }
}

export class ChallengeNotFoundError extends NotFoundError {
  constructor(challengeId: string) {
    super('Challenge', challengeId);
  }
}

export class SnapshotNotFoundError extends NotFoundError {
  constructor(snapshotId: string) {
    super('Leaderboard snapshot', snapshotId);
  }
}

export class LeaderboardInactiveError extends AppError {
  constructor(leaderboardId: string) {
    super(`Leaderboard ${leaderboardId} is not active`, 400, 'LEADERBOARD_INACTIVE');
  }
}

export class LeaderboardFullError extends AppError {
  constructor(leaderboardId: string) {
    super(`Leaderboard ${leaderboardId} has reached maximum entries`, 400, 'LEADERBOARD_FULL');
  }
}

export class LeaderboardPrivateError extends AppError {
  constructor(leaderboardId: string) {
    super(`Leaderboard ${leaderboardId} is private`, 403, 'LEADERBOARD_PRIVATE');
  }
}

export class LeaderboardLockedError extends AppError {
  constructor(leaderboardId: string) {
    super(`Leaderboard ${leaderboardId} is locked for updates`, 423, 'LEADERBOARD_LOCKED');
  }
}

export class LeaderboardResetInProgressError extends AppError {
  constructor(leaderboardId: string) {
    super(`Leaderboard ${leaderboardId} reset is in progress`, 409, 'LEADERBOARD_RESET_IN_PROGRESS');
  }
}

export class InvalidScoreError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'INVALID_SCORE', true, details);
  }
}

export class ScoreValidationFailedError extends AppError {
  constructor(reason: string, details?: unknown) {
    super(`Score validation failed: ${reason}`, 400, 'SCORE_VALIDATION_FAILED', true, details);
  }
}

export class ScoreChecksumMismatchError extends AppError {
  constructor() {
    super('Score checksum does not match', 400, 'SCORE_CHECKSUM_MISMATCH');
  }
}

export class ScoreAlreadySubmittedError extends AppError {
  constructor(matchId: string) {
    super(`Score for match ${matchId} has already been submitted`, 409, 'SCORE_ALREADY_SUBMITTED');
  }
}

export class ScoreSubmissionExpiredError extends AppError {
  constructor(submissionId: string) {
    super(`Score submission ${submissionId} has expired`, 400, 'SCORE_SUBMISSION_EXPIRED');
  }
}

export class ScoreSubmissionPendingError extends AppError {
  constructor(submissionId: string) {
    super(`Score submission ${submissionId} is still pending validation`, 400, 'SCORE_SUBMISSION_PENDING');
  }
}

export class ScoreSubmissionRejectedError extends AppError {
  constructor(submissionId: string, reason?: string) {
    const message = reason
      ? `Score submission ${submissionId} was rejected: ${reason}`
      : `Score submission ${submissionId} was rejected`;
    super(message, 400, 'SCORE_SUBMISSION_REJECTED');
  }
}

export class ScoreDisputeAlreadyExistsError extends AppError {
  constructor(submissionId: string) {
    super(`A dispute for submission ${submissionId} already exists`, 409, 'SCORE_DISPUTE_EXISTS');
  }
}

export class ScoreDisputeNotAllowedError extends AppError {
  constructor(reason: string) {
    super(`Score dispute not allowed: ${reason}`, 400, 'SCORE_DISPUTE_NOT_ALLOWED');
  }
}

export class ScoreRollbackNotAllowedError extends AppError {
  constructor(submissionId: string, reason: string) {
    super(`Cannot rollback submission ${submissionId}: ${reason}`, 400, 'SCORE_ROLLBACK_NOT_ALLOWED');
  }
}

export class AntiCheatViolationError extends AppError {
  constructor(playerId: string, violationType: string, details?: unknown) {
    super(
      `Anti-cheat violation detected for player ${playerId}: ${violationType}`,
      403,
      'ANTI_CHEAT_VIOLATION',
      true,
      details
    );
  }
}

export class SuspiciousActivityError extends AppError {
  constructor(playerId: string, activityType: string) {
    super(
      `Suspicious activity detected for player ${playerId}: ${activityType}`,
      403,
      'SUSPICIOUS_ACTIVITY'
    );
  }
}

export class PlayerBannedError extends AppError {
  constructor(playerId: string, reason?: string) {
    const message = reason
      ? `Player ${playerId} is banned: ${reason}`
      : `Player ${playerId} is banned from leaderboards`;
    super(message, 403, 'PLAYER_BANNED');
  }
}

export class PlayerSuspendedError extends AppError {
  constructor(playerId: string, until: Date) {
    super(
      `Player ${playerId} is suspended until ${until.toISOString()}`,
      403,
      'PLAYER_SUSPENDED'
    );
  }
}

export class RankDecayActiveError extends AppError {
  constructor(playerId: string) {
    super(`Rank decay is active for player ${playerId}`, 400, 'RANK_DECAY_ACTIVE');
  }
}

export class RankDecayProtectedError extends AppError {
  constructor(playerId: string) {
    super(`Player ${playerId} is protected from rank decay`, 400, 'RANK_DECAY_PROTECTED');
  }
}

export class PlacementNotCompletedError extends AppError {
  constructor(playerId: string) {
    super(`Player ${playerId} has not completed placement matches`, 400, 'PLACEMENT_NOT_COMPLETED');
  }
}

export class SeasonNotActiveError extends AppError {
  constructor(seasonId: string) {
    super(`Season ${seasonId} is not active`, 400, 'SEASON_NOT_ACTIVE');
  }
}

export class SeasonEndedError extends AppError {
  constructor(seasonId: string) {
    super(`Season ${seasonId} has ended`, 400, 'SEASON_ENDED');
  }
}

export class RegionNotSupportedError extends AppError {
  constructor(region: string) {
    super(`Region ${region} is not supported`, 400, 'REGION_NOT_SUPPORTED');
  }
}

export class RegionMismatchError extends AppError {
  constructor(playerRegion: string, leaderboardRegion: string) {
    super(
      `Player region ${playerRegion} does not match leaderboard region ${leaderboardRegion}`,
      400,
      'REGION_MISMATCH'
    );
  }
}

export class FriendshipNotFoundError extends AppError {
  constructor(playerId: string, friendId: string) {
    super(`Friendship between ${playerId} and ${friendId} not found`, 404, 'FRIENDSHIP_NOT_FOUND');
  }
}

export class NotFriendsError extends AppError {
  constructor(playerId: string, targetId: string) {
    super(`Players ${playerId} and ${targetId} are not friends`, 400, 'NOT_FRIENDS');
  }
}

export class FriendGroupFullError extends AppError {
  constructor(groupId: string) {
    super(`Friend group ${groupId} is full`, 400, 'FRIEND_GROUP_FULL');
  }
}

export class FriendGroupPermissionError extends AppError {
  constructor(playerId: string, groupId: string) {
    super(`Player ${playerId} does not have permission to access group ${groupId}`, 403, 'FRIEND_GROUP_PERMISSION');
  }
}

export class ChallengeAlreadyExistsError extends AppError {
  constructor(challengerId: string, challengedId: string) {
    super(
      `An active challenge already exists between ${challengerId} and ${challengedId}`,
      409,
      'CHALLENGE_ALREADY_EXISTS'
    );
  }
}

export class ChallengeExpiredError extends AppError {
  constructor(challengeId: string) {
    super(`Challenge ${challengeId} has expired`, 400, 'CHALLENGE_EXPIRED');
  }
}

export class ChallengeNotActiveError extends AppError {
  constructor(challengeId: string) {
    super(`Challenge ${challengeId} is not active`, 400, 'CHALLENGE_NOT_ACTIVE');
  }
}

export class CannotChallengeSelfError extends AppError {
  constructor() {
    super('Cannot challenge yourself', 400, 'CANNOT_CHALLENGE_SELF');
  }
}

export class WebSocketConnectionError extends AppError {
  constructor(reason: string) {
    super(`WebSocket connection error: ${reason}`, 400, 'WEBSOCKET_CONNECTION_ERROR');
  }
}

export class WebSocketSubscriptionLimitError extends AppError {
  constructor(limit: number) {
    super(`Maximum subscription limit of ${limit} reached`, 400, 'WEBSOCKET_SUBSCRIPTION_LIMIT');
  }
}

export class WebSocketAuthenticationError extends AppError {
  constructor() {
    super('WebSocket authentication failed', 401, 'WEBSOCKET_AUTH_FAILED');
  }
}

export class CacheError extends AppError {
  constructor(operation: string, details?: unknown) {
    super(`Cache operation failed: ${operation}`, 500, 'CACHE_ERROR', false, details);
  }
}

export class CacheInvalidationError extends AppError {
  constructor(key: string) {
    super(`Failed to invalidate cache for key: ${key}`, 500, 'CACHE_INVALIDATION_ERROR', false);
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, details?: unknown) {
    super(`Database operation failed: ${operation}`, 500, 'DATABASE_ERROR', false, details);
  }
}

export class QueryTimeoutError extends AppError {
  constructor(queryType: string, timeout: number) {
    super(`Query ${queryType} timed out after ${timeout}ms`, 504, 'QUERY_TIMEOUT');
  }
}

export class InvalidPaginationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'INVALID_PAGINATION');
  }
}

export class InvalidSortFieldError extends AppError {
  constructor(field: string) {
    super(`Invalid sort field: ${field}`, 400, 'INVALID_SORT_FIELD');
  }
}

export class InvalidFilterError extends AppError {
  constructor(filter: string, reason: string) {
    super(`Invalid filter ${filter}: ${reason}`, 400, 'INVALID_FILTER');
  }
}

export class InvalidDateRangeError extends AppError {
  constructor(startDate: Date, endDate: Date) {
    super(
      `Invalid date range: start ${startDate.toISOString()} must be before end ${endDate.toISOString()}`,
      400,
      'INVALID_DATE_RANGE'
    );
  }
}

export class BatchOperationError extends AppError {
  public readonly failedItems: { index: number; error: string }[];

  constructor(message: string, failedItems: { index: number; error: string }[]) {
    super(message, 400, 'BATCH_OPERATION_ERROR', true, { failedItems });
    this.failedItems = failedItems;
  }
}

export class BatchSizeLimitError extends AppError {
  constructor(size: number, limit: number) {
    super(`Batch size ${size} exceeds limit of ${limit}`, 400, 'BATCH_SIZE_LIMIT');
  }
}

export class ConcurrencyError extends AppError {
  constructor(resource: string) {
    super(`Concurrent modification detected for ${resource}`, 409, 'CONCURRENCY_ERROR');
  }
}

export class VersionMismatchError extends AppError {
  constructor(expected: number, actual: number) {
    super(`Version mismatch: expected ${expected}, got ${actual}`, 409, 'VERSION_MISMATCH');
  }
}

export class MaintenanceModeError extends AppError {
  constructor(estimatedEndTime?: Date) {
    const message = estimatedEndTime
      ? `System is under maintenance until ${estimatedEndTime.toISOString()}`
      : 'System is under maintenance';
    super(message, 503, 'MAINTENANCE_MODE');
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature: string) {
    super(`Feature ${feature} is currently disabled`, 503, 'FEATURE_DISABLED');
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function handleError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message);
  }

  return new InternalServerError('An unexpected error occurred');
}

export const ErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  LEADERBOARD_INACTIVE: 'LEADERBOARD_INACTIVE',
  LEADERBOARD_FULL: 'LEADERBOARD_FULL',
  LEADERBOARD_PRIVATE: 'LEADERBOARD_PRIVATE',
  LEADERBOARD_LOCKED: 'LEADERBOARD_LOCKED',
  LEADERBOARD_RESET_IN_PROGRESS: 'LEADERBOARD_RESET_IN_PROGRESS',
  INVALID_SCORE: 'INVALID_SCORE',
  SCORE_VALIDATION_FAILED: 'SCORE_VALIDATION_FAILED',
  SCORE_CHECKSUM_MISMATCH: 'SCORE_CHECKSUM_MISMATCH',
  SCORE_ALREADY_SUBMITTED: 'SCORE_ALREADY_SUBMITTED',
  SCORE_SUBMISSION_EXPIRED: 'SCORE_SUBMISSION_EXPIRED',
  SCORE_SUBMISSION_PENDING: 'SCORE_SUBMISSION_PENDING',
  SCORE_SUBMISSION_REJECTED: 'SCORE_SUBMISSION_REJECTED',
  SCORE_DISPUTE_EXISTS: 'SCORE_DISPUTE_EXISTS',
  SCORE_DISPUTE_NOT_ALLOWED: 'SCORE_DISPUTE_NOT_ALLOWED',
  SCORE_ROLLBACK_NOT_ALLOWED: 'SCORE_ROLLBACK_NOT_ALLOWED',
  ANTI_CHEAT_VIOLATION: 'ANTI_CHEAT_VIOLATION',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  PLAYER_BANNED: 'PLAYER_BANNED',
  PLAYER_SUSPENDED: 'PLAYER_SUSPENDED',
  RANK_DECAY_ACTIVE: 'RANK_DECAY_ACTIVE',
  RANK_DECAY_PROTECTED: 'RANK_DECAY_PROTECTED',
  PLACEMENT_NOT_COMPLETED: 'PLACEMENT_NOT_COMPLETED',
  SEASON_NOT_ACTIVE: 'SEASON_NOT_ACTIVE',
  SEASON_ENDED: 'SEASON_ENDED',
  REGION_NOT_SUPPORTED: 'REGION_NOT_SUPPORTED',
  REGION_MISMATCH: 'REGION_MISMATCH',
  FRIENDSHIP_NOT_FOUND: 'FRIENDSHIP_NOT_FOUND',
  NOT_FRIENDS: 'NOT_FRIENDS',
  FRIEND_GROUP_FULL: 'FRIEND_GROUP_FULL',
  FRIEND_GROUP_PERMISSION: 'FRIEND_GROUP_PERMISSION',
  CHALLENGE_ALREADY_EXISTS: 'CHALLENGE_ALREADY_EXISTS',
  CHALLENGE_EXPIRED: 'CHALLENGE_EXPIRED',
  CHALLENGE_NOT_ACTIVE: 'CHALLENGE_NOT_ACTIVE',
  CANNOT_CHALLENGE_SELF: 'CANNOT_CHALLENGE_SELF',
  WEBSOCKET_CONNECTION_ERROR: 'WEBSOCKET_CONNECTION_ERROR',
  WEBSOCKET_SUBSCRIPTION_LIMIT: 'WEBSOCKET_SUBSCRIPTION_LIMIT',
  WEBSOCKET_AUTH_FAILED: 'WEBSOCKET_AUTH_FAILED',
  CACHE_ERROR: 'CACHE_ERROR',
  CACHE_INVALIDATION_ERROR: 'CACHE_INVALIDATION_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_TIMEOUT: 'QUERY_TIMEOUT',
  INVALID_PAGINATION: 'INVALID_PAGINATION',
  INVALID_SORT_FIELD: 'INVALID_SORT_FIELD',
  INVALID_FILTER: 'INVALID_FILTER',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  BATCH_OPERATION_ERROR: 'BATCH_OPERATION_ERROR',
  BATCH_SIZE_LIMIT: 'BATCH_SIZE_LIMIT',
  CONCURRENCY_ERROR: 'CONCURRENCY_ERROR',
  VERSION_MISMATCH: 'VERSION_MISMATCH',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
