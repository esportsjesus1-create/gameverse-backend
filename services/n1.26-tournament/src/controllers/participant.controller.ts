import { Request, Response, NextFunction } from 'express';
import { participantService } from '../services';
import { CreateParticipantDto, UpdateParticipantDto } from '../types';

export class ParticipantController {
  /**
   * Add participant to tournament
   */
  async addParticipant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateParticipantDto = {
        name: req.body.name,
        email: req.body.email,
        userId: req.body.userId,
        teamId: req.body.teamId,
        seed: req.body.seed,
      };

      const participant = await participantService.addParticipant(req.params.id, data);

      res.status(201).json({
        success: true,
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Remove participant from tournament
   */
  async removeParticipant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await participantService.removeParticipant(req.params.id, req.params.participantId);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update participant
   */
  async updateParticipant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: UpdateParticipantDto = {
        name: req.body.name,
        email: req.body.email,
        seed: req.body.seed,
        status: req.body.status,
      };

      // Remove undefined values
      Object.keys(data).forEach(key => {
        if (data[key as keyof UpdateParticipantDto] === undefined) {
          delete data[key as keyof UpdateParticipantDto];
        }
      });

      const participant = await participantService.updateParticipant(
        req.params.id,
        req.params.participantId,
        data
      );

      res.json({
        success: true,
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check in participant
   */
  async checkIn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const participant = await participantService.checkIn(
        req.params.id,
        req.params.participantId
      );

      res.json({
        success: true,
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get participants for tournament
   */
  async getParticipants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const participants = await participantService.getParticipants(req.params.id);

      res.json({
        success: true,
        data: participants,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Withdraw participant from tournament
   */
  async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const participant = await participantService.withdraw(
        req.params.id,
        req.params.participantId
      );

      res.json({
        success: true,
        data: participant,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const participantController = new ParticipantController();
