import { Router, Request, Response, NextFunction } from 'express';
import { snapshotService } from '../services/SnapshotService';

const router = Router();

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, date } = req.body;
    
    if (!accountId) {
      res.status(400).json({ error: 'Missing required field: accountId' });
      return;
    }
    
    const snapshot = await snapshotService.createSnapshot(
      accountId,
      date ? new Date(date) : new Date()
    );
    
    res.status(201).json({
      ...snapshot,
      balance: snapshot.balance.toString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date } = req.body;
    
    const snapshots = await snapshotService.createSnapshotsForAllAccounts(
      date ? new Date(date) : new Date()
    );
    
    res.status(201).json({
      data: snapshots.map(s => ({ ...s, balance: s.balance.toString() })),
      total: snapshots.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account/:accountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const result = await snapshotService.getSnapshotsByAccount(req.params.accountId, { page, limit });
    
    res.json({
      ...result,
      data: result.data.map(s => ({ ...s, balance: s.balance.toString() })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account/:accountId/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await snapshotService.getLatestSnapshot(req.params.accountId);
    
    if (!snapshot) {
      res.status(404).json({ error: 'No snapshot found for this account' });
      return;
    }
    
    res.json({
      ...snapshot,
      balance: snapshot.balance.toString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account/:accountId/date/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = await snapshotService.getSnapshot(
      req.params.accountId,
      new Date(req.params.date)
    );
    
    if (!snapshot) {
      res.status(404).json({ error: 'No snapshot found for this account and date' });
      return;
    }
    
    res.json({
      ...snapshot,
      balance: snapshot.balance.toString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account/:accountId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      res.status(400).json({ error: 'Missing required query params: startDate, endDate' });
      return;
    }
    
    const snapshots = await snapshotService.getSnapshotHistory(
      req.params.accountId,
      new Date(startDate as string),
      new Date(endDate as string)
    );
    
    res.json({
      data: snapshots.map(s => ({ ...s, balance: s.balance.toString() })),
      total: snapshots.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/account/:accountId/balance-at/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const balance = await snapshotService.getBalanceAtDate(
      req.params.accountId,
      new Date(req.params.date)
    );
    
    res.json({
      accountId: req.params.accountId,
      date: req.params.date,
      balance: balance.toString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/date/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshots = await snapshotService.getAllSnapshotsForDate(new Date(req.params.date));
    
    res.json({
      data: snapshots.map(s => ({ ...s, balance: s.balance.toString() })),
      total: snapshots.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
