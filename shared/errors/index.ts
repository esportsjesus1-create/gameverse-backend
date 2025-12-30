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
  constructor(message: string, details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', true, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
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

export class PartyFullError extends AppError {
  constructor(partyId: string) {
    super(`Party ${partyId} is full`, 400, 'PARTY_FULL');
  }
}

export class PartyNotFoundError extends NotFoundError {
  constructor(partyId: string) {
    super('Party', partyId);
  }
}

export class UserNotInPartyError extends AppError {
  constructor(userId: string, partyId: string) {
    super(`User ${userId} is not a member of party ${partyId}`, 400, 'USER_NOT_IN_PARTY');
  }
}

export class UserAlreadyInPartyError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} is already in a party`, 400, 'USER_ALREADY_IN_PARTY');
  }
}

export class InviteExpiredError extends AppError {
  constructor(inviteId: string) {
    super(`Invite ${inviteId} has expired`, 400, 'INVITE_EXPIRED');
  }
}

export class InviteAlreadyRespondedError extends AppError {
  constructor(inviteId: string) {
    super(`Invite ${inviteId} has already been responded to`, 400, 'INVITE_ALREADY_RESPONDED');
  }
}

export class TournamentFullError extends AppError {
  constructor(tournamentId: string) {
    super(`Tournament ${tournamentId} is full`, 400, 'TOURNAMENT_FULL');
  }
}

export class TournamentNotFoundError extends NotFoundError {
  constructor(tournamentId: string) {
    super('Tournament', tournamentId);
  }
}

export class TournamentRegistrationClosedError extends AppError {
  constructor(tournamentId: string) {
    super(
      `Registration for tournament ${tournamentId} is closed`,
      400,
      'TOURNAMENT_REGISTRATION_CLOSED'
    );
  }
}

export class AlreadyRegisteredError extends AppError {
  constructor(resource: string, id: string) {
    super(`Already registered for ${resource} ${id}`, 400, 'ALREADY_REGISTERED');
  }
}

export class SeasonNotFoundError extends NotFoundError {
  constructor(seasonId: string) {
    super('Season', seasonId);
  }
}

export class SeasonNotActiveError extends AppError {
  constructor(seasonId: string) {
    super(`Season ${seasonId} is not active`, 400, 'SEASON_NOT_ACTIVE');
  }
}

export class PlacementNotCompletedError extends AppError {
  constructor(userId: string) {
    super(`User ${userId} has not completed placement matches`, 400, 'PLACEMENT_NOT_COMPLETED');
  }
}

export class FriendshipExistsError extends AppError {
  constructor(userId: string, friendId: string) {
    super(`Friendship already exists between ${userId} and ${friendId}`, 400, 'FRIENDSHIP_EXISTS');
  }
}

export class UserBlockedError extends AppError {
  constructor(userId: string, blockedUserId: string) {
    super(`User ${blockedUserId} is blocked by ${userId}`, 400, 'USER_BLOCKED');
  }
}

export class CannotBlockSelfError extends AppError {
  constructor() {
    super('Cannot block yourself', 400, 'CANNOT_BLOCK_SELF');
  }
}

export class CannotFriendSelfError extends AppError {
  constructor() {
    super('Cannot send friend request to yourself', 400, 'CANNOT_FRIEND_SELF');
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
