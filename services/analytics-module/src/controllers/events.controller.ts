/**
 * GameVerse Analytics Module - Events Controller
 * HTTP handlers for event tracking endpoints
 */

import { Response } from 'express';
import { eventsService } from '../services';
import { logger, LogEventType } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/rbac';

export class EventsController {
  /**
   * Track a single event
   * POST /api/v1/events
   */
  async trackEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    const event = await eventsService.trackEvent(req.body);

    res.status(201).json({
      success: true,
      data: event,
    });
  }

  /**
   * Track multiple events in batch
   * POST /api/v1/events/batch
   */
  async trackEventsBatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await eventsService.trackEventsBatch(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  }

  /**
   * Get an event by ID
   * GET /api/v1/events/:eventId
   */
  async getEventById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { eventId } = req.params;
    const event = await eventsService.getEventById(eventId);

    res.json({
      success: true,
      data: event,
    });
  }

  /**
   * Query events
   * GET /api/v1/events
   */
  async queryEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = (req as AuthenticatedRequest & { validatedQuery: unknown }).validatedQuery || req.query;
    const result = await eventsService.queryEvents(query as Parameters<typeof eventsService.queryEvents>[0]);

    res.json({
      success: true,
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        hasMore: result.hasMore,
      },
    });
  }

  /**
   * Get events by player ID
   * GET /api/v1/events/player/:playerId
   */
  async getEventsByPlayerId(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { playerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const events = await eventsService.getEventsByPlayerId(playerId, limit);

    res.json({
      success: true,
      data: events,
      meta: {
        total: events.length,
      },
    });
  }

  /**
   * Get events by session ID
   * GET /api/v1/events/session/:sessionId
   */
  async getEventsBySessionId(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const events = await eventsService.getEventsBySessionId(sessionId);

    res.json({
      success: true,
      data: events,
      meta: {
        total: events.length,
      },
    });
  }

  /**
   * Get events by correlation ID
   * GET /api/v1/events/correlation/:correlationId
   */
  async getEventsByCorrelationId(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { correlationId } = req.params;
    const events = await eventsService.getEventsByCorrelationId(correlationId);

    res.json({
      success: true,
      data: events,
      meta: {
        total: events.length,
      },
    });
  }

  /**
   * Get event type distribution
   * GET /api/v1/events/distribution
   */
  async getEventTypeDistribution(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { start, end } = req.query;

    let timeRange: { start: Date; end: Date } | undefined;
    if (start && end) {
      timeRange = {
        start: new Date(start as string),
        end: new Date(end as string),
      };
    }

    const distribution = await eventsService.getEventTypeDistribution(timeRange);

    res.json({
      success: true,
      data: distribution,
    });
  }

  /**
   * Delete an event
   * DELETE /api/v1/events/:eventId
   */
  async deleteEvent(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { eventId } = req.params;
    const event = await eventsService.getEventById(eventId);
    await eventsService.deleteEvent(eventId);

    logger.logAudit({
      eventType: LogEventType.AUDIT_DELETE,
      userId: req.user?.id || 'anonymous',
      action: 'DELETE',
      resourceType: 'event',
      resourceId: eventId,
      previousState: event as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(204).send();
  }

  /**
   * Get queue status
   * GET /api/v1/events/queue/status
   */
  async getQueueStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const status = eventsService.getQueueStatus();

    res.json({
      success: true,
      data: status,
    });
  }

  /**
   * Process event queue
   * POST /api/v1/events/queue/process
   */
  async processQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await eventsService.processQueue();

    res.json({
      success: true,
      data: result,
    });
  }

  /**
   * Enable event tracking
   * POST /api/v1/events/tracking/enable
   */
  async enableTracking(req: AuthenticatedRequest, res: Response): Promise<void> {
    eventsService.enableTracking();

    logger.logAudit({
      eventType: LogEventType.AUDIT_CONFIG_CHANGE,
      userId: req.user?.id || 'anonymous',
      action: 'ENABLE_TRACKING',
      resourceType: 'events',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: { trackingEnabled: true },
    });
  }

  /**
   * Disable event tracking
   * POST /api/v1/events/tracking/disable
   */
  async disableTracking(req: AuthenticatedRequest, res: Response): Promise<void> {
    eventsService.disableTracking();

    logger.logAudit({
      eventType: LogEventType.AUDIT_CONFIG_CHANGE,
      userId: req.user?.id || 'anonymous',
      action: 'DISABLE_TRACKING',
      resourceType: 'events',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: { trackingEnabled: false },
    });
  }
}

export const eventsController = new EventsController();

export default eventsController;
