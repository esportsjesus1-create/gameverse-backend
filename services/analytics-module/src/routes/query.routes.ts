/**
 * GameVerse Analytics Module - Query Routes
 * API routes for analytics query endpoints
 */

import { Router } from 'express';
import { queryController } from '../controllers';
import { asyncHandler, validate, requirePermission } from '../middleware';
import { Permission } from '../types';
import {
  analyticsQuerySchema,
  queryIdParamSchema,
} from '../validation/schemas';

const router = Router();

/**
 * @route POST /api/v1/queries/execute
 * @desc Execute an analytics query
 * @access Private - QUERY_BASIC or QUERY_ADVANCED
 */
router.post(
  '/execute',
  requirePermission(Permission.QUERY_BASIC),
  validate(analyticsQuerySchema, 'body'),
  asyncHandler(queryController.executeQuery.bind(queryController))
);

/**
 * @route POST /api/v1/queries
 * @desc Save a query for later use
 * @access Private - QUERY_ADVANCED
 */
router.post(
  '/',
  requirePermission(Permission.QUERY_ADVANCED),
  validate(analyticsQuerySchema, 'body'),
  asyncHandler(queryController.saveQuery.bind(queryController))
);

/**
 * @route GET /api/v1/queries
 * @desc List all saved queries
 * @access Private - QUERY_BASIC
 */
router.get(
  '/',
  requirePermission(Permission.QUERY_BASIC),
  asyncHandler(queryController.listSavedQueries.bind(queryController))
);

/**
 * @route GET /api/v1/queries/:queryId
 * @desc Get a saved query by ID
 * @access Private - QUERY_BASIC
 */
router.get(
  '/:queryId',
  requirePermission(Permission.QUERY_BASIC),
  validate(queryIdParamSchema, 'params'),
  asyncHandler(queryController.getSavedQuery.bind(queryController))
);

/**
 * @route DELETE /api/v1/queries/:queryId
 * @desc Delete a saved query
 * @access Private - QUERY_ADVANCED
 */
router.delete(
  '/:queryId',
  requirePermission(Permission.QUERY_ADVANCED),
  validate(queryIdParamSchema, 'params'),
  asyncHandler(queryController.deleteSavedQuery.bind(queryController))
);

/**
 * @route POST /api/v1/queries/:queryId/execute
 * @desc Execute a saved query
 * @access Private - QUERY_BASIC
 */
router.post(
  '/:queryId/execute',
  requirePermission(Permission.QUERY_BASIC),
  validate(queryIdParamSchema, 'params'),
  asyncHandler(queryController.executeSavedQuery.bind(queryController))
);

export default router;
