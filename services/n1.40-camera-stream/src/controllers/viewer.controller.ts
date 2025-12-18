import { Request, Response, NextFunction } from 'express';
import { viewerService } from '../services/viewer.service';
import { signalingService } from '../services/signaling.service';
import { bandwidthService } from '../services/bandwidth.service';
import { ConnectionState, QualityPreset } from '../types';

export class ViewerController {
  async join(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { streamId, userId } = req.body;
      const viewer = await viewerService.join(streamId, userId);
      
      await signalingService.addViewerToRoom(streamId, viewer);
      
      const webrtcConfig = signalingService.getWebRTCConfig();
      
      res.status(201).json({ 
        success: true, 
        data: { 
          viewer, 
          webrtcConfig 
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewer = await viewerService.findById(req.params.id);
      res.json({ success: true, data: viewer });
    } catch (error) {
      next(error);
    }
  }

  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const streamId = req.query.streamId as string;
      const userId = req.query.userId as string;
      const connectionState = req.query.connectionState as ConnectionState;

      const result = await viewerService.findAll({ page, limit, streamId, userId, connectionState });
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async findByStream(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewers = await viewerService.findByStream(req.params.streamId);
      res.json({ success: true, data: viewers });
    } catch (error) {
      next(error);
    }
  }

  async leave(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewer = await viewerService.findById(req.params.id);
      await signalingService.removeViewerFromRoom(viewer.streamId, viewer.id);
      await viewerService.leave(req.params.id);
      bandwidthService.clearHistory(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async setConnectionState(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { state } = req.body;
      const viewer = await viewerService.setConnectionState(req.params.id, state as ConnectionState);
      res.json({ success: true, data: viewer });
    } catch (error) {
      next(error);
    }
  }

  async setQuality(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quality } = req.body;
      const viewer = await viewerService.setQuality(req.params.id, quality as QualityPreset);
      res.json({ success: true, data: viewer });
    } catch (error) {
      next(error);
    }
  }

  async updateBandwidth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = req.body;
      await bandwidthService.recordSample(req.params.id, stats);
      
      const adaptedQuality = await bandwidthService.adaptQuality(req.params.id);
      const viewer = await viewerService.findById(req.params.id);
      
      res.json({ 
        success: true, 
        data: { 
          viewer, 
          adaptedQuality 
        } 
      });
    } catch (error) {
      next(error);
    }
  }

  async heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const viewer = await viewerService.heartbeat(req.params.id);
      res.json({ success: true, data: viewer });
    } catch (error) {
      next(error);
    }
  }

  async getStreamStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await viewerService.getStreamStats(req.params.streamId);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  async getNetworkCondition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const condition = await bandwidthService.getNetworkCondition(req.params.id);
      const recommendedQuality = await bandwidthService.getRecommendedQuality(req.params.id);
      res.json({ 
        success: true, 
        data: { 
          condition, 
          recommendedQuality 
        } 
      });
    } catch (error) {
      next(error);
    }
  }
}

export const viewerController = new ViewerController();
