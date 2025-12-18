import { Request, Response, NextFunction } from 'express';
import { recordingService } from '../services/recording.service';
import { RecordingStatus } from '../types';

export class RecordingController {
  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recording = await recordingService.start(req.body);
      res.status(201).json({ success: true, data: recording });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recording = await recordingService.findById(req.params.id);
      res.json({ success: true, data: recording });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const ownerId = req.query.ownerId as string;
      const streamId = req.query.streamId as string;
      const status = req.query.status as RecordingStatus;

      const result = await recordingService.findAll({ page, limit, ownerId, streamId, status });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findByStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recordings = await recordingService.findByStream(req.params.streamId);
      res.json({ success: true, data: recordings });
    } catch (error) {
      next(error);
    }
  }

  async stop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recording = await recordingService.stop(req.params.id);
      res.json({ success: true, data: recording });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recording = await recordingService.pause(req.params.id);
      res.json({ success: true, data: recording });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const recording = await recordingService.resume(req.params.id);
      res.json({ success: true, data: recording });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await recordingService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async getStorageUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerId = req.params.ownerId;
      const usage = await recordingService.getStorageUsage(ownerId);
      res.json({ success: true, data: usage });
    } catch (error) {
      next(error);
    }
  }
}

export const recordingController = new RecordingController();
