import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { auditService } from '../services/audit.service';
import { AuditAction, AuditCategory, ComplianceStandard } from '../types';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/logs',
  [
    body('action').isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'PERMISSION_CHANGE', 'CONFIG_CHANGE', 'SYSTEM_EVENT']),
    body('category').isIn(['USER', 'AUTH', 'DATA', 'SYSTEM', 'SECURITY', 'COMPLIANCE', 'FINANCIAL']),
    body('actorId').isString().notEmpty(),
    body('actorType').isIn(['user', 'system', 'service']),
    body('resourceType').isString().notEmpty(),
    body('resourceId').isString().notEmpty(),
    body('description').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const log = await auditService.createLog(req.body);

    res.status(201).json({
      success: true,
      data: log,
      message: 'Audit log created',
    });
  })
);

router.get(
  '/logs',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'PERMISSION_CHANGE', 'CONFIG_CHANGE', 'SYSTEM_EVENT']),
    query('category').optional().isIn(['USER', 'AUTH', 'DATA', 'SYSTEM', 'SECURITY', 'COMPLIANCE', 'FINANCIAL']),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const queryParams = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      action: req.query.action as AuditAction | undefined,
      category: req.query.category as AuditCategory | undefined,
      actorId: req.query.actorId as string | undefined,
      resourceType: req.query.resourceType as string | undefined,
      resourceId: req.query.resourceId as string | undefined,
      tenantId: req.query.tenantId as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const result = await auditService.queryLogs(queryParams);

    res.json({
      success: true,
      data: result,
    });
  })
);

router.get(
  '/logs/:id',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const log = await auditService.getLogById(req.params.id);

    if (!log) {
      res.status(404).json({ success: false, error: 'Audit log not found' });
      return;
    }

    res.json({
      success: true,
      data: log,
    });
  })
);

router.get(
  '/verify',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startId = req.query.startId as string | undefined;
    const endId = req.query.endId as string | undefined;

    const result = await auditService.verifyIntegrity(startId, endId);

    res.json({
      success: true,
      data: result,
    });
  })
);

router.post(
  '/reports/compliance',
  [
    body('standard').isIn(['GDPR', 'SOC2', 'HIPAA', 'PCI_DSS']),
    body('periodStart').isISO8601(),
    body('periodEnd').isISO8601(),
    body('tenantId').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { standard, periodStart, periodEnd, tenantId } = req.body;

    const report = await auditService.generateComplianceReport(
      standard as ComplianceStandard,
      new Date(periodStart),
      new Date(periodEnd),
      tenantId
    );

    res.json({
      success: true,
      data: report,
    });
  })
);

export default router;
