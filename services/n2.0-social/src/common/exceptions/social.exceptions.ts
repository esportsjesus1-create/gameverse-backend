import { HttpException, HttpStatus } from '@nestjs/common';

export enum SocialErrorCode {
  FRIEND_REQUEST_SELF = 'SOCIAL_001',
  FRIEND_REQUEST_BLOCKED = 'SOCIAL_002',
  FRIEND_REQUEST_NOT_FOUND = 'SOCIAL_003',
  FRIEND_REQUEST_ALREADY_PENDING = 'SOCIAL_004',
  FRIEND_REQUEST_ALREADY_FRIENDS = 'SOCIAL_005',
  FRIEND_REQUEST_NOT_ALLOWED = 'SOCIAL_006',
  FRIENDSHIP_NOT_FOUND = 'SOCIAL_007',
  BLOCK_SELF = 'SOCIAL_008',
  BLOCK_NOT_FOUND = 'SOCIAL_009',
  BLOCK_ALREADY_EXISTS = 'SOCIAL_010',
  PROFILE_NOT_FOUND = 'SOCIAL_011',
  PROFILE_ACCESS_DENIED = 'SOCIAL_012',
  PROFILE_ALREADY_EXISTS = 'SOCIAL_013',
  USERNAME_TAKEN = 'SOCIAL_014',
  NOTIFICATION_NOT_FOUND = 'SOCIAL_015',
  POST_NOT_FOUND = 'SOCIAL_016',
  POST_ACCESS_DENIED = 'SOCIAL_017',
  COMMENT_NOT_FOUND = 'SOCIAL_018',
  LIKE_ALREADY_EXISTS = 'SOCIAL_019',
  LIKE_NOT_FOUND = 'SOCIAL_020',
  PRESENCE_UPDATE_FAILED = 'SOCIAL_021',
  RATE_LIMIT_EXCEEDED = 'SOCIAL_022',
  INVALID_INPUT = 'SOCIAL_023',
  PLATFORM_ALREADY_ADDED = 'SOCIAL_024',
  PLATFORM_NOT_FOUND = 'SOCIAL_025',
  NEO4J_CONNECTION_ERROR = 'SOCIAL_026',
  REDIS_CONNECTION_ERROR = 'SOCIAL_027',
  DATABASE_ERROR = 'SOCIAL_028',
}

export interface SocialExceptionResponse {
  statusCode: number;
  errorCode: SocialErrorCode;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export class SocialException extends HttpException {
  constructor(
    public readonly errorCode: SocialErrorCode,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
  ) {
    const response: SocialExceptionResponse = {
      statusCode,
      errorCode,
      message,
      timestamp: new Date().toISOString(),
      details,
    };
    super(response, statusCode);
  }
}

export class FriendRequestSelfException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.FRIEND_REQUEST_SELF,
      'Cannot send friend request to yourself',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FriendRequestBlockedException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.FRIEND_REQUEST_BLOCKED,
      'Cannot send friend request to this user due to block status',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class FriendRequestNotFoundException extends SocialException {
  constructor(requestId?: string) {
    super(
      SocialErrorCode.FRIEND_REQUEST_NOT_FOUND,
      'Friend request not found',
      HttpStatus.NOT_FOUND,
      requestId ? { requestId } : undefined,
    );
  }
}

export class FriendRequestAlreadyPendingException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.FRIEND_REQUEST_ALREADY_PENDING,
      'A friend request is already pending between these users',
      HttpStatus.CONFLICT,
    );
  }
}

export class AlreadyFriendsException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.FRIEND_REQUEST_ALREADY_FRIENDS,
      'Already friends with this user',
      HttpStatus.CONFLICT,
    );
  }
}

export class FriendRequestNotAllowedException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.FRIEND_REQUEST_NOT_ALLOWED,
      'User does not accept friend requests',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class FriendshipNotFoundException extends SocialException {
  constructor(userId1?: string, userId2?: string) {
    super(
      SocialErrorCode.FRIENDSHIP_NOT_FOUND,
      'Friendship not found',
      HttpStatus.NOT_FOUND,
      userId1 && userId2 ? { userId1, userId2 } : undefined,
    );
  }
}

export class BlockSelfException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.BLOCK_SELF,
      'Cannot block yourself',
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class BlockNotFoundException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.BLOCK_NOT_FOUND,
      'Block record not found',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BlockAlreadyExistsException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.BLOCK_ALREADY_EXISTS,
      'User is already blocked',
      HttpStatus.CONFLICT,
    );
  }
}

export class ProfileNotFoundException extends SocialException {
  constructor(userId?: string) {
    super(
      SocialErrorCode.PROFILE_NOT_FOUND,
      'Profile not found',
      HttpStatus.NOT_FOUND,
      userId ? { userId } : undefined,
    );
  }
}

export class ProfileAccessDeniedException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.PROFILE_ACCESS_DENIED,
      'Cannot view this profile',
      HttpStatus.FORBIDDEN,
    );
  }
}

export class ProfileAlreadyExistsException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.PROFILE_ALREADY_EXISTS,
      'Profile already exists for this user',
      HttpStatus.CONFLICT,
    );
  }
}

export class UsernameTakenException extends SocialException {
  constructor(username?: string) {
    super(
      SocialErrorCode.USERNAME_TAKEN,
      'Username already taken',
      HttpStatus.CONFLICT,
      username ? { username } : undefined,
    );
  }
}

export class NotificationNotFoundException extends SocialException {
  constructor(notificationId?: string) {
    super(
      SocialErrorCode.NOTIFICATION_NOT_FOUND,
      'Notification not found',
      HttpStatus.NOT_FOUND,
      notificationId ? { notificationId } : undefined,
    );
  }
}

export class PostNotFoundException extends SocialException {
  constructor(postId?: string) {
    super(
      SocialErrorCode.POST_NOT_FOUND,
      'Post not found',
      HttpStatus.NOT_FOUND,
      postId ? { postId } : undefined,
    );
  }
}

export class PostAccessDeniedException extends SocialException {
  constructor(action: string = 'access') {
    super(
      SocialErrorCode.POST_ACCESS_DENIED,
      `Cannot ${action} this post`,
      HttpStatus.FORBIDDEN,
    );
  }
}

export class CommentNotFoundException extends SocialException {
  constructor(commentId?: string) {
    super(
      SocialErrorCode.COMMENT_NOT_FOUND,
      'Comment not found',
      HttpStatus.NOT_FOUND,
      commentId ? { commentId } : undefined,
    );
  }
}

export class LikeAlreadyExistsException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.LIKE_ALREADY_EXISTS,
      'Already liked this post',
      HttpStatus.CONFLICT,
    );
  }
}

export class LikeNotFoundException extends SocialException {
  constructor() {
    super(
      SocialErrorCode.LIKE_NOT_FOUND,
      'Like not found',
      HttpStatus.NOT_FOUND,
    );
  }
}

export class PresenceUpdateFailedException extends SocialException {
  constructor(reason?: string) {
    super(
      SocialErrorCode.PRESENCE_UPDATE_FAILED,
      'Failed to update presence status',
      HttpStatus.INTERNAL_SERVER_ERROR,
      reason ? { reason } : undefined,
    );
  }
}

export class RateLimitExceededException extends SocialException {
  constructor(operation: string, retryAfterSeconds?: number) {
    super(
      SocialErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded for ${operation}. Please try again later.`,
      HttpStatus.TOO_MANY_REQUESTS,
      retryAfterSeconds ? { retryAfterSeconds } : undefined,
    );
  }
}

export class InvalidInputException extends SocialException {
  constructor(field: string, reason: string) {
    super(
      SocialErrorCode.INVALID_INPUT,
      `Invalid input for ${field}: ${reason}`,
      HttpStatus.BAD_REQUEST,
      { field, reason },
    );
  }
}

export class PlatformAlreadyAddedException extends SocialException {
  constructor(platform?: string) {
    super(
      SocialErrorCode.PLATFORM_ALREADY_ADDED,
      'Platform already added',
      HttpStatus.CONFLICT,
      platform ? { platform } : undefined,
    );
  }
}

export class PlatformNotFoundException extends SocialException {
  constructor(platform?: string) {
    super(
      SocialErrorCode.PLATFORM_NOT_FOUND,
      'Platform not found',
      HttpStatus.NOT_FOUND,
      platform ? { platform } : undefined,
    );
  }
}

export class Neo4jConnectionException extends SocialException {
  constructor(operation?: string) {
    super(
      SocialErrorCode.NEO4J_CONNECTION_ERROR,
      'Failed to connect to graph database',
      HttpStatus.SERVICE_UNAVAILABLE,
      operation ? { operation } : undefined,
    );
  }
}

export class RedisConnectionException extends SocialException {
  constructor(operation?: string) {
    super(
      SocialErrorCode.REDIS_CONNECTION_ERROR,
      'Failed to connect to cache service',
      HttpStatus.SERVICE_UNAVAILABLE,
      operation ? { operation } : undefined,
    );
  }
}

export class DatabaseException extends SocialException {
  constructor(operation?: string) {
    super(
      SocialErrorCode.DATABASE_ERROR,
      'Database operation failed',
      HttpStatus.INTERNAL_SERVER_ERROR,
      operation ? { operation } : undefined,
    );
  }
}
