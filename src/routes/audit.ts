import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from '../services/AuditService';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const result = await auditService.getRecentLogs({ page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/entity/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const result = await auditService.getLogsForEntity(
      req.params.entityType,
      req.params.entityId,
      { page, limit }
    );
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/user/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const result = await auditService.getLogsByUser(req.params.userId, { page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
