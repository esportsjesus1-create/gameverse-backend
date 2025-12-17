import { Request, Response, NextFunction } from 'express';
import {
  validateCreateSession,
  validateUpdateStats,
  validateReconnect,
  validateUUID,
} from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = { body: {}, params: {} };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('validateCreateSession', () => {
    it('should pass validation with valid request', () => {
      mockReq.body = {
        gameType: 'battle-royale',
        players: [
          { playerId: 'p1', playerName: 'Player One' },
          { playerId: 'p2', playerName: 'Player Two' },
        ],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error when gameType is missing', () => {
      mockReq.body = {
        players: [{ playerId: 'p1', playerName: 'Player One' }],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when gameType is not a string', () => {
      mockReq.body = {
        gameType: 123,
        players: [{ playerId: 'p1', playerName: 'Player One' }],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when players array is empty', () => {
      mockReq.body = {
        gameType: 'battle-royale',
        players: [],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when players is not an array', () => {
      mockReq.body = {
        gameType: 'battle-royale',
        players: 'not-an-array',
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when player is missing playerId', () => {
      mockReq.body = {
        gameType: 'battle-royale',
        players: [{ playerName: 'Player One' }],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when player is missing playerName', () => {
      mockReq.body = {
        gameType: 'battle-royale',
        players: [{ playerId: 'p1' }],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should pass with optional teamId', () => {
      mockReq.body = {
        gameType: 'battle-royale',
        players: [
          { playerId: 'p1', playerName: 'Player One', teamId: 'team-1' },
        ],
      };

      expect(() => {
        validateCreateSession(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateUpdateStats', () => {
    it('should pass validation with valid numeric stats', () => {
      mockReq.body = {
        kills: 5,
        deaths: 2,
        assists: 3,
        damageDealt: 1000,
        damageReceived: 500,
        objectivesCompleted: 1,
      };

      expect(() => {
        validateUpdateStats(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass validation with empty body', () => {
      mockReq.body = {};

      expect(() => {
        validateUpdateStats(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error when kills is not a number', () => {
      mockReq.body = { kills: 'five' };

      expect(() => {
        validateUpdateStats(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when damageDealt is not a number', () => {
      mockReq.body = { damageDealt: '1000' };

      expect(() => {
        validateUpdateStats(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should pass with customStats object', () => {
      mockReq.body = {
        customStats: { headshots: 10, accuracy: 75 },
      };

      expect(() => {
        validateUpdateStats(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error when customStats is not an object', () => {
      mockReq.body = { customStats: 'invalid' };

      expect(() => {
        validateUpdateStats(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });
  });

  describe('validateReconnect', () => {
    it('should pass validation with valid token and playerId', () => {
      mockReq.body = {
        token: 'abc123def456',
        playerId: 'player-1',
      };

      expect(() => {
        validateReconnect(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error when token is missing', () => {
      mockReq.body = { playerId: 'player-1' };

      expect(() => {
        validateReconnect(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when playerId is missing', () => {
      mockReq.body = { token: 'abc123' };

      expect(() => {
        validateReconnect(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when token is not a string', () => {
      mockReq.body = { token: 123, playerId: 'player-1' };

      expect(() => {
        validateReconnect(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });
  });

  describe('validateUUID', () => {
    it('should pass validation with valid UUID', () => {
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const validator = validateUUID('id');

      expect(() => {
        validator(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should throw error with invalid UUID format', () => {
      mockReq.params = { id: 'not-a-valid-uuid' };
      const validator = validateUUID('id');

      expect(() => {
        validator(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should throw error when UUID param is missing', () => {
      mockReq.params = {};
      const validator = validateUUID('id');

      expect(() => {
        validator(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AppError);
    });

    it('should validate different param names', () => {
      mockReq.params = { sessionId: '550e8400-e29b-41d4-a716-446655440000' };
      const validator = validateUUID('sessionId');

      expect(() => {
        validator(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
