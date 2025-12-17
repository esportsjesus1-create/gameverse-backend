import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { leaderboardService } from '../services/leaderboard.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/',
  [
    body('name').isString().notEmpty().isLength({ max: 100 }),
    body('type').isIn(['global', 'seasonal', 'weekly', 'daily', 'custom']),
    body('category').isIn(['score', 'kills', 'wins', 'playtime', 'achievements', 'custom']),
    body('gameMode').optional().isString(),
    body('seasonId').optional().isString(),
    body('decayConfig').optional().isObject(),
    body('startsAt').optional().isISO8601(),
    body('endsAt').optional().isISO8601(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const leaderboard = await leaderboardService.createLeaderboard(req.body);

    res.status(201).json({
      success: true,
      data: leaderboard,
      message: 'Leaderboard created',
    });
  })
);

router.get(
  '/',
  [
    query('type').optional().isString(),
    query('category').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leaderboards = await leaderboardService.getLeaderboards(
      req.query.type as string,
      req.query.category as string
    );

    res.json({ success: true, data: leaderboards });
  })
);

router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leaderboard = await leaderboardService.getLeaderboardById(req.params.id);

    if (!leaderboard) {
      res.status(404).json({ success: false, error: 'Leaderboard not found' });
      return;
    }

    res.json({ success: true, data: leaderboard });
  })
);

router.get(
  '/:id/entries',
  [
    param('id').isUUID(),
    query('start').optional().isInt({ min: 0 }),
    query('count').optional().isInt({ min: 1, max: 1000 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const start = req.query.start ? parseInt(req.query.start as string, 10) : 0;
    const count = req.query.count ? parseInt(req.query.count as string, 10) : 100;

    const entries = await leaderboardService.getTopEntries(req.params.id, { start, count });

    res.json({ success: true, data: entries });
  })
);

router.post(
  '/:id/score',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
    body('username').isString().notEmpty(),
    body('score').isNumeric(),
    body('increment').optional().isBoolean(),
    body('metadata').optional().isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const ranking = await leaderboardService.updateScore({
      leaderboardId: req.params.id,
      userId: req.body.userId,
      username: req.body.username,
      score: parseFloat(req.body.score),
      increment: req.body.increment,
      metadata: req.body.metadata,
    });

    res.json({
      success: true,
      data: ranking,
      message: 'Score updated',
    });
  })
);

router.get(
  '/:id/user/:userId',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ranking = await leaderboardService.getUserRanking(req.params.id, req.params.userId);

    res.json({ success: true, data: ranking });
  })
);

router.get(
  '/:id/around/:userId',
  [
    param('id').isUUID(),
    query('range').optional().isInt({ min: 1, max: 50 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const range = req.query.range ? parseInt(req.query.range as string, 10) : undefined;
    const entries = await leaderboardService.getAroundUser(req.params.id, req.params.userId, range);

    res.json({ success: true, data: entries });
  })
);

router.post(
  '/:id/decay',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const decayedCount = await leaderboardService.applyDecay(req.params.id);

    res.json({
      success: true,
      data: { decayedCount },
      message: `Applied decay to ${decayedCount} entries`,
    });
  })
);

router.post(
  '/:id/snapshot',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const snapshot = await leaderboardService.createSnapshot(req.params.id);

    res.status(201).json({
      success: true,
      data: snapshot,
      message: 'Snapshot created',
    });
  })
);

router.get(
  '/:id/snapshots',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const snapshotList = await leaderboardService.getSnapshots(req.params.id);

    res.json({ success: true, data: snapshotList });
  })
);

router.post(
  '/:id/reset',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await leaderboardService.resetLeaderboard(req.params.id);

    res.json({
      success: true,
      message: 'Leaderboard reset',
    });
  })
);

router.patch(
  '/:id/active',
  [
    param('id').isUUID(),
    body('active').isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const leaderboard = await leaderboardService.setLeaderboardActive(req.params.id, req.body.active);

    res.json({
      success: true,
      data: leaderboard,
      message: `Leaderboard ${req.body.active ? 'activated' : 'deactivated'}`,
    });
  })
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await leaderboardService.deleteLeaderboard(req.params.id);

    res.json({
      success: true,
      message: 'Leaderboard deleted',
    });
  })
);

router.delete(
  '/:id/user/:userId',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await leaderboardService.removeUser(req.params.id, req.params.userId);

    res.json({
      success: true,
      message: 'User removed from leaderboard',
    });
  })
);

router.get(
  '/:id/stats',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = leaderboardService.getLeaderboardStats(req.params.id);

    if (!stats) {
      res.status(404).json({ success: false, error: 'Leaderboard not found or empty' });
      return;
    }

    res.json({ success: true, data: stats });
  })
);

export default router;
