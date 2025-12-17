import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { CreateSessionRequest, UpdatePlayerStatsRequest, ReconnectRequest } from '../types';

export function validateCreateSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as CreateSessionRequest;
  
  if (!body.gameType || typeof body.gameType !== 'string') {
    throw new AppError('gameType is required and must be a string', 400);
  }
  
  if (!body.players || !Array.isArray(body.players) || body.players.length === 0) {
    throw new AppError('players is required and must be a non-empty array', 400);
  }
  
  for (const player of body.players) {
    if (!player.playerId || typeof player.playerId !== 'string') {
      throw new AppError('Each player must have a playerId string', 400);
    }
    if (!player.playerName || typeof player.playerName !== 'string') {
      throw new AppError('Each player must have a playerName string', 400);
    }
  }
  
  next();
}

export function validateUpdateStats(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as UpdatePlayerStatsRequest;
  
  const numericFields = ['kills', 'deaths', 'assists', 'damageDealt', 'damageReceived', 'objectivesCompleted'];
  
  for (const field of numericFields) {
    const value = body[field as keyof UpdatePlayerStatsRequest];
    if (value !== undefined && typeof value !== 'number') {
      throw new AppError(`${field} must be a number`, 400);
    }
  }
  
  if (body.customStats !== undefined && typeof body.customStats !== 'object') {
    throw new AppError('customStats must be an object', 400);
  }
  
  next();
}

export function validateReconnect(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const body = req.body as ReconnectRequest;
  
  if (!body.token || typeof body.token !== 'string') {
    throw new AppError('token is required and must be a string', 400);
  }
  
  if (!body.playerId || typeof body.playerId !== 'string') {
    throw new AppError('playerId is required and must be a string', 400);
  }
  
  next();
}

export function validateUUID(paramName: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (!value || !uuidRegex.test(value)) {
      throw new AppError(`Invalid ${paramName} format`, 400);
    }
    
    next();
  };
}
