import { Router, Response } from 'express';
import { lobbyService, LobbyServiceError } from '../services/lobby.service';
import { authMiddleware, AuthenticatedRequest, optionalAuthMiddleware } from '../middleware/auth.middleware';
import { 
  validate, 
  createLobbyValidation, 
  lobbyIdValidation,
  joinLobbyValidation,
  setReadyValidation,
  listLobbiesValidation
} from '../middleware/validation.middleware';
import { LobbyStatus, LobbyFilters } from '../types';
import { LoggerService } from '../services/logger.service';

const router = Router();
const logger = new LoggerService('LobbyRoutes');

router.post(
  '/',
  authMiddleware,
  validate(createLobbyValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, gameType, maxPlayers, minPlayers, countdownDuration } = req.body;
      
      const lobby = await lobbyService.createLobby({
        name,
        hostId: req.playerId!,
        gameType,
        maxPlayers,
        minPlayers,
        countdownDuration
      });

      res.status(201).json({
        success: true,
        data: lobby,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

router.get(
  '/',
  optionalAuthMiddleware,
  validate(listLobbiesValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const filters: LobbyFilters = {};
      if (req.query.status) {
        filters.status = req.query.status as LobbyStatus;
      }
      if (req.query.gameType) {
        filters.gameType = req.query.gameType as string;
      }
      if (req.query.hasSpace === 'true') {
        filters.hasSpace = true;
      }

      const result = await lobbyService.listLobbies(filters, page, limit);

      res.json({
        success: true,
        data: result.lobbies,
        page: result.page,
        limit: result.limit,
        total: result.total,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

router.get(
  '/:id',
  optionalAuthMiddleware,
  validate(lobbyIdValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const lobby = await lobbyService.getLobbyById(req.params.id);

      if (!lobby) {
        res.status(404).json({
          success: false,
          error: 'Lobby not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      res.json({
        success: true,
        data: lobby,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

router.post(
  '/:id/join',
  authMiddleware,
  validate(joinLobbyValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const lobby = await lobbyService.joinLobby(req.params.id, req.playerId!);

      res.json({
        success: true,
        data: lobby,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

router.post(
  '/:id/leave',
  authMiddleware,
  validate(lobbyIdValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const lobby = await lobbyService.leaveLobby(req.params.id, req.playerId!);

      res.json({
        success: true,
        data: lobby,
        message: lobby ? 'Left lobby successfully' : 'Lobby was deleted',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

router.post(
  '/:id/ready',
  authMiddleware,
  validate(setReadyValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { ready } = req.body;
      const result = await lobbyService.setPlayerReady(req.params.id, req.playerId!, ready);

      res.json({
        success: true,
        data: {
          player: result.player,
          allReady: result.allReady
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

router.delete(
  '/:id',
  authMiddleware,
  validate(lobbyIdValidation),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await lobbyService.deleteLobby(req.params.id, req.playerId!);

      res.json({
        success: true,
        message: 'Lobby deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleError(res, error as Error);
    }
  }
);

function handleError(res: Response, error: Error): void {
  logger.error('Request error', error);

  if (error instanceof LobbyServiceError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
}

export default router;
