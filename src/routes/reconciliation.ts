import { Router, Request, Response, NextFunction } from 'express';
import { reconciliationService } from '../services/ReconciliationService';

const router = Router();

router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reconciliationService.runReconciliation();
    
    res.status(201).json({
      ...result,
      discrepancies: result.discrepancies.map(d => ({
        ...d,
        expectedBalance: d.expectedBalance.toString(),
        actualBalance: d.actualBalance.toString(),
        difference: d.difference.toString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reconciliationService.getLatestReconciliation();
    
    if (!result) {
      res.status(404).json({ error: 'No reconciliation runs found' });
      return;
    }
    
    res.json({
      ...result,
      discrepancies: result.discrepancies.map(d => ({
        ...d,
        expectedBalance: typeof d.expectedBalance === 'object' ? d.expectedBalance.toString() : d.expectedBalance,
        actualBalance: typeof d.actualBalance === 'object' ? d.actualBalance.toString() : d.actualBalance,
        difference: typeof d.difference === 'object' ? d.difference.toString() : d.difference,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const results = await reconciliationService.getReconciliationHistory(limit);
    
    res.json({
      data: results.map(r => ({
        ...r,
        discrepancies: r.discrepancies.map(d => ({
          ...d,
          expectedBalance: typeof d.expectedBalance === 'object' ? d.expectedBalance.toString() : d.expectedBalance,
          actualBalance: typeof d.actualBalance === 'object' ? d.actualBalance.toString() : d.actualBalance,
          difference: typeof d.difference === 'object' ? d.difference.toString() : d.difference,
        })),
      })),
      total: results.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reconciliationService.getReconciliation(req.params.id);
    
    if (!result) {
      res.status(404).json({ error: 'Reconciliation run not found' });
      return;
    }
    
    res.json({
      ...result,
      discrepancies: result.discrepancies.map(d => ({
        ...d,
        expectedBalance: typeof d.expectedBalance === 'object' ? d.expectedBalance.toString() : d.expectedBalance,
        actualBalance: typeof d.actualBalance === 'object' ? d.actualBalance.toString() : d.actualBalance,
        difference: typeof d.difference === 'object' ? d.difference.toString() : d.difference,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/verify/:transactionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isBalanced = await reconciliationService.verifyTransactionBalance(req.params.transactionId);
    
    res.json({
      transactionId: req.params.transactionId,
      isBalanced,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
