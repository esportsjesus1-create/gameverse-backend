/**
 * GameVerse Analytics Module - Query Controller
 * HTTP handlers for analytics query endpoints
 */

import { Response } from 'express';
import { queryService } from '../services';
import { logger, LogEventType } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/rbac';

export class QueryController {
  /**
   * Execute an analytics query
   * POST /api/v1/queries/execute
   */
  async executeQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const result = await queryService.executeQuery(req.body);

    res.json({
      success: true,
      data: result.data,
      meta: {
        queryId: result.queryId,
        totalRows: result.metadata.totalRows,
        executionTimeMs: result.metadata.executionTimeMs,
        fromCache: result.metadata.fromCache,
        truncated: result.metadata.truncated,
        executedAt: result.executedAt,
      },
    });
  }

  /**
   * Save a query for later use
   * POST /api/v1/queries
   */
  async saveQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const query = await queryService.saveQuery(req.body);

    logger.logAudit({
      eventType: LogEventType.AUDIT_CREATE,
      userId: req.user?.id || 'anonymous',
      action: 'CREATE',
      resourceType: 'query',
      resourceId: query.id,
      newState: query as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: query,
    });
  }

  /**
   * Get a saved query by ID
   * GET /api/v1/queries/:queryId
   */
  async getSavedQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { queryId } = req.params;
    const query = await queryService.getSavedQuery(queryId);

    res.json({
      success: true,
      data: query,
    });
  }

  /**
   * List all saved queries
   * GET /api/v1/queries
   */
  async listSavedQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    const queries = await queryService.listSavedQueries();

    res.json({
      success: true,
      data: queries,
      meta: {
        total: queries.length,
      },
    });
  }

  /**
   * Delete a saved query
   * DELETE /api/v1/queries/:queryId
   */
  async deleteSavedQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { queryId } = req.params;
    const query = await queryService.getSavedQuery(queryId);
    await queryService.deleteSavedQuery(queryId);

    logger.logAudit({
      eventType: LogEventType.AUDIT_DELETE,
      userId: req.user?.id || 'anonymous',
      action: 'DELETE',
      resourceType: 'query',
      resourceId: queryId,
      previousState: query as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(204).send();
  }

  /**
   * Execute a saved query
   * POST /api/v1/queries/:queryId/execute
   */
  async executeSavedQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { queryId } = req.params;
    const result = await queryService.executeSavedQuery(queryId);

    res.json({
      success: true,
      data: result.data,
      meta: {
        queryId: result.queryId,
        totalRows: result.metadata.totalRows,
        executionTimeMs: result.metadata.executionTimeMs,
        fromCache: result.metadata.fromCache,
        truncated: result.metadata.truncated,
        executedAt: result.executedAt,
      },
    });
  }
}

export const queryController = new QueryController();

export default queryController;
