import { Router, Request, Response } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import {
  validateCreateSession,
  validateUpdateStats,
  validateReconnect,
  validateUUID,
} from '../middleware/validation';
import {
  createSession,
  getSession,
  getSessionPlayers,
  getPlayerStats,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  updatePlayerStats,
} from '../services/sessionService';
import { calculateMVP, getAllPlayerScores } from '../services/mvpService';
import {
  createReconnectionToken,
  useReconnectionToken,
  refreshReconnectionToken,
} from '../services/reconnectionService';
import { ApiResponse, CreateSessionRequest, UpdatePlayerStatsRequest, ReconnectRequest } from '../types';

const router = Router();

router.post(
  '/',
  validateCreateSession,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as CreateSessionRequest;
    const session = await createSession(body);
    
    res.status(201).json({
      success: true,
      data: session,
    });
  })
);

router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await getSession(req.params.id!);
    
    if (!session) {
      throw new AppError('Session not found', 404);
    }
    
    const [players, stats] = await Promise.all([
      getSessionPlayers(req.params.id!),
      getPlayerStats(req.params.id!),
    ]);
    
    res.json({
      success: true,
      data: {
        ...session,
        players,
        stats,
      },
    });
  })
);

router.patch(
  '/:id/start',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await startSession(req.params.id!);
    
    res.json({
      success: true,
      data: session,
    });
  })
);

router.patch(
  '/:id/pause',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await pauseSession(req.params.id!);
    
    res.json({
      success: true,
      data: session,
    });
  })
);

router.patch(
  '/:id/resume',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await resumeSession(req.params.id!);
    
    res.json({
      success: true,
      data: session,
    });
  })
);

router.patch(
  '/:id/end',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await endSession(req.params.id!);
    const mvp = await calculateMVP(req.params.id!);
    
    res.json({
      success: true,
      data: {
        session,
        mvp,
      },
    });
  })
);

router.post(
  '/:id/players/:playerId/stats',
  validateUUID('id'),
  validateUpdateStats,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UpdatePlayerStatsRequest;
    const stats = await updatePlayerStats(req.params.id!, req.params.playerId!, body);
    
    res.json({
      success: true,
      data: stats,
    });
  })
);

router.get(
  '/:id/mvp',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const session = await getSession(req.params.id!);
    
    if (!session) {
      throw new AppError('Session not found', 404);
    }
    
    const mvp = await calculateMVP(req.params.id!);
    const allScores = await getAllPlayerScores(req.params.id!);
    
    res.json({
      success: true,
      data: {
        mvp,
        leaderboard: allScores,
      },
    });
  })
);

router.post(
  '/:id/reconnect-token',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { playerId } = req.body as { playerId: string };
    
    if (!playerId || typeof playerId !== 'string') {
      throw new AppError('playerId is required', 400);
    }
    
    const token = await createReconnectionToken(req.params.id!, playerId);
    
    res.status(201).json({
      success: true,
      data: token,
    });
  })
);

router.post(
  '/:id/reconnect',
  validateUUID('id'),
  validateReconnect,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as ReconnectRequest;
    const result = await useReconnectionToken(req.params.id!, body.playerId, body.token);
    
    if (!result.success) {
      throw new AppError(result.message, 401);
    }
    
    const session = await getSession(req.params.id!);
    
    res.json({
      success: true,
      data: {
        message: result.message,
        session,
      },
    });
  })
);

router.post(
  '/:id/reconnect-token/refresh',
  validateUUID('id'),
  asyncHandler(async (req: Request, res: Response) => {
    const { playerId, token } = req.body as { playerId: string; token: string };
    
    if (!playerId || !token) {
      throw new AppError('playerId and token are required', 400);
    }
    
    const newToken = await refreshReconnectionToken(req.params.id!, playerId, token);
    
    if (!newToken) {
      throw new AppError('Invalid or expired token', 401);
    }
    
    res.json({
      success: true,
      data: newToken,
    });
  })
);

export default router;
