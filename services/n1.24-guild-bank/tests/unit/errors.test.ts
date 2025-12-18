import {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  InsufficientFundsError,
  WithdrawalLimitExceededError,
  ApprovalRequiredError,
  CooldownActiveError,
  DuplicateApprovalError,
  SelfApprovalError,
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create an AppError with correct properties', () => {
      const error = new AppError('Test error', 500);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should allow setting isOperational to false', () => {
      const error = new AppError('Critical error', 500, false);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should create a NotFoundError with resource name', () => {
      const error = new NotFoundError('User');
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create an UnauthorizedError with default message', () => {
      const error = new UnauthorizedError();
      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
    });

    it('should create an UnauthorizedError with custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('should create a ForbiddenError with default message', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });

    it('should create a ForbiddenError with custom message', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.message).toBe('Access denied');
    });
  });

  describe('InsufficientFundsError', () => {
    it('should create an InsufficientFundsError', () => {
      const error = new InsufficientFundsError();
      expect(error.message).toBe('Insufficient funds in vault');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('WithdrawalLimitExceededError', () => {
    it('should create a daily limit error', () => {
      const error = new WithdrawalLimitExceededError('daily');
      expect(error.message).toBe('Daily withdrawal limit exceeded');
      expect(error.statusCode).toBe(400);
    });

    it('should create a single transaction limit error', () => {
      const error = new WithdrawalLimitExceededError('single');
      expect(error.message).toBe('Single transaction withdrawal limit exceeded');
    });
  });

  describe('ApprovalRequiredError', () => {
    it('should create an ApprovalRequiredError', () => {
      const error = new ApprovalRequiredError(3, 1);
      expect(error.message).toBe('Approval required: 1/3 approvals received');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('CooldownActiveError', () => {
    it('should create a CooldownActiveError', () => {
      const error = new CooldownActiveError(30);
      expect(error.message).toBe('Withdrawal cooldown active. Please wait 30 minutes');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('DuplicateApprovalError', () => {
    it('should create a DuplicateApprovalError', () => {
      const error = new DuplicateApprovalError();
      expect(error.message).toBe('You have already submitted an approval for this transaction');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('SelfApprovalError', () => {
    it('should create a SelfApprovalError', () => {
      const error = new SelfApprovalError();
      expect(error.message).toBe('You cannot approve your own transaction');
      expect(error.statusCode).toBe(400);
    });
  });
});
