import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { RoomService } from '../services/room.service';
import { StateSyncService } from '../services/state-sync.service';
import { PermissionService } from '../services/permission.service';
import { LifecycleService } from '../services/lifecycle.service';
import {
  RoomError,
  CreateRoomInput,
  UpdateRoomInput,
  JoinRoomInput,
  UpdatePlayerInput,
  UpdateStateInput,
  RoomFilter,
  PlayerRole,
  PermissionAction,
} from '../types';
import { logger } from '../utils/logger';

export function createRoomRouter(
  roomService: RoomService,
  stateSyncService: StateSyncService,
  permissionService: PermissionService,
  lifecycleService: LifecycleService
): Router {
  const router = Router();

  const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: errors.array() 
      });
    }
    next();
  };

  const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  router.post(
    '/',
    [
      body('name').isString().isLength({ min: 1, max: 255 }),
      body('type').isIn(['lobby', 'game', 'social', 'event', 'custom']),
      body('ownerId').isString().notEmpty(),
      body('description').optional().isString(),
      body('visibility').optional().isIn(['public', 'private', 'friends_only']),
      body('capacity').optional().isInt({ min: 1, max: 100 }),
      body('settings').optional().isObject(),
      body('metadata').optional().isObject(),
      body('tags').optional().isArray(),
      body('password').optional().isString(),
      body('parentRoomId').optional().isUUID(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const input: CreateRoomInput = req.body;
      const room = await roomService.createRoom(input);
      res.status(201).json(room);
    })
  );

  router.get(
    '/',
    [
      query('type').optional().isIn(['lobby', 'game', 'social', 'event', 'custom']),
      query('status').optional().isIn(['creating', 'active', 'paused', 'closing', 'closed', 'archived']),
      query('visibility').optional().isIn(['public', 'private', 'friends_only']),
      query('ownerId').optional().isString(),
      query('search').optional().isString(),
      query('hasCapacity').optional().isBoolean(),
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const filter: RoomFilter = {
        type: req.query.type as RoomFilter['type'],
        status: req.query.status as RoomFilter['status'],
        visibility: req.query.visibility as RoomFilter['visibility'],
        ownerId: req.query.ownerId as string,
        search: req.query.search as string,
        hasCapacity: req.query.hasCapacity === 'true',
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      };
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await roomService.getRooms(filter, page, limit);
      res.json(result);
    })
  );

  router.get(
    '/:id',
    [param('id').isUUID()],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const room = await roomService.getRoomById(req.params.id);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      res.json(room);
    })
  );

  router.put(
    '/:id',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
      body('name').optional().isString().isLength({ min: 1, max: 255 }),
      body('description').optional().isString(),
      body('visibility').optional().isIn(['public', 'private', 'friends_only']),
      body('capacity').optional().isInt({ min: 1, max: 100 }),
      body('settings').optional().isObject(),
      body('metadata').optional().isObject(),
      body('tags').optional().isArray(),
      body('password').optional().isString(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const { userId, ...updateInput } = req.body;
      const input: UpdateRoomInput = updateInput;
      const room = await roomService.updateRoom(req.params.id, input, userId);
      res.json(room);
    })
  );

  router.delete(
    '/:id',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await roomService.deleteRoom(req.params.id, req.body.userId);
      res.status(204).send();
    })
  );

  router.post(
    '/:id/join',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
      body('username').isString().notEmpty(),
      body('password').optional().isString(),
      body('asSpectator').optional().isBoolean(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const input: JoinRoomInput = {
        roomId: req.params.id,
        userId: req.body.userId,
        username: req.body.username,
        password: req.body.password,
        asSpectator: req.body.asSpectator,
      };
      const player = await roomService.joinRoom(input);
      res.status(201).json(player);
    })
  );

  router.post(
    '/:id/leave',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await roomService.leaveRoom(req.params.id, req.body.userId);
      res.status(204).send();
    })
  );

  router.post(
    '/:id/kick',
    [
      param('id').isUUID(),
      body('targetUserId').isString().notEmpty(),
      body('kickedBy').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await roomService.kickPlayer(req.params.id, req.body.targetUserId, req.body.kickedBy);
      res.status(204).send();
    })
  );

  router.get(
    '/:id/players',
    [param('id').isUUID()],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const players = await roomService.getRoomPlayers(req.params.id);
      res.json(players);
    })
  );

  router.put(
    '/:id/players/:userId',
    [
      param('id').isUUID(),
      param('userId').isString(),
      body('position').optional().isObject(),
      body('rotation').optional().isObject(),
      body('customData').optional().isObject(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const input: UpdatePlayerInput = {
        position: req.body.position,
        rotation: req.body.rotation,
        customData: req.body.customData,
      };
      const player = await roomService.updatePlayer(req.params.id, req.params.userId, input);
      res.json(player);
    })
  );

  router.put(
    '/:id/players/:userId/role',
    [
      param('id').isUUID(),
      param('userId').isString(),
      body('role').isIn(['owner', 'admin', 'moderator', 'member', 'guest']),
      body('updatedBy').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const player = await roomService.updatePlayerRole(
        req.params.id,
        req.params.userId,
        req.body.role as PlayerRole,
        req.body.updatedBy
      );
      res.json(player);
    })
  );

  router.get(
    '/:id/state',
    [param('id').isUUID()],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const state = await stateSyncService.getState(req.params.id);
      if (!state) {
        return res.status(404).json({ error: 'Room state not found' });
      }
      res.json(state);
    })
  );

  router.put(
    '/:id/state',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
      body('data').isObject(),
      body('merge').optional().isBoolean(),
      body('expectedVersion').optional().isInt(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const input: UpdateStateInput = {
        data: req.body.data,
        merge: req.body.merge,
      };
      const state = await stateSyncService.updateState(
        req.params.id,
        input,
        req.body.userId,
        req.body.expectedVersion
      );
      res.json(state);
    })
  );

  router.get(
    '/:id/state/history',
    [
      param('id').isUUID(),
      query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 10;
      const history = await stateSyncService.getStateHistory(req.params.id, limit);
      res.json(history);
    })
  );

  router.get(
    '/:id/permissions',
    [param('id').isUUID()],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const permissions = await permissionService.getRoomPermissions(req.params.id);
      res.json(permissions);
    })
  );

  router.post(
    '/:id/permissions',
    [
      param('id').isUUID(),
      body('role').isIn(['owner', 'admin', 'moderator', 'member', 'guest']),
      body('action').isIn(['join', 'leave', 'invite', 'kick', 'ban', 'mute', 'update_settings', 'update_state', 'delete']),
      body('allowed').isBoolean(),
      body('updatedBy').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const permission = await permissionService.setPermission(
        req.params.id,
        req.body.role as PlayerRole,
        req.body.action as PermissionAction,
        req.body.allowed,
        req.body.updatedBy
      );
      res.json(permission);
    })
  );

  router.post(
    '/:id/permissions/bulk',
    [
      param('id').isUUID(),
      body('permissions').isArray(),
      body('permissions.*.role').isIn(['owner', 'admin', 'moderator', 'member', 'guest']),
      body('permissions.*.action').isIn(['join', 'leave', 'invite', 'kick', 'ban', 'mute', 'update_settings', 'update_state', 'delete']),
      body('permissions.*.allowed').isBoolean(),
      body('updatedBy').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await permissionService.bulkSetPermissions(
        req.params.id,
        req.body.permissions,
        req.body.updatedBy
      );
      res.status(204).send();
    })
  );

  router.post(
    '/:id/permissions/reset',
    [
      param('id').isUUID(),
      body('updatedBy').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await permissionService.resetRoomPermissions(req.params.id, req.body.updatedBy);
      res.status(204).send();
    })
  );

  router.get(
    '/:id/events',
    [
      param('id').isUUID(),
      query('limit').optional().isInt({ min: 1, max: 1000 }),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await roomService.getRoomEvents(req.params.id, limit);
      res.json(events);
    })
  );

  router.post(
    '/:id/instance',
    [
      param('id').isUUID(),
      body('serverId').isString().notEmpty(),
      body('region').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const instance = await lifecycleService.createInstance(
        req.params.id,
        req.body.serverId,
        req.body.region
      );
      res.status(201).json(instance);
    })
  );

  router.get(
    '/:id/instance',
    [param('id').isUUID()],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const instance = await lifecycleService.getInstanceByRoom(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      res.json(instance);
    })
  );

  router.delete(
    '/:id/instance',
    [param('id').isUUID()],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const instance = await lifecycleService.getInstanceByRoom(req.params.id);
      if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
      }
      await lifecycleService.stopInstance(instance.id);
      res.status(204).send();
    })
  );

  router.post(
    '/:id/pause',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const room = await lifecycleService.pauseRoom(req.params.id, req.body.userId);
      res.json(room);
    })
  );

  router.post(
    '/:id/resume',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      const room = await lifecycleService.resumeRoom(req.params.id, req.body.userId);
      res.json(room);
    })
  );

  router.post(
    '/:id/archive',
    [
      param('id').isUUID(),
      body('userId').isString().notEmpty(),
    ],
    handleValidationErrors,
    asyncHandler(async (req: Request, res: Response) => {
      await lifecycleService.archiveRoom(req.params.id, req.body.userId);
      res.status(204).send();
    })
  );

  router.get(
    '/instances/active',
    asyncHandler(async (_req: Request, res: Response) => {
      const instances = await lifecycleService.getActiveInstances();
      res.json(instances);
    })
  );

  router.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Route error', { error: err.message, stack: err.stack });

    if (err instanceof RoomError) {
      return res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  return router;
}
