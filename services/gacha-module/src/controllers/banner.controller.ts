import { Request, Response } from 'express';
import { BannerService } from '../services/banner.service';
import { DropRateService } from '../services/drop-rate.service';
import { ApiResponse, CreateBannerRequest, BannerType } from '../types';

export class BannerController {
  private bannerService: BannerService;
  private dropRateService: DropRateService;

  constructor() {
    this.bannerService = new BannerService();
    this.dropRateService = new DropRateService();
  }

  createBanner = async (req: Request, res: Response): Promise<void> => {
    try {
      const bannerData: CreateBannerRequest = req.body;

      if (!bannerData.name || !bannerData.type || !bannerData.startDate || !bannerData.pullCost) {
        res.status(400).json({
          success: false,
          error: 'name, type, startDate, and pullCost are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (!bannerData.featuredItems || !bannerData.itemPool) {
        res.status(400).json({
          success: false,
          error: 'featuredItems and itemPool are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const banner = await this.bannerService.createBanner(bannerData);

      res.status(201).json({
        success: true,
        data: banner,
        message: 'Banner created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof banner>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create banner',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getBanner = async (req: Request, res: Response): Promise<void> => {
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

  getActiveBanners = async (_req: Request, res: Response): Promise<void> => {
    try {
      const banners = await this.bannerService.getActiveBanners();

      res.status(200).json({
        success: true,
        data: { banners, total: banners.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get active banners',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getBannersByType = async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.params;

      if (!Object.values(BannerType).includes(type as BannerType)) {
        res.status(400).json({
          success: false,
          error: `Invalid banner type. Must be one of: ${Object.values(BannerType).join(', ')}`,
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const banners = await this.bannerService.getBannersByType(type as BannerType);

      res.status(200).json({
        success: true,
        data: { banners, total: banners.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get banners by type',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getAllBanners = async (_req: Request, res: Response): Promise<void> => {
    try {
      const banners = await this.bannerService.getAllBanners();

      res.status(200).json({
        success: true,
        data: { banners, total: banners.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all banners',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  updateBanner = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bannerId } = req.params;
      const updateData: Partial<CreateBannerRequest> = req.body;

      const banner = await this.bannerService.updateBanner(bannerId, updateData);

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
        message: 'Banner updated successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof banner>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update banner',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  deleteBanner = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bannerId } = req.params;

      const deleted = await this.bannerService.deleteBanner(bannerId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Banner not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Banner deleted successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete banner',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getDropRates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { bannerId } = req.params;

      const disclosure = await this.dropRateService.getDropRateDisclosure(bannerId);

      if (!disclosure) {
        res.status(404).json({
          success: false,
          error: 'Drop rate disclosure not found or not enabled',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const formatted = this.dropRateService.formatDropRatesForDisplay(disclosure);

      res.status(200).json({
        success: true,
        data: {
          disclosure,
          formatted,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get drop rates',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getAllDropRates = async (_req: Request, res: Response): Promise<void> => {
    try {
      const disclosures = await this.dropRateService.getAllDropRateDisclosures();

      res.status(200).json({
        success: true,
        data: { disclosures, total: disclosures.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get all drop rates',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };
}
