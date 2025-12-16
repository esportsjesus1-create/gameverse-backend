import { Router, Request, Response, NextFunction } from 'express';
import { transactionService } from '../services/TransactionService';
import { TransactionStatus, EntryType } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idempotencyKey, reference, description, transactionDate, entries, metadata } = req.body;
    const createdBy = req.headers['x-user-id'] as string || 'system';
    
    if (!idempotencyKey || !reference || !description || !transactionDate || !entries) {
      res.status(400).json({ 
        error: 'Missing required fields: idempotencyKey, reference, description, transactionDate, entries' 
      });
      return;
    }
    
    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'Entries must be a non-empty array' });
      return;
    }
    
    for (const entry of entries) {
      if (!entry.accountId || !entry.entryType || !entry.amount || !entry.currencyCode) {
        res.status(400).json({ 
          error: 'Each entry must have: accountId, entryType, amount, currencyCode' 
        });
        return;
      }
      
      if (!Object.values(EntryType).includes(entry.entryType)) {
        res.status(400).json({ 
          error: `Invalid entry type. Must be one of: ${Object.values(EntryType).join(', ')}` 
        });
        return;
      }
    }
    
    const transaction = await transactionService.createTransaction({
      idempotencyKey,
      reference,
      description,
      transactionDate: new Date(transactionDate),
      entries,
      metadata,
      createdBy,
    });
    
    res.status(201).json(transaction);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const status = req.query.status as TransactionStatus;
    
    const result = await transactionService.getAllTransactions({ page, limit, status });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await transactionService.getTransaction(req.params.id);
    
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/entries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entries = await transactionService.getTransactionEntries(req.params.id);
    res.json({ data: entries, total: entries.length });
  } catch (error) {
    next(error);
  }
});

router.get('/idempotency/:key', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const transaction = await transactionService.getTransactionByIdempotencyKey(req.params.key);
    
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.get('/account/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const result = await transactionService.getTransactionsByAccount(req.params.accountId, {
      page,
      limit,
      startDate,
      endDate,
    });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/post', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.headers['x-user-id'] as string || 'system';
    const transaction = await transactionService.postTransaction(req.params.id, userId);
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/void', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const userId = req.headers['x-user-id'] as string || 'system';
    
    if (!reason) {
      res.status(400).json({ error: 'Void reason is required' });
      return;
    }
    
    const transaction = await transactionService.voidTransaction(req.params.id, reason, userId);
    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

export default router;
