import { Request, Response, NextFunction } from 'express';
import { cameraService } from '../services/camera.service';
import { CameraStatus } from '../types';

export class CameraController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const camera = await cameraService.create(req.body);
      res.status(201).json({ success: true, data: camera });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const camera = await cameraService.findById(req.params.id);
      res.json({ success: true, data: camera });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const ownerId = req.query.ownerId as string;
      const status = req.query.status as CameraStatus;

      const result = await cameraService.findAll({ page, limit, ownerId, status });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findByOwner(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cameras = await cameraService.findByOwner(req.params.ownerId);
      res.json({ success: true, data: cameras });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const camera = await cameraService.update(req.params.id, req.body);
      res.json({ success: true, data: camera });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await cameraService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body;
      const camera = await cameraService.setStatus(req.params.id, status);
      res.json({ success: true, data: camera });
    } catch (error) {
      next(error);
    }
  }

  async getOnlineCameras(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ownerId = req.query.ownerId as string;
      const cameras = await cameraService.getOnlineCameras(ownerId);
      res.json({ success: true, data: cameras });
    } catch (error) {
      next(error);
    }
  }
}

export const cameraController = new CameraController();
