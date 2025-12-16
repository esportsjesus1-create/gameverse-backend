import { Router, Request, Response, NextFunction } from 'express';
import { statementService } from '../services/StatementService';

const router = Router();

router.post('/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, startDate, endDate, format } = req.body;
    
    if (!accountId || !startDate || !endDate) {
      res.status(400).json({ error: 'Missing required fields: accountId, startDate, endDate' });
      return;
    }
    
    const validFormats = ['CSV', 'PDF'];
    const outputFormat = (format || 'CSV').toUpperCase();
    
    if (!validFormats.includes(outputFormat)) {
      res.status(400).json({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` });
      return;
    }
    
    const result = await statementService.generateStatement({
      accountId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      format: outputFormat as 'CSV' | 'PDF',
    });
    
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  } catch (error) {
    next(error);
  }
});

router.get('/summary/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Missing required query params: startDate, endDate' });
      return;
    }
    
    const summary = await statementService.getAccountSummary(
      req.params.accountId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json({
      accountId: req.params.accountId,
      startDate,
      endDate,
      openingBalance: summary.openingBalance.toString(),
      closingBalance: summary.closingBalance.toString(),
      totalDebits: summary.totalDebits.toString(),
      totalCredits: summary.totalCredits.toString(),
      netChange: summary.netChange.toString(),
      transactionCount: summary.transactionCount,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
