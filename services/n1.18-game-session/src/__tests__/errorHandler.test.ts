import { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler, asyncHandler } from '../middleware/errorHandler';

describe('Error Handler', () => {
  describe('AppError', () => {
    it('should create error with message and default status code', () => {
      const error = new AppError('Something went wrong');
      
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('AppError');
    });

    it('should create error with custom status code', () => {
      const error = new AppError('Not found', 404);
      
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('errorHandler middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let jsonMock: jest.Mock;
    let statusMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      statusMock = jest.fn().mockReturnValue({ json: jsonMock });
      mockReq = {};
      mockRes = { status: statusMock };
      mockNext = jest.fn();
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should handle AppError with correct status code', () => {
      const error = new AppError('Bad request', 400);
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Bad request',
      });
    });

    it('should handle generic Error with 500 status code', () => {
      const error = new Error('Generic error');
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should log the error', () => {
      const error = new AppError('Test error', 400);
      
      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);
      
      expect(console.error).toHaveBeenCalledWith('Error:', error);
    });
  });

  describe('asyncHandler', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {};
      mockNext = jest.fn();
    });

    it('should call the wrapped function', async () => {
      const mockFn = jest.fn().mockResolvedValue(undefined);
      const wrapped = asyncHandler(mockFn);
      
      await wrapped(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should pass errors to next middleware', async () => {
      const error = new Error('Async error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrapped = asyncHandler(mockFn);
      
      await wrapped(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should not call next on successful execution', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrapped = asyncHandler(mockFn);
      
      await wrapped(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
