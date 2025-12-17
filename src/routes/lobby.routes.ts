import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { lobbyService } from '../services/lobby.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/',
  [
    body('name').isString().notEmpty().isLength({ max: 100 }),
    body('hostId').isString().notEmpty(),
    body('type').isIn(['public', 'private', 'ranked', 'custom']),
    body('gameMode').isIn(['solo', 'duo', 'squad', 'custom']),
    body('maxPlayers').isInt({ min: 2, max: 100 }),
    body('minPlayers').optional().isInt({ min: 2 }),
    body('settings').optional().isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const lobby = await lobbyService.createLobby(req.body);

    res.status(201).json({
      success: true,
      data: lobby,
      message: 'Lobby created successfully',
    });
  })
);

router.get(
  '/public',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

    const result = await lobbyService.getPublicLobbies(page, limit);

    res.json({ success: true, data: result });
  })
);

router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const lobby = await lobbyService.getLobbyById(req.params.id);

    if (!lobby) {
      res.status(404).json({ success: false, error: 'Lobby not found' });
      return;
    }

    res.json({ success: true, data: lobby });
  })
);

router.get(
  '/invite/:code',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const lobby = await lobbyService.getLobbyByInviteCode(req.params.code);

    if (!lobby) {
      res.status(404).json({ success: false, error: 'Invalid invite code' });
      return;
    }

    res.json({ success: true, data: lobby });
  })
);

router.post(
  '/:id/join',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
    body('username').isString().notEmpty(),
    body('inviteCode').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { lobby, player } = await lobbyService.joinLobby({
      lobbyId: req.params.id,
      userId: req.body.userId,
      username: req.body.username,
      inviteCode: req.body.inviteCode,
    });

    res.json({
      success: true,
      data: { lobby, player },
      message: 'Joined lobby successfully',
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

    const lobby = await lobbyService.leaveLobby(req.params.id, req.body.userId);

    res.json({
      success: true,
      data: lobby,
      message: lobby ? 'Left lobby successfully' : 'Lobby closed',
    });
  })
);

router.post(
  '/:id/kick',
  [
    param('id').isUUID(),
    body('hostId').isString().notEmpty(),
    body('targetUserId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const lobby = await lobbyService.kickPlayer(
      req.params.id,
      req.body.hostId,
      req.body.targetUserId
    );

    res.json({
      success: true,
      data: lobby,
      message: 'Player kicked successfully',
    });
  })
);

router.post(
  '/:id/ready',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
    body('ready').isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const lobby = await lobbyService.setPlayerReady(
      req.params.id,
      req.body.userId,
      req.body.ready
    );

    res.json({
      success: true,
      data: lobby,
      message: req.body.ready ? 'Player is ready' : 'Player is not ready',
    });
  })
);

router.post(
  '/:id/start',
  [
    param('id').isUUID(),
    body('hostId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const lobby = await lobbyService.startReadyCheck(req.params.id, req.body.hostId);

    res.json({
      success: true,
      data: lobby,
      message: 'Ready check started',
    });
  })
);

router.patch(
  '/:id/settings',
  [
    param('id').isUUID(),
    body('hostId').isString().notEmpty(),
    body('settings').isObject(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const lobby = await lobbyService.updateSettings(
      req.params.id,
      req.body.hostId,
      req.body.settings
    );

    res.json({
      success: true,
      data: lobby,
      message: 'Settings updated',
    });
  })
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    await lobbyService.closeLobby(req.params.id);

    res.json({
      success: true,
      message: 'Lobby closed',
    });
  })
);

router.get(
  '/user/:userId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const lobby = await lobbyService.getPlayerLobby(req.params.userId);

    res.json({
      success: true,
      data: lobby,
    });
  })
);

router.get(
  '/stats/active',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    res.json({
      success: true,
      data: {
        activeLobbies: lobbyService.getActiveLobbiesCount(),
        activePlayers: lobbyService.getActivePlayersCount(),
      },
    });
  })
);

export default router;
