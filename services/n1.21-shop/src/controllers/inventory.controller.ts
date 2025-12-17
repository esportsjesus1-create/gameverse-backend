import { Request, Response, NextFunction } from 'express';
import { inventoryService } from '../services';
import {
  CreateInventoryDto,
  UpdateInventoryDto,
  ReserveInventoryDto,
  ReleaseInventoryDto,
  PaginationParams,
  ApiResponse,
  Inventory,
  InventoryHistory,
  PaginatedResponse,
  LowStockItem,
} from '../types';

export class InventoryController {
  async create(
    req: Request<unknown, unknown, CreateInventoryDto>,
    res: Response<ApiResponse<Inventory>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const inventory = await inventoryService.create(req.body);
      res.status(201).json({
        success: true,
        data: inventory,
        message: 'Inventory created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async findByItemId(
    req: Request<{ itemId: string }>,
    res: Response<ApiResponse<Inventory>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const inventory = await inventoryService.findByItemId(req.params.itemId);
      res.json({
        success: true,
        data: inventory,
      });
    } catch (error) {
      next(error);
    }
  }

  async findAll(
    req: Request,
    res: Response<ApiResponse<PaginatedResponse<Inventory & { itemName: string }>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const queryParams = req.query as Record<string, string | undefined>;
      const params: PaginationParams = {
        page: Number(queryParams.page) || 1,
        limit: Number(queryParams.limit) || 20,
      };

      const result = await inventoryService.findAll(params);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ itemId: string }, unknown, UpdateInventoryDto>,
    res: Response<ApiResponse<Inventory>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const inventory = await inventoryService.update(req.params.itemId, req.body);
      res.json({
        success: true,
        data: inventory,
        message: 'Inventory updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async reserve(
    req: Request<{ itemId: string }, unknown, ReserveInventoryDto>,
    res: Response<ApiResponse<Inventory>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const inventory = await inventoryService.reserve(req.params.itemId, req.body);
      res.json({
        success: true,
        data: inventory,
        message: 'Inventory reserved successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async release(
    req: Request<{ itemId: string }, unknown, ReleaseInventoryDto>,
    res: Response<ApiResponse<Inventory>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const inventory = await inventoryService.release(req.params.itemId, req.body);
      res.json({
        success: true,
        data: inventory,
        message: 'Inventory released successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getLowStockItems(
    _req: Request,
    res: Response<ApiResponse<LowStockItem[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const lowStockItems = await inventoryService.getLowStockItems();
      res.json({
        success: true,
        data: lowStockItems,
      });
    } catch (error) {
      next(error);
    }
  }

  async getHistory(
    req: Request<{ itemId: string }>,
    res: Response<ApiResponse<PaginatedResponse<InventoryHistory>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const queryParams = req.query as Record<string, string | undefined>;
      const params: PaginationParams = {
        page: Number(queryParams.page) || 1,
        limit: Number(queryParams.limit) || 50,
      };

      const result = await inventoryService.getHistory(req.params.itemId, params);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const inventoryController = new InventoryController();
