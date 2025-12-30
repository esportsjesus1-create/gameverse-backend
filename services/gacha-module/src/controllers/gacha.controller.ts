import { Request, Response } from 'express';
import { GachaService } from '../services/gacha.service';
import { BannerService } from '../services/banner.service';
import { PityService } from '../services/pity.service';
import { ApiResponse, PullRequest } from '../types';

export class GachaController {
  private gachaService: GachaService;
  private bannerService: BannerService;
  private pityService: PityService;

  constructor() {
    this.gachaService = new GachaService();
    this.bannerService = new BannerService();
    this.pityService = new PityService();
  }

  executePull = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, bannerId, count } = req.body;

      if (!playerId || !bannerId) {
        res.status(400).json({
          success: false,
          error: 'playerId and bannerId are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const pullRequest: PullRequest = {
        playerId,
        bannerId,
        count: count || 1,
      };

      const result = await this.gachaService.executePull(pullRequest);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Pull execution failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  executeMultiPull = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, bannerId } = req.body;

      if (!playerId || !bannerId) {
        res.status(400).json({
          success: false,
          error: 'playerId and bannerId are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const banner = await this.bannerService.getBannerById(bannerId);
      if (!banner) {
        res.status(404).json({
          success: false,
          error: 'Banner not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const pullRequest: PullRequest = {
        playerId,
        bannerId,
        count: banner.multiPullCount,
      };

      const result = await this.gachaService.executePull(pullRequest);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Multi-pull execution failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getActiveBanners = async (_req: Request, res: Response): Promise<void> => {
    try {
      const banners = await this.bannerService.getActiveBanners();

      res.status(200).json({
        success: true,
        data: { banners, total: banners.length },
        timestamp: new Date().toISOString(),
      } as ApiResponse<{ banners: typeof banners; total: number }>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active banners',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getBannerById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bannerId } = req.params;

      const banner = await this.bannerService.getBannerById(bannerId);

      if (!banner) {
        res.status(404).json({
          success: false,
          error: 'Banner not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: banner,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof banner>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get banner',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getPullHistory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;
      const { bannerId, page, pageSize } = req.query;

      const history = await this.gachaService.getPullHistory(
        playerId,
        bannerId as string | undefined,
        page ? parseInt(page as string, 10) : 1,
        pageSize ? parseInt(pageSize as string, 10) : 20
      );

      res.status(200).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof history>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pull history',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getPityStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const pityStates = await this.gachaService.getPityStatus(playerId);

      res.status(200).json({
        success: true,
        data: pityStates,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof pityStates>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pity status',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getPityStatusForBanner = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, bannerId } = req.params;

      const banner = await this.bannerService.getBannerById(bannerId);
      if (!banner) {
        res.status(404).json({
          success: false,
          error: 'Banner not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const pityState = await this.pityService.getPityState(playerId, banner.type, bannerId);
      const pityCheck = await this.pityService.checkPity(playerId, banner.type, banner.pityConfig, bannerId);
      const progress = this.pityService.calculatePityProgress(pityState.pityCounter, banner.pityConfig);

      res.status(200).json({
        success: true,
        data: {
          pityState,
          pityCheck,
          progress,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pity status',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  simulatePulls = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bannerId } = req.params;
      const { count } = req.query;

      const simulationCount = count ? parseInt(count as string, 10) : 10000;

      const result = await this.gachaService.simulatePulls(bannerId, simulationCount);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Simulation failed',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  healthCheck = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'gacha-module',
        version: '1.0.0',
      },
      timestamp: new Date().toISOString(),
    });
  };
}
