/**
 * GameVerse Analytics Module - Events Routes
 * API routes for event tracking endpoints
 */

import { Router } from 'express';
import { eventsController } from '../controllers';
import { asyncHandler, validate, requirePermission, requireRole } from '../middleware';
import { Permission, UserRole } from '../types';
import {
  trackEventSchema,
  batchTrackEventsSchema,
  queryEventsSchema,
  eventIdParamSchema,
} from '../validation/schemas';

const router = Router();

/**
 * @route POST /api/v1/events
 * @desc Track a single event
 * @access Private - EVENTS_WRITE
 */
router.post(
  '/',
  requirePermission(Permission.EVENTS_WRITE),
  validate(trackEventSchema, 'body'),
  asyncHandler(eventsController.trackEvent.bind(eventsController))
);

/**
 * @route GET /api/v1/events
 * @desc Query events with filters and pagination
 * @access Private - EVENTS_READ
 */
router.get(
  '/',
  requirePermission(Permission.EVENTS_READ),
  validate(queryEventsSchema, 'query'),
  asyncHandler(eventsController.queryEvents.bind(eventsController))
);

/**
 * @route POST /api/v1/events/batch
 * @desc Track multiple events in batch
 * @access Private - EVENTS_WRITE
 */
router.post(
  '/batch',
  requirePermission(Permission.EVENTS_WRITE),
  validate(batchTrackEventsSchema, 'body'),
  asyncHandler(eventsController.trackEventsBatch.bind(eventsController))
);

/**
 * @route GET /api/v1/events/distribution
 * @desc Get event type distribution
 * @access Private - EVENTS_READ
 */
router.get(
  '/distribution',
  requirePermission(Permission.EVENTS_READ),
  asyncHandler(eventsController.getEventTypeDistribution.bind(eventsController))
);

/**
 * @route GET /api/v1/events/queue/status
 * @desc Get event queue status
 * @access Private - ADMIN
 */
router.get(
  '/queue/status',
  requireRole(UserRole.ADMIN),
  asyncHandler(eventsController.getQueueStatus.bind(eventsController))
);

/**
 * @route POST /api/v1/events/queue/process
 * @desc Process event queue
 * @access Private - ADMIN
 */
router.post(
  '/queue/process',
  requireRole(UserRole.ADMIN),
  asyncHandler(eventsController.processQueue.bind(eventsController))
);

/**
 * @route POST /api/v1/events/tracking/enable
 * @desc Enable event tracking
 * @access Private - ADMIN
 */
router.post(
  '/tracking/enable',
  requireRole(UserRole.ADMIN),
  asyncHandler(eventsController.enableTracking.bind(eventsController))
);

/**
 * @route POST /api/v1/events/tracking/disable
 * @desc Disable event tracking
 * @access Private - ADMIN
 */
router.post(
  '/tracking/disable',
  requireRole(UserRole.ADMIN),
  asyncHandler(eventsController.disableTracking.bind(eventsController))
);

/**
 * @route GET /api/v1/events/player/:playerId
 * @desc Get events by player ID
 * @access Private - EVENTS_READ
 */
router.get(
  '/player/:playerId',
  requirePermission(Permission.EVENTS_READ),
  asyncHandler(eventsController.getEventsByPlayerId.bind(eventsController))
);

/**
 * @route GET /api/v1/events/session/:sessionId
 * @desc Get events by session ID
 * @access Private - EVENTS_READ
 */
router.get(
  '/session/:sessionId',
  requirePermission(Permission.EVENTS_READ),
  asyncHandler(eventsController.getEventsBySessionId.bind(eventsController))
);

/**
 * @route GET /api/v1/events/correlation/:correlationId
 * @desc Get events by correlation ID
 * @access Private - EVENTS_READ
 */
router.get(
  '/correlation/:correlationId',
  requirePermission(Permission.EVENTS_READ),
  asyncHandler(eventsController.getEventsByCorrelationId.bind(eventsController))
);

/**
 * @route GET /api/v1/events/:eventId
 * @desc Get an event by ID
 * @access Private - EVENTS_READ
 */
router.get(
  '/:eventId',
  requirePermission(Permission.EVENTS_READ),
  validate(eventIdParamSchema, 'params'),
  asyncHandler(eventsController.getEventById.bind(eventsController))
);

/**
 * @route DELETE /api/v1/events/:eventId
 * @desc Delete an event
 * @access Private - EVENTS_DELETE
 */
router.delete(
  '/:eventId',
  requirePermission(Permission.EVENTS_DELETE),
  validate(eventIdParamSchema, 'params'),
  asyncHandler(eventsController.deleteEvent.bind(eventsController))
);

export default router;
