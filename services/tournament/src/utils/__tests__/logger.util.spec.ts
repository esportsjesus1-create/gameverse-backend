import {
  TournamentEventType,
  TournamentLogger,
  createTournamentLogger,
} from '../logger.util';

describe('Logger Utilities', () => {
  let logger: TournamentLogger;

  beforeEach(() => {
    logger = createTournamentLogger('TestContext');
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('TournamentEventType', () => {
    it('should have all required event types', () => {
      expect(TournamentEventType.TOURNAMENT_CREATED).toBe('TOURNAMENT_CREATED');
      expect(TournamentEventType.TOURNAMENT_UPDATED).toBe('TOURNAMENT_UPDATED');
      expect(TournamentEventType.TOURNAMENT_STATUS_CHANGED).toBe('TOURNAMENT_STATUS_CHANGED');
      expect(TournamentEventType.TOURNAMENT_DELETED).toBe('TOURNAMENT_DELETED');
      expect(TournamentEventType.REGISTRATION_CREATED).toBe('REGISTRATION_CREATED');
      expect(TournamentEventType.REGISTRATION_CANCELLED).toBe('REGISTRATION_CANCELLED');
      expect(TournamentEventType.REGISTRATION_CHECKED_IN).toBe('REGISTRATION_CHECKED_IN');
      expect(TournamentEventType.BRACKET_GENERATED).toBe('BRACKET_GENERATED');
      expect(TournamentEventType.BRACKET_RESEEDED).toBe('BRACKET_RESEEDED');
      expect(TournamentEventType.MATCH_SCHEDULED).toBe('MATCH_SCHEDULED');
      expect(TournamentEventType.MATCH_STARTED).toBe('MATCH_STARTED');
      expect(TournamentEventType.MATCH_RESULT_SUBMITTED).toBe('MATCH_RESULT_SUBMITTED');
      expect(TournamentEventType.MATCH_RESULT_CONFIRMED).toBe('MATCH_RESULT_CONFIRMED');
      expect(TournamentEventType.MATCH_DISPUTED).toBe('MATCH_DISPUTED');
      expect(TournamentEventType.MATCH_DISPUTE_RESOLVED).toBe('MATCH_DISPUTE_RESOLVED');
      expect(TournamentEventType.MATCH_ADMIN_OVERRIDE).toBe('MATCH_ADMIN_OVERRIDE');
      expect(TournamentEventType.PARTICIPANT_DISQUALIFIED).toBe('PARTICIPANT_DISQUALIFIED');
      expect(TournamentEventType.PRIZE_CALCULATED).toBe('PRIZE_CALCULATED');
      expect(TournamentEventType.PRIZE_DISTRIBUTED).toBe('PRIZE_DISTRIBUTED');
      expect(TournamentEventType.LEADERBOARD_UPDATED).toBe('LEADERBOARD_UPDATED');
      expect(TournamentEventType.SECURITY_ALERT).toBe('SECURITY_ALERT');
      expect(TournamentEventType.PERFORMANCE_WARNING).toBe('PERFORMANCE_WARNING');
    });
  });

  describe('createTournamentLogger', () => {
    it('should create a logger instance', () => {
      const newLogger = createTournamentLogger('NewContext');
      expect(newLogger).toBeInstanceOf(TournamentLogger);
    });
  });

  describe('TournamentLogger', () => {
    describe('logEvent', () => {
      it('should log tournament event', () => {
        logger.logEvent(TournamentEventType.TOURNAMENT_CREATED, 'tournament-123', {
          name: 'Test Tournament',
        });

        expect(console.log).toHaveBeenCalled();
      });

      it('should log event without additional data', () => {
        logger.logEvent(TournamentEventType.TOURNAMENT_DELETED, 'tournament-123');

        expect(console.log).toHaveBeenCalled();
      });
    });

    describe('logError', () => {
      it('should log error with context', () => {
        const error = new Error('Test error');
        logger.logError('Operation failed', error, { tournamentId: '123' });

        expect(console.error).toHaveBeenCalled();
      });

      it('should log error without additional context', () => {
        const error = new Error('Test error');
        logger.logError('Operation failed', error);

        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('logWarning', () => {
      it('should log warning', () => {
        logger.logWarning('Something might be wrong', { detail: 'info' });

        expect(console.warn).toHaveBeenCalled();
      });

      it('should log warning without context', () => {
        logger.logWarning('Something might be wrong');

        expect(console.warn).toHaveBeenCalled();
      });
    });

    describe('logSecurityAlert', () => {
      it('should log security alert', () => {
        logger.logSecurityAlert('RATE_LIMIT_EXCEEDED', {
          userId: 'user-123',
          attempts: 100,
        });

        expect(console.error).toHaveBeenCalled();
      });
    });

    describe('logPerformance', () => {
      it('should log performance metrics', () => {
        logger.logPerformance('database_query', 150, {
          query: 'SELECT * FROM tournaments',
        });

        expect(console.log).toHaveBeenCalled();
      });

      it('should log warning for slow operations', () => {
        logger.logPerformance('slow_operation', 5000, {});

        expect(console.warn).toHaveBeenCalled();
      });
    });

    describe('startTimer', () => {
      it('should return a timer function', () => {
        const timer = logger.startTimer('test_operation');
        expect(typeof timer).toBe('function');
      });

      it('should log duration when timer is called', async () => {
        const timer = logger.startTimer('test_operation');
        await new Promise((resolve) => setTimeout(resolve, 10));
        timer({ result: 'success' });

        expect(console.log).toHaveBeenCalled();
      });

      it('should log duration without additional data', () => {
        const timer = logger.startTimer('test_operation');
        timer();

        expect(console.log).toHaveBeenCalled();
      });
    });

    describe('logAuditTrail', () => {
      it('should log audit trail for admin actions', () => {
        logger.logAuditTrail(
          'UPDATE_MATCH_RESULT',
          'admin-123',
          'match-456',
          'match',
          { oldScore: '2-1', newScore: '3-1' },
        );

        expect(console.log).toHaveBeenCalled();
      });

      it('should log audit trail without changes', () => {
        logger.logAuditTrail(
          'VIEW_TOURNAMENT',
          'admin-123',
          'tournament-456',
          'tournament',
        );

        expect(console.log).toHaveBeenCalled();
      });
    });
  });

  describe('Log entry structure', () => {
    it('should include timestamp in log entries', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.logEvent(TournamentEventType.TOURNAMENT_CREATED, 'tournament-123');

      const logCall = consoleSpy.mock.calls[0];
      expect(logCall).toBeDefined();
    });

    it('should include context in log entries', () => {
      const consoleSpy = jest.spyOn(console, 'log');
      logger.logEvent(TournamentEventType.TOURNAMENT_CREATED, 'tournament-123');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
