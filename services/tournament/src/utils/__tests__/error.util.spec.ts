import { HttpStatus } from '@nestjs/common';
import {
  TournamentErrorCode,
  TournamentException,
  TournamentErrors,
  withErrorHandling,
  assertCondition,
} from '../error.util';

describe('Error Utilities', () => {
  describe('TournamentException', () => {
    it('should create exception with all properties', () => {
      const exception = new TournamentException(
        TournamentErrorCode.TOURNAMENT_NOT_FOUND,
        'Tournament not found',
        HttpStatus.NOT_FOUND,
        { tournamentId: '123' },
      );

      expect(exception.errorCode).toBe(TournamentErrorCode.TOURNAMENT_NOT_FOUND);
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
      expect(exception.metadata).toEqual({ tournamentId: '123' });
    });

    it('should default to BAD_REQUEST status', () => {
      const exception = new TournamentException(
        TournamentErrorCode.VALIDATION_ERROR,
        'Validation failed',
      );

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });

    it('should include timestamp in response', () => {
      const exception = new TournamentException(
        TournamentErrorCode.TOURNAMENT_NOT_FOUND,
        'Not found',
      );

      const response = exception.getResponse() as any;
      expect(response.timestamp).toBeDefined();
    });
  });

  describe('TournamentErrors factory', () => {
    describe('tournamentNotFound', () => {
      it('should create NOT_FOUND exception', () => {
        const error = TournamentErrors.tournamentNotFound('123');
        expect(error.errorCode).toBe(TournamentErrorCode.TOURNAMENT_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(error.metadata).toEqual({ tournamentId: '123' });
      });
    });

    describe('tournamentInvalidStatus', () => {
      it('should create exception with single expected status', () => {
        const error = TournamentErrors.tournamentInvalidStatus('DRAFT', 'IN_PROGRESS');
        expect(error.errorCode).toBe(TournamentErrorCode.TOURNAMENT_INVALID_STATUS);
        expect(error.metadata).toEqual({
          currentStatus: 'DRAFT',
          expectedStatus: 'IN_PROGRESS',
        });
      });

      it('should create exception with multiple expected statuses', () => {
        const error = TournamentErrors.tournamentInvalidStatus('DRAFT', [
          'IN_PROGRESS',
          'COMPLETED',
        ]);
        expect(error.metadata?.expectedStatus).toEqual(['IN_PROGRESS', 'COMPLETED']);
      });
    });

    describe('tournamentInvalidTransition', () => {
      it('should create exception with transition details', () => {
        const error = TournamentErrors.tournamentInvalidTransition('DRAFT', 'COMPLETED');
        expect(error.errorCode).toBe(TournamentErrorCode.TOURNAMENT_INVALID_TRANSITION);
        expect(error.metadata).toEqual({
          fromStatus: 'DRAFT',
          toStatus: 'COMPLETED',
        });
      });
    });

    describe('tournamentAlreadyStarted', () => {
      it('should create exception', () => {
        const error = TournamentErrors.tournamentAlreadyStarted('123');
        expect(error.errorCode).toBe(TournamentErrorCode.TOURNAMENT_ALREADY_STARTED);
      });
    });

    describe('tournamentAlreadyCompleted', () => {
      it('should create exception', () => {
        const error = TournamentErrors.tournamentAlreadyCompleted('123');
        expect(error.errorCode).toBe(TournamentErrorCode.TOURNAMENT_ALREADY_COMPLETED);
      });
    });

    describe('tournamentCancelled', () => {
      it('should create exception', () => {
        const error = TournamentErrors.tournamentCancelled('123');
        expect(error.errorCode).toBe(TournamentErrorCode.TOURNAMENT_CANCELLED);
      });
    });

    describe('registrationNotFound', () => {
      it('should create NOT_FOUND exception', () => {
        const error = TournamentErrors.registrationNotFound('reg-123');
        expect(error.errorCode).toBe(TournamentErrorCode.REGISTRATION_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      });
    });

    describe('registrationClosed', () => {
      it('should create exception', () => {
        const error = TournamentErrors.registrationClosed('123');
        expect(error.errorCode).toBe(TournamentErrorCode.REGISTRATION_CLOSED);
      });
    });

    describe('registrationFull', () => {
      it('should create exception with max participants', () => {
        const error = TournamentErrors.registrationFull('123', 16);
        expect(error.errorCode).toBe(TournamentErrorCode.REGISTRATION_FULL);
        expect(error.metadata).toEqual({ tournamentId: '123', maxParticipants: 16 });
      });
    });

    describe('registrationDuplicate', () => {
      it('should create CONFLICT exception', () => {
        const error = TournamentErrors.registrationDuplicate('player-123', 'tournament-123');
        expect(error.errorCode).toBe(TournamentErrorCode.REGISTRATION_DUPLICATE);
        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      });
    });

    describe('registrationRequirementsNotMet', () => {
      it('should create exception with errors list', () => {
        const errors = ['MMR too low', 'Region not allowed'];
        const error = TournamentErrors.registrationRequirementsNotMet(errors);
        expect(error.errorCode).toBe(TournamentErrorCode.REGISTRATION_REQUIREMENTS_NOT_MET);
        expect(error.metadata).toEqual({ errors });
      });
    });

    describe('bracketNotFound', () => {
      it('should create NOT_FOUND exception', () => {
        const error = TournamentErrors.bracketNotFound('bracket-123');
        expect(error.errorCode).toBe(TournamentErrorCode.BRACKET_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      });
    });

    describe('bracketAlreadyExists', () => {
      it('should create CONFLICT exception', () => {
        const error = TournamentErrors.bracketAlreadyExists('123');
        expect(error.errorCode).toBe(TournamentErrorCode.BRACKET_ALREADY_EXISTS);
        expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      });
    });

    describe('bracketInsufficientParticipants', () => {
      it('should create exception with counts', () => {
        const error = TournamentErrors.bracketInsufficientParticipants(1, 2);
        expect(error.errorCode).toBe(TournamentErrorCode.BRACKET_INSUFFICIENT_PARTICIPANTS);
        expect(error.metadata).toEqual({ count: 1, minimum: 2 });
      });
    });

    describe('matchNotFound', () => {
      it('should create NOT_FOUND exception', () => {
        const error = TournamentErrors.matchNotFound('match-123');
        expect(error.errorCode).toBe(TournamentErrorCode.MATCH_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      });
    });

    describe('matchInvalidStatus', () => {
      it('should create exception', () => {
        const error = TournamentErrors.matchInvalidStatus('SCHEDULED', 'IN_PROGRESS');
        expect(error.errorCode).toBe(TournamentErrorCode.MATCH_INVALID_STATUS);
      });
    });

    describe('matchInvalidResult', () => {
      it('should create exception with reason', () => {
        const error = TournamentErrors.matchInvalidResult('Score mismatch');
        expect(error.errorCode).toBe(TournamentErrorCode.MATCH_INVALID_RESULT);
        expect(error.metadata).toEqual({ reason: 'Score mismatch' });
      });
    });

    describe('matchAlreadyCompleted', () => {
      it('should create exception', () => {
        const error = TournamentErrors.matchAlreadyCompleted('match-123');
        expect(error.errorCode).toBe(TournamentErrorCode.MATCH_ALREADY_COMPLETED);
      });
    });

    describe('participantNotInMatch', () => {
      it('should create exception', () => {
        const error = TournamentErrors.participantNotInMatch('player-123', 'match-123');
        expect(error.errorCode).toBe(TournamentErrorCode.PARTICIPANT_NOT_IN_MATCH);
      });
    });

    describe('prizeNotFound', () => {
      it('should create NOT_FOUND exception', () => {
        const error = TournamentErrors.prizeNotFound('prize-123');
        expect(error.errorCode).toBe(TournamentErrorCode.PRIZE_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      });
    });

    describe('prizeAlreadyDistributed', () => {
      it('should create exception', () => {
        const error = TournamentErrors.prizeAlreadyDistributed('prize-123');
        expect(error.errorCode).toBe(TournamentErrorCode.PRIZE_ALREADY_DISTRIBUTED);
      });
    });

    describe('standingNotFound', () => {
      it('should create NOT_FOUND exception', () => {
        const error = TournamentErrors.standingNotFound('player-123', 'tournament-123');
        expect(error.errorCode).toBe(TournamentErrorCode.STANDING_NOT_FOUND);
        expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
      });
    });

    describe('validationError', () => {
      it('should create exception with details', () => {
        const error = TournamentErrors.validationError('Invalid input', { field: 'name' });
        expect(error.errorCode).toBe(TournamentErrorCode.VALIDATION_ERROR);
        expect(error.metadata).toEqual({ field: 'name' });
      });
    });

    describe('unauthorized', () => {
      it('should create UNAUTHORIZED exception', () => {
        const error = TournamentErrors.unauthorized();
        expect(error.errorCode).toBe(TournamentErrorCode.UNAUTHORIZED);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      });

      it('should accept custom message', () => {
        const error = TournamentErrors.unauthorized('Token expired');
        const response = error.getResponse() as any;
        expect(response.message).toBe('Token expired');
      });
    });

    describe('forbidden', () => {
      it('should create FORBIDDEN exception', () => {
        const error = TournamentErrors.forbidden();
        expect(error.errorCode).toBe(TournamentErrorCode.FORBIDDEN);
        expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      });
    });

    describe('rateLimitExceeded', () => {
      it('should create TOO_MANY_REQUESTS exception', () => {
        const error = TournamentErrors.rateLimitExceeded(10, 60000);
        expect(error.errorCode).toBe(TournamentErrorCode.RATE_LIMIT_EXCEEDED);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.metadata).toEqual({ limit: 10, windowMs: 60000 });
      });
    });

    describe('internalError', () => {
      it('should create INTERNAL_SERVER_ERROR exception', () => {
        const error = TournamentErrors.internalError();
        expect(error.errorCode).toBe(TournamentErrorCode.INTERNAL_ERROR);
        expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      });

      it('should accept custom message', () => {
        const error = TournamentErrors.internalError('Database connection failed');
        const response = error.getResponse() as any;
        expect(response.message).toBe('Database connection failed');
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should return result on success', async () => {
      const result = await withErrorHandling(async () => 'success');
      expect(result).toBe('success');
    });

    it('should rethrow TournamentException', async () => {
      const tournamentError = TournamentErrors.tournamentNotFound('123');
      await expect(
        withErrorHandling(async () => {
          throw tournamentError;
        }),
      ).rejects.toThrow(tournamentError);
    });

    it('should use error mapper when provided', async () => {
      const mapper = (error: Error) =>
        TournamentErrors.validationError(error.message);

      await expect(
        withErrorHandling(
          async () => {
            throw new Error('Custom error');
          },
          mapper,
        ),
      ).rejects.toThrow(TournamentException);
    });

    it('should wrap unknown errors as internal error', async () => {
      await expect(
        withErrorHandling(async () => {
          throw new Error('Unknown error');
        }),
      ).rejects.toThrow(TournamentException);
    });
  });

  describe('assertCondition', () => {
    it('should not throw when condition is true', () => {
      expect(() =>
        assertCondition(true, () => TournamentErrors.validationError('Error')),
      ).not.toThrow();
    });

    it('should throw when condition is false', () => {
      expect(() =>
        assertCondition(false, () => TournamentErrors.validationError('Error')),
      ).toThrow(TournamentException);
    });
  });
});
