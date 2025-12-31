import {
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * Tournament-specific error codes for consistent error handling
 */
export enum TournamentErrorCode {
  TOURNAMENT_NOT_FOUND = 'TOURNAMENT_NOT_FOUND',
  TOURNAMENT_INVALID_STATUS = 'TOURNAMENT_INVALID_STATUS',
  TOURNAMENT_INVALID_TRANSITION = 'TOURNAMENT_INVALID_TRANSITION',
  TOURNAMENT_ALREADY_STARTED = 'TOURNAMENT_ALREADY_STARTED',
  TOURNAMENT_ALREADY_COMPLETED = 'TOURNAMENT_ALREADY_COMPLETED',
  TOURNAMENT_CANCELLED = 'TOURNAMENT_CANCELLED',
  REGISTRATION_NOT_FOUND = 'REGISTRATION_NOT_FOUND',
  REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
  REGISTRATION_FULL = 'REGISTRATION_FULL',
  REGISTRATION_DUPLICATE = 'REGISTRATION_DUPLICATE',
  REGISTRATION_INVALID_STATUS = 'REGISTRATION_INVALID_STATUS',
  REGISTRATION_REQUIREMENTS_NOT_MET = 'REGISTRATION_REQUIREMENTS_NOT_MET',
  BRACKET_NOT_FOUND = 'BRACKET_NOT_FOUND',
  BRACKET_ALREADY_EXISTS = 'BRACKET_ALREADY_EXISTS',
  BRACKET_INVALID_FORMAT = 'BRACKET_INVALID_FORMAT',
  BRACKET_INSUFFICIENT_PARTICIPANTS = 'BRACKET_INSUFFICIENT_PARTICIPANTS',
  MATCH_NOT_FOUND = 'MATCH_NOT_FOUND',
  MATCH_INVALID_STATUS = 'MATCH_INVALID_STATUS',
  MATCH_INVALID_RESULT = 'MATCH_INVALID_RESULT',
  MATCH_ALREADY_COMPLETED = 'MATCH_ALREADY_COMPLETED',
  MATCH_NOT_READY = 'MATCH_NOT_READY',
  PARTICIPANT_NOT_IN_MATCH = 'PARTICIPANT_NOT_IN_MATCH',
  PRIZE_NOT_FOUND = 'PRIZE_NOT_FOUND',
  PRIZE_ALREADY_DISTRIBUTED = 'PRIZE_ALREADY_DISTRIBUTED',
  PRIZE_INVALID_STATUS = 'PRIZE_INVALID_STATUS',
  STANDING_NOT_FOUND = 'STANDING_NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Tournament-specific exception with error code and metadata
 */
export class TournamentException extends HttpException {
  public readonly errorCode: TournamentErrorCode;
  public readonly metadata?: Record<string, unknown>;

  constructor(
    errorCode: TournamentErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    metadata?: Record<string, unknown>,
  ) {
    super(
      {
        statusCode: status,
        errorCode,
        message,
        metadata,
        timestamp: new Date().toISOString(),
      },
      status,
    );
    this.errorCode = errorCode;
    this.metadata = metadata;
  }
}

/**
 * Factory functions for common tournament errors
 */
export const TournamentErrors = {
  tournamentNotFound: (tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.TOURNAMENT_NOT_FOUND,
      `Tournament with ID ${tournamentId} not found`,
      HttpStatus.NOT_FOUND,
      { tournamentId },
    ),

  tournamentInvalidStatus: (currentStatus: string, expectedStatus: string | string[]) =>
    new TournamentException(
      TournamentErrorCode.TOURNAMENT_INVALID_STATUS,
      `Tournament is in ${currentStatus} status. Expected: ${Array.isArray(expectedStatus) ? expectedStatus.join(' or ') : expectedStatus}`,
      HttpStatus.BAD_REQUEST,
      { currentStatus, expectedStatus },
    ),

  tournamentInvalidTransition: (fromStatus: string, toStatus: string) =>
    new TournamentException(
      TournamentErrorCode.TOURNAMENT_INVALID_TRANSITION,
      `Cannot transition tournament from ${fromStatus} to ${toStatus}`,
      HttpStatus.BAD_REQUEST,
      { fromStatus, toStatus },
    ),

  tournamentAlreadyStarted: (tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.TOURNAMENT_ALREADY_STARTED,
      'Tournament has already started',
      HttpStatus.BAD_REQUEST,
      { tournamentId },
    ),

  tournamentAlreadyCompleted: (tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.TOURNAMENT_ALREADY_COMPLETED,
      'Tournament has already been completed',
      HttpStatus.BAD_REQUEST,
      { tournamentId },
    ),

  tournamentCancelled: (tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.TOURNAMENT_CANCELLED,
      'Tournament has been cancelled',
      HttpStatus.BAD_REQUEST,
      { tournamentId },
    ),

  registrationNotFound: (registrationId: string) =>
    new TournamentException(
      TournamentErrorCode.REGISTRATION_NOT_FOUND,
      `Registration with ID ${registrationId} not found`,
      HttpStatus.NOT_FOUND,
      { registrationId },
    ),

  registrationClosed: (tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.REGISTRATION_CLOSED,
      'Registration is not currently open for this tournament',
      HttpStatus.BAD_REQUEST,
      { tournamentId },
    ),

  registrationFull: (tournamentId: string, maxParticipants: number) =>
    new TournamentException(
      TournamentErrorCode.REGISTRATION_FULL,
      `Tournament has reached maximum capacity of ${maxParticipants} participants`,
      HttpStatus.BAD_REQUEST,
      { tournamentId, maxParticipants },
    ),

  registrationDuplicate: (participantId: string, tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.REGISTRATION_DUPLICATE,
      'Participant is already registered for this tournament',
      HttpStatus.CONFLICT,
      { participantId, tournamentId },
    ),

  registrationRequirementsNotMet: (errors: string[]) =>
    new TournamentException(
      TournamentErrorCode.REGISTRATION_REQUIREMENTS_NOT_MET,
      `Entry requirements not met: ${errors.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      { errors },
    ),

  bracketNotFound: (bracketId: string) =>
    new TournamentException(
      TournamentErrorCode.BRACKET_NOT_FOUND,
      `Bracket with ID ${bracketId} not found`,
      HttpStatus.NOT_FOUND,
      { bracketId },
    ),

  bracketAlreadyExists: (tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.BRACKET_ALREADY_EXISTS,
      'Bracket already exists for this tournament. Delete existing bracket first.',
      HttpStatus.CONFLICT,
      { tournamentId },
    ),

  bracketInsufficientParticipants: (count: number, minimum: number) =>
    new TournamentException(
      TournamentErrorCode.BRACKET_INSUFFICIENT_PARTICIPANTS,
      `At least ${minimum} participants are required to generate a bracket. Current: ${count}`,
      HttpStatus.BAD_REQUEST,
      { count, minimum },
    ),

  matchNotFound: (matchId: string) =>
    new TournamentException(
      TournamentErrorCode.MATCH_NOT_FOUND,
      `Match with ID ${matchId} not found`,
      HttpStatus.NOT_FOUND,
      { matchId },
    ),

  matchInvalidStatus: (currentStatus: string, expectedStatus: string | string[]) =>
    new TournamentException(
      TournamentErrorCode.MATCH_INVALID_STATUS,
      `Match is in ${currentStatus} status. Expected: ${Array.isArray(expectedStatus) ? expectedStatus.join(' or ') : expectedStatus}`,
      HttpStatus.BAD_REQUEST,
      { currentStatus, expectedStatus },
    ),

  matchInvalidResult: (reason: string) =>
    new TournamentException(
      TournamentErrorCode.MATCH_INVALID_RESULT,
      `Invalid match result: ${reason}`,
      HttpStatus.BAD_REQUEST,
      { reason },
    ),

  matchAlreadyCompleted: (matchId: string) =>
    new TournamentException(
      TournamentErrorCode.MATCH_ALREADY_COMPLETED,
      'Match has already been completed',
      HttpStatus.BAD_REQUEST,
      { matchId },
    ),

  participantNotInMatch: (participantId: string, matchId: string) =>
    new TournamentException(
      TournamentErrorCode.PARTICIPANT_NOT_IN_MATCH,
      'Participant is not part of this match',
      HttpStatus.BAD_REQUEST,
      { participantId, matchId },
    ),

  prizeNotFound: (prizeId: string) =>
    new TournamentException(
      TournamentErrorCode.PRIZE_NOT_FOUND,
      `Prize with ID ${prizeId} not found`,
      HttpStatus.NOT_FOUND,
      { prizeId },
    ),

  prizeAlreadyDistributed: (prizeId: string) =>
    new TournamentException(
      TournamentErrorCode.PRIZE_ALREADY_DISTRIBUTED,
      'Prize has already been distributed',
      HttpStatus.BAD_REQUEST,
      { prizeId },
    ),

  standingNotFound: (participantId: string, tournamentId: string) =>
    new TournamentException(
      TournamentErrorCode.STANDING_NOT_FOUND,
      'Participant not found in tournament standings',
      HttpStatus.NOT_FOUND,
      { participantId, tournamentId },
    ),

  validationError: (message: string, details?: Record<string, unknown>) =>
    new TournamentException(
      TournamentErrorCode.VALIDATION_ERROR,
      message,
      HttpStatus.BAD_REQUEST,
      details,
    ),

  unauthorized: (message = 'Unauthorized access') =>
    new TournamentException(
      TournamentErrorCode.UNAUTHORIZED,
      message,
      HttpStatus.UNAUTHORIZED,
    ),

  forbidden: (message = 'Access forbidden') =>
    new TournamentException(
      TournamentErrorCode.FORBIDDEN,
      message,
      HttpStatus.FORBIDDEN,
    ),

  rateLimitExceeded: (limit: number, windowMs: number) =>
    new TournamentException(
      TournamentErrorCode.RATE_LIMIT_EXCEEDED,
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs / 1000} seconds`,
      HttpStatus.TOO_MANY_REQUESTS,
      { limit, windowMs },
    ),

  internalError: (message = 'An internal error occurred') =>
    new TournamentException(
      TournamentErrorCode.INTERNAL_ERROR,
      message,
      HttpStatus.INTERNAL_SERVER_ERROR,
    ),
};

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorMapper?: (error: Error) => TournamentException,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TournamentException) {
      throw error;
    }
    if (error instanceof HttpException) {
      throw error;
    }
    if (errorMapper && error instanceof Error) {
      throw errorMapper(error);
    }
    throw TournamentErrors.internalError(
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}

/**
 * Assert condition or throw error
 */
export function assertCondition(
  condition: boolean,
  errorFactory: () => TournamentException,
): asserts condition {
  if (!condition) {
    throw errorFactory();
  }
}
