import { Request, Response, NextFunction } from 'express';
import { TelemetryEventSchema, BatchEventsSchema } from '../types';
import { eventService } from '../services';
import { createError } from '../middleware/errorHandler';
import { webSocketHandler } from '../websocket/WebSocketHandler';

export class EventController {
  public trackEvent(req: Request, res: Response, next: NextFunction): void {
    try {
      const validatedEvent = TelemetryEventSchema.parse(req.body);
      const storedEvent = eventService.trackEvent(validatedEvent);
      
      webSocketHandler.broadcastEvent(storedEvent);
      
      res.status(201).json({
        success: true,
        data: storedEvent
      });
    } catch (error) {
      next(error);
    }
  }

  public trackBatchEvents(req: Request, res: Response, next: NextFunction): void {
    try {
      const validated = BatchEventsSchema.parse(req.body);
      const storedEvents = eventService.trackBatchEvents(validated.events);
      
      for (const event of storedEvents) {
        webSocketHandler.broadcastEvent(event);
      }
      
      res.status(201).json({
        success: true,
        data: storedEvents,
        count: storedEvents.length
      });
    } catch (error) {
      next(error);
    }
  }

  public queryEvents(req: Request, res: Response, next: NextFunction): void {
    try {
      const {
        startTime,
        endTime,
        limit,
        offset,
        userId,
        sessionId,
        eventType
      } = req.query;

      const result = eventService.queryEvents({
        startTime: startTime !== undefined ? parseInt(startTime as string, 10) : undefined,
        endTime: endTime !== undefined ? parseInt(endTime as string, 10) : undefined,
        limit: limit !== undefined ? parseInt(limit as string, 10) : undefined,
        offset: offset !== undefined ? parseInt(offset as string, 10) : undefined,
        userId: userId as string | undefined,
        sessionId: sessionId as string | undefined,
        eventType: eventType as 'user_action' | 'system_event' | 'error' | 'performance' | 'custom' | undefined
      });

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  }

  public getEvent(req: Request, res: Response, next: NextFunction): void {
    try {
      const { id } = req.params;
      
      if (id === undefined) {
        throw createError('Event ID is required', 400, 'MISSING_ID');
      }

      const event = eventService.getEvent(id);
      
      if (event === undefined) {
        throw createError('Event not found', 404, 'EVENT_NOT_FOUND');
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      next(error);
    }
  }

  public getEventStats(req: Request, res: Response, next: NextFunction): void {
    try {
      const stats = {
        totalEvents: eventService.getEventCount(),
        eventsByType: eventService.getEventCountByType()
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export const eventController = new EventController();
