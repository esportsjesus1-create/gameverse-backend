import { Request, Response } from 'express';
import { GachaService, BannerService } from '../services';
import { ItemRepository } from '../repositories';
import {
  ApiResponse,
  PullResponse,
  BannerConfig,
  PlayerPityState,
  PullResult,
  CreateBannerRequest,
  CreateItemRequest,
} from '../types';
import { asyncHandler, NotFoundError, BadRequestError } from '../middleware';
import { Item } from '../models';

export class GachaController {
  private gachaService: GachaService;
  private bannerService: BannerService;
  private itemRepository: ItemRepository;

  constructor() {
    this.gachaService = new GachaService();
    this.bannerService = new BannerService();
    this.itemRepository = new ItemRepository();
  }

  executePull = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<PullResponse>>
    ): Promise<void> => {
      const { playerId, bannerId, count = 1 } = req.body as { playerId: string; bannerId: string; count?: number };

      const result = await this.gachaService.executePull({
        playerId,
        bannerId,
        count,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully executed ${count} pull(s)`,
      });
    }
  );

  executeMultiPull = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<PullResponse>>
    ): Promise<void> => {
      const { playerId, bannerId } = req.body as { playerId: string; bannerId: string };

      const result = await this.gachaService.executePull({
        playerId,
        bannerId,
        count: 10,
      });

      res.status(200).json({
        success: true,
        data: result,
        message: 'Successfully executed 10 pulls',
      });
    }
  );

  getActiveBanners = asyncHandler(
    async (
      _req: Request,
      res: Response<ApiResponse<{ banners: BannerConfig[]; total: number }>>
    ): Promise<void> => {
      const banners = await this.bannerService.getActiveBanners();

      res.status(200).json({
        success: true,
        data: {
          banners,
          total: banners.length,
        },
      });
    }
  );

  getBannerById = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<BannerConfig>>
    ): Promise<void> => {
      const { id } = req.params;

      const banner = await this.bannerService.getBannerById(id);
      if (!banner) {
        throw new NotFoundError('Banner not found');
      }

      res.status(200).json({
        success: true,
        data: banner,
      });
    }
  );

  getPullHistory = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<{ history: PullResult[]; total: number; page: number; pageSize: number }>>
    ): Promise<void> => {
      const { playerId } = req.params;
      const page = parseInt((req.query.page as string) || '1', 10);
      const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
      const bannerId = req.query.bannerId as string | undefined;

      const result = await this.gachaService.getPullHistory(
        playerId,
        bannerId,
        page,
        pageSize
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    }
  );

  getPityStatus = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<{ pityStates: PlayerPityState[] }>>
    ): Promise<void> => {
      const { playerId } = req.params;

      const pityStates = await this.gachaService.getPityStatus(playerId);

      res.status(200).json({
        success: true,
        data: { pityStates },
      });
    }
  );

  createBanner = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<BannerConfig>>
    ): Promise<void> => {
      const banner = await this.bannerService.createBanner(req.body as CreateBannerRequest);

      res.status(201).json({
        success: true,
        data: banner,
        message: 'Banner created successfully',
      });
    }
  );

  updateBanner = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<BannerConfig>>
    ): Promise<void> => {
      const { id } = req.params;

      const banner = await this.bannerService.updateBanner(id, req.body as Partial<CreateBannerRequest>);
      if (!banner) {
        throw new NotFoundError('Banner not found');
      }

      res.status(200).json({
        success: true,
        data: banner,
        message: 'Banner updated successfully',
      });
    }
  );

  deleteBanner = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<null>>
    ): Promise<void> => {
      const { id } = req.params;

      const deleted = await this.bannerService.deleteBanner(id);
      if (!deleted) {
        throw new NotFoundError('Banner not found');
      }

      res.status(200).json({
        success: true,
        message: 'Banner deleted successfully',
      });
    }
  );

  createItem = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<Item>>
    ): Promise<void> => {
      const item = await this.itemRepository.create(req.body as CreateItemRequest);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item created successfully',
      });
    }
  );

  getItems = asyncHandler(
    async (
      _req: Request,
      res: Response<ApiResponse<{ items: Item[] }>>
    ): Promise<void> => {
      const items = await this.itemRepository.findActive();

      res.status(200).json({
        success: true,
        data: { items },
      });
    }
  );

  updateItem = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<Item>>
    ): Promise<void> => {
      const { id } = req.params;

      const item = await this.itemRepository.update(id, req.body as Partial<CreateItemRequest>);
      if (!item) {
        throw new NotFoundError('Item not found');
      }

      res.status(200).json({
        success: true,
        data: item,
        message: 'Item updated successfully',
      });
    }
  );

  deleteItem = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<null>>
    ): Promise<void> => {
      const { id } = req.params;

      const deleted = await this.itemRepository.delete(id);
      if (!deleted) {
        throw new NotFoundError('Item not found');
      }

      res.status(200).json({
        success: true,
        message: 'Item deleted successfully',
      });
    }
  );

  simulatePulls = asyncHandler(
    async (
      req: Request,
      res: Response<ApiResponse<{ rarityDistribution: Record<string, number>; featuredCount: number }>>
    ): Promise<void> => {
      const { bannerId, count } = req.body as { bannerId: string; count: number };

      if (count < 1 || count > 100000) {
        throw new BadRequestError('Simulation count must be between 1 and 100000');
      }

      const result = await this.gachaService.simulatePulls(bannerId, count);

      res.status(200).json({
        success: true,
        data: result,
      });
    }
  );

  healthCheck = asyncHandler(
    async (
      _req: Request,
      res: Response<ApiResponse<{ status: string; timestamp: string }>>
    ): Promise<void> => {
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
        },
      });
    }
  );
}
