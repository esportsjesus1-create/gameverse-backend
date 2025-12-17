export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
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

export class QuestNotAvailableError extends AppError {
  constructor(questId: string, reason: string) {
    super(`Quest '${questId}' is not available: ${reason}`, 400, 'QUEST_NOT_AVAILABLE');
  }
}

export class QuestAlreadyAcceptedError extends AppError {
  constructor(questId: string) {
    super(`Quest '${questId}' has already been accepted`, 409, 'QUEST_ALREADY_ACCEPTED');
  }
}

export class QuestNotCompletedError extends AppError {
  constructor(questId: string) {
    super(`Quest '${questId}' is not completed yet`, 400, 'QUEST_NOT_COMPLETED');
  }
}

export class RewardAlreadyClaimedError extends AppError {
  constructor(questId: string) {
    super(`Rewards for quest '${questId}' have already been claimed`, 409, 'REWARD_ALREADY_CLAIMED');
  }
}
