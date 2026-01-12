import { Request, Response, NextFunction } from 'express';
import { sessionService, analyticsService } from '../services';
import { createError } from '../middleware/errorHandler';

export class AnalyticsController {
  public getSessionAnalytics(req: Request, res: Response, next: NextFunction): void {
    try {
      const { startTime, endTime } = req.query;

      const result = sessionService.getSessionAnalytics(
        startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime !== undefined ? parseInt(endTime as string, 10) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public getUserBehavior(req: Request, res: Response, next: NextFunction): void {
    try {
      const { userId } = req.params;

      if (userId === undefined) {
        throw createError('User ID is required', 400, 'MISSING_USER_ID');
      }

      const result = analyticsService.getUserBehavior(userId);

      if (result === undefined) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public getEngagementMetrics(req: Request, res: Response, next: NextFunction): void {
    try {
      const { startTime, endTime } = req.query;

      const result = analyticsService.getEngagementMetrics(
        startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime !== undefined ? parseInt(endTime as string, 10) : undefined
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public analyzeFunnel(req: Request, res: Response, next: NextFunction): void {
    try {
      const { name, steps, startTime, endTime } = req.body as {
        name: string;
        steps: Array<{ name: string; eventName: string }>;
        startTime?: number;
        endTime?: number;
      };

      if (name === undefined || !Array.isArray(steps) || steps.length === 0) {
        throw createError('Funnel name and steps are required', 400, 'INVALID_INPUT');
      }

      const result = analyticsService.analyzeFunnel(name, steps, startTime, endTime);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public getCohortAnalysis(req: Request, res: Response, next: NextFunction): void {
    try {
      const { period, startTime, endTime } = req.query;

      if (startTime === undefined || endTime === undefined) {
        throw createError('Start time and end time are required', 400, 'MISSING_TIME_RANGE');
      }

      const cohortPeriod = (period as 'day' | 'week' | 'month') ?? 'week';

      const result = analyticsService.getCohortAnalysis(
        cohortPeriod,
        parseInt(startTime as string, 10),
        parseInt(endTime as string, 10)
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  public createSession(req: Request, res: Response, next: NextFunction): void {
    try {
      const { userId, metadata } = req.body as {
        userId?: string;
        metadata?: Record<string, unknown>;
      };

      const session = sessionService.createSession(userId, metadata);

      res.status(201).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  }

  public getSession(req: Request, res: Response, next: NextFunction): void {
    try {
      const { sessionId } = req.params;

      if (sessionId === undefined) {
        throw createError('Session ID is required', 400, 'MISSING_SESSION_ID');
      }

      const session = sessionService.getSession(sessionId);

      if (session === undefined) {
        throw createError('Session not found', 404, 'SESSION_NOT_FOUND');
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  }

  public endSession(req: Request, res: Response, next: NextFunction): void {
    try {
      const { sessionId } = req.params;

      if (sessionId === undefined) {
        throw createError('Session ID is required', 400, 'MISSING_SESSION_ID');
      }

      const session = sessionService.endSession(sessionId);

      if (session === undefined) {
        throw createError('Session not found', 404, 'SESSION_NOT_FOUND');
      }

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  }

  public getActiveSessions(req: Request, res: Response, next: NextFunction): void {
    try {
      const sessions = sessionService.getActiveSessions();

      res.json({
        success: true,
        data: sessions,
        count: sessions.length
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
