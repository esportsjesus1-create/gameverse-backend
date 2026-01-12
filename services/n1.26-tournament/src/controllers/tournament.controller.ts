import { Request, Response, NextFunction } from 'express';
import { tournamentService } from '../services';
import { bracketService } from '../services';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  TournamentFilters,
  PaginationOptions,
  BracketGenerationOptions,
  TournamentStatus,
  TournamentFormat,
} from '../types';

export class TournamentController {
  /**
   * Create a new tournament
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateTournamentDto = {
        name: req.body.name,
        description: req.body.description,
        game: req.body.game,
        format: req.body.format,
        maxParticipants: req.body.maxParticipants,
        minParticipants: req.body.minParticipants,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        registrationStartDate: req.body.registrationStartDate 
          ? new Date(req.body.registrationStartDate) 
          : undefined,
        registrationEndDate: req.body.registrationEndDate 
          ? new Date(req.body.registrationEndDate) 
          : undefined,
        rules: req.body.rules,
        prizePool: req.body.prizePool,
        createdBy: req.body.createdBy,
      };

      const tournament = await tournamentService.create(data);

      res.status(201).json({
        success: true,
        data: tournament,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get tournament by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournament = await tournamentService.getById(req.params.id);

      res.json({
        success: true,
        data: tournament,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List tournaments
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters: TournamentFilters = {
        status: req.query.status as TournamentStatus | undefined,
        format: req.query.format as TournamentFormat | undefined,
        game: req.query.game as string | undefined,
        search: req.query.search as string | undefined,
      };

      const pagination: PaginationOptions = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
        sortBy: req.query.sortBy as string | undefined,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      };

      const result = await tournamentService.list(filters, pagination);

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update tournament
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdateTournamentDto = {
        name: req.body.name,
        description: req.body.description,
        game: req.body.game,
        format: req.body.format,
        status: req.body.status,
        maxParticipants: req.body.maxParticipants,
        minParticipants: req.body.minParticipants,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        registrationStartDate: req.body.registrationStartDate 
          ? new Date(req.body.registrationStartDate) 
          : undefined,
        registrationEndDate: req.body.registrationEndDate 
          ? new Date(req.body.registrationEndDate) 
          : undefined,
        rules: req.body.rules,
        prizePool: req.body.prizePool,
      };

      // Remove undefined values
      Object.keys(data).forEach(key => {
        if (data[key as keyof UpdateTournamentDto] === undefined) {
          delete data[key as keyof UpdateTournamentDto];
        }
      });

      const tournament = await tournamentService.update(req.params.id, data);

      res.json({
        success: true,
        data: tournament,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete tournament
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await tournamentService.delete(req.params.id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update tournament status
   */
  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const tournament = await tournamentService.updateStatus(
        req.params.id,
        req.body.status as TournamentStatus
      );

      res.json({
        success: true,
        data: tournament,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate bracket for tournament
   */
  async generateBracket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const options: BracketGenerationOptions = {
        shuffleSeeds: req.body.shuffleSeeds,
        schedulingStartTime: req.body.schedulingStartTime 
          ? new Date(req.body.schedulingStartTime) 
          : undefined,
        matchDurationMinutes: req.body.matchDurationMinutes,
        breakBetweenMatchesMinutes: req.body.breakBetweenMatchesMinutes,
      };

      const bracket = await bracketService.generateBracket(req.params.id, options);

      // Update tournament status to IN_PROGRESS
      await tournamentService.updateStatus(req.params.id, TournamentStatus.IN_PROGRESS);

      res.json({
        success: true,
        data: bracket,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get bracket for tournament
   */
  async getBracket(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const bracket = await bracketService.getBracket(req.params.id);

      res.json({
        success: true,
        data: bracket,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tournamentController = new TournamentController();
