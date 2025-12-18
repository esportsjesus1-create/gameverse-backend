import { Request, Response, NextFunction } from 'express';
import { streamService } from '../services/stream.service';
import { signalingService } from '../services/signaling.service';
import { viewerService } from '../services/viewer.service';
import { StreamStatus, QualityPreset } from '../types';

export class StreamController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.create(req.body);
      res.status(201).json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.findById(req.params.id);
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const ownerId = req.query.ownerId as string;
      const status = req.query.status as StreamStatus;
      const cameraId = req.query.cameraId as string;

      const result = await streamService.findAll({ page, limit, ownerId, status, cameraId });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getLiveStreams(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const streams = await streamService.getLiveStreams();
      res.json({ success: true, data: streams });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.update(req.params.id, req.body);
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.start(req.params.id);
      
      await signalingService.createRoom(stream.id, stream.ownerId);
      
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async stop(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.stop(req.params.id);
      
      await viewerService.disconnectAllFromStream(stream.id);
      await signalingService.closeRoom(stream.id);
      
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.pause(req.params.id);
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async resume(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stream = await streamService.resume(req.params.id);
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await streamService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setQuality(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quality } = req.body;
      const stream = await streamService.setQuality(req.params.id, quality as QualityPreset);
      res.json({ success: true, data: stream });
    } catch (error) {
      next(error);
    }
  }

  async getViewerStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await viewerService.getStreamStats(req.params.id);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
}

export const streamController = new StreamController();
