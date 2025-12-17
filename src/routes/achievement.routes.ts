import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { achievementService } from '../services/achievement.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/',
  [
    body('name').isString().notEmpty().isLength({ max: 100 }),
    body('description').isString().notEmpty().isLength({ max: 500 }),
    body('type').isIn(['standard', 'hidden', 'secret', 'tiered', 'daily', 'seasonal']),
    body('category').isIn(['combat', 'exploration', 'social', 'collection', 'progression', 'special']),
    body('points').isInt({ min: 0 }),
    body('trigger').isObject(),
    body('rewards').isArray(),
    body('isHidden').optional().isBoolean(),
    body('prerequisites').optional().isArray(),
    body('tiers').optional().isArray(),
    body('seasonId').optional().isString(),
    body('expiresAt').optional().isISO8601(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const achievement = await achievementService.createAchievement(req.body);

    res.status(201).json({
      success: true,
      data: achievement,
      message: 'Achievement created',
    });
  })
);

router.get(
  '/',
  [
    query('category').optional().isString(),
    query('type').optional().isString(),
    query('includeHidden').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const achievements = await achievementService.getAchievements(
      req.query.category as string,
      req.query.type as string,
      req.query.includeHidden === 'true'
    );

    res.json({ success: true, data: achievements });
  })
);

router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const achievement = await achievementService.getAchievementById(req.params.id);

    if (!achievement) {
      res.status(404).json({ success: false, error: 'Achievement not found' });
      return;
    }

    res.json({ success: true, data: achievement });
  })
);

router.get(
  '/user/:userId/progress',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const progress = await achievementService.getAllUserProgress(req.params.userId);

    res.json({ success: true, data: progress });
  })
);

router.get(
  '/user/:userId/progress/:achievementId',
  [param('achievementId').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const progress = await achievementService.getUserProgress(
      req.params.userId,
      req.params.achievementId
    );

    if (!progress) {
      res.status(404).json({ success: false, error: 'Progress not found' });
      return;
    }

    res.json({ success: true, data: progress });
  })
);

router.post(
  '/progress',
  [
    body('userId').isString().notEmpty(),
    body('achievementId').isUUID(),
    body('progress').isNumeric(),
    body('increment').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const result = await achievementService.updateProgress({
      odbyId: req.body.userId,
      achievementId: req.body.achievementId,
      progress: parseFloat(req.body.progress),
      increment: req.body.increment,
    });

    res.json({
      success: true,
      data: result,
      message: result ? 'Achievement unlocked!' : 'Progress updated',
    });
  })
);

router.post(
  '/stat',
  [
    body('userId').isString().notEmpty(),
    body('statKey').isString().notEmpty(),
    body('value').isNumeric(),
    body('increment').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const results = await achievementService.updateStat({
      odbyId: req.body.userId,
      statKey: req.body.statKey,
      value: parseFloat(req.body.value),
      increment: req.body.increment,
    });

    res.json({
      success: true,
      data: { unlocks: results },
      message: results.length > 0 ? `${results.length} achievement(s) unlocked!` : 'Stat updated',
    });
  })
);

router.post(
  '/event',
  [
    body('userId').isString().notEmpty(),
    body('eventType').isString().notEmpty(),
    body('data').optional().isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const results = await achievementService.triggerEvent({
      odbyId: req.body.userId,
      eventType: req.body.eventType,
      data: req.body.data,
    });

    res.json({
      success: true,
      data: { unlocks: results },
      message: results.length > 0 ? `${results.length} achievement(s) unlocked!` : 'Event processed',
    });
  })
);

router.post(
  '/claim',
  [
    body('userId').isString().notEmpty(),
    body('achievementId').isUUID(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const result = await achievementService.claimRewards(req.body.userId, req.body.achievementId);

    res.json({
      success: true,
      data: result,
      message: 'Rewards claimed',
    });
  })
);

router.get(
  '/user/:userId/unlocked',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const unlocked = await achievementService.getUnlockedAchievements(req.params.userId);

    res.json({ success: true, data: unlocked });
  })
);

router.get(
  '/user/:userId/stats',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const stats = await achievementService.getAchievementStats(req.params.userId);

    res.json({ success: true, data: stats });
  })
);

router.patch(
  '/:id/active',
  [
    param('id').isUUID(),
    body('active').isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const achievement = await achievementService.setAchievementActive(req.params.id, req.body.active);

    res.json({
      success: true,
      data: achievement,
      message: `Achievement ${req.body.active ? 'activated' : 'deactivated'}`,
    });
  })
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await achievementService.deleteAchievement(req.params.id);

    res.json({
      success: true,
      message: 'Achievement deleted',
    });
  })
);

export default router;
