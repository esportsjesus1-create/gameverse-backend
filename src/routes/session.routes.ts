import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { sessionService } from '../services/session.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/',
  [
    body('lobbyId').isUUID(),
    body('gameMode').isIn(['solo', 'duo', 'squad', 'custom']),
    body('players').isArray({ min: 1 }),
    body('players.*.userId').isString().notEmpty(),
    body('players.*.username').isString().notEmpty(),
    body('players.*.team').optional().isInt(),
    body('settings').optional().isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const session = await sessionService.createSession(req.body);

    res.status(201).json({
      success: true,
      data: session,
      message: 'Game session created',
    });
  })
);

router.get(
  '/active',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await sessionService.getActiveSessions(page, limit);

    res.json({ success: true, data: result });
  })
);

router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await sessionService.getSessionById(req.params.id);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({ success: true, data: session });
  })
);

router.get(
  '/player/:userId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await sessionService.getPlayerSession(req.params.userId);

    res.json({ success: true, data: session });
  })
);

router.post(
  '/:id/stats',
  [
    param('id').isUUID(),
    body('playerId').isString().notEmpty(),
    body('stats').isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const player = await sessionService.updatePlayerStats({
      sessionId: req.params.id,
      playerId: req.body.playerId,
      stats: req.body.stats,
    });

    res.json({
      success: true,
      data: player,
      message: 'Stats updated',
    });
  })
);

router.post(
  '/:id/kill',
  [
    param('id').isUUID(),
    body('killerId').isString().notEmpty(),
    body('victimId').isString().notEmpty(),
    body('assistIds').optional().isArray(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    await sessionService.recordKill(
      req.params.id,
      req.body.killerId,
      req.body.victimId,
      req.body.assistIds || []
    );

    res.json({
      success: true,
      message: 'Kill recorded',
    });
  })
);

router.post(
  '/:id/disconnect',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const reconnectionToken = await sessionService.handlePlayerDisconnect(
      req.params.id,
      req.body.userId
    );

    res.json({
      success: true,
      data: { reconnectionToken },
      message: 'Player disconnected',
    });
  })
);

router.post(
  '/reconnect',
  [body('token').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const result = await sessionService.handlePlayerReconnect(req.body.token);

    res.json({
      success: true,
      data: result,
      message: 'Player reconnected',
    });
  })
);

router.post(
  '/:id/leave',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const session = await sessionService.handlePlayerLeave(req.params.id, req.body.userId);

    res.json({
      success: true,
      data: session,
      message: 'Player left session',
    });
  })
);

router.post(
  '/:id/pause',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await sessionService.pauseSession(req.params.id);

    res.json({
      success: true,
      data: session,
      message: 'Session paused',
    });
  })
);

router.post(
  '/:id/resume',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await sessionService.resumeSession(req.params.id);

    res.json({
      success: true,
      data: session,
      message: 'Session resumed',
    });
  })
);

router.post(
  '/:id/end',
  [
    param('id').isUUID(),
    body('reason').optional().isIn(['completed', 'cancelled', 'abandoned']),
    body('winnerId').optional().isString(),
    body('winnerTeam').optional().isInt(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const session = await sessionService.endSession(
      req.params.id,
      req.body.reason || 'completed',
      req.body.winnerId,
      req.body.winnerTeam
    );

    res.json({
      success: true,
      data: session,
      message: 'Session ended',
    });
  })
);

router.get(
  '/:id/mvp',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const mvp = sessionService.calculateMVP(req.params.id);

    if (!mvp) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({ success: true, data: mvp });
  })
);

router.get(
  '/:id/summary',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const summary = await sessionService.getSessionSummary(req.params.id);

    if (!summary) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.json({ success: true, data: summary });
  })
);

router.get(
  '/:id/events',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const events = await sessionService.getSessionEvents(req.params.id);

    res.json({ success: true, data: events });
  })
);

router.get(
  '/stats/active',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      data: {
        activeSessions: sessionService.getActiveSessionsCount(),
        activePlayers: sessionService.getActivePlayersCount(),
      },
    });
  })
);

export default router;
