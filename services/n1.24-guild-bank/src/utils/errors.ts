export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class InsufficientFundsError extends AppError {
  constructor() {
    super('Insufficient funds in vault', 400);
  }
}

export class WithdrawalLimitExceededError extends AppError {
  constructor(limitType: 'daily' | 'single') {
    super(`${limitType === 'daily' ? 'Daily' : 'Single transaction'} withdrawal limit exceeded`, 400);
  }
}

export class ApprovalRequiredError extends AppError {
  constructor(required: number, current: number) {
    super(`Approval required: ${current}/${required} approvals received`, 400);
  }
}

export class CooldownActiveError extends AppError {
  constructor(remainingMinutes: number) {
    super(`Withdrawal cooldown active. Please wait ${remainingMinutes} minutes`, 400);
  }
}

export class DuplicateApprovalError extends AppError {
  constructor() {
    super('You have already submitted an approval for this transaction', 400);
  }
}

export class SelfApprovalError extends AppError {
  constructor() {
    super('You cannot approve your own transaction', 400);
  }
}
