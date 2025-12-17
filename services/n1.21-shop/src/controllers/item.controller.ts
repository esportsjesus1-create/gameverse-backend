import { Request, Response, NextFunction } from 'express';
import { itemService } from '../services';
import { CreateItemDto, UpdateItemDto, SearchParams, ApiResponse, Item, PaginatedResponse } from '../types';

export class ItemController {
  async create(
    req: Request<unknown, unknown, CreateItemDto>,
    res: Response<ApiResponse<Item>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const item = await itemService.create(req.body);
      res.status(201).json({
        success: true,
        data: item,
        message: 'Item created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<Item>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const item = await itemService.findById(req.params.id);
      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async findAll(
    req: Request,
    res: Response<ApiResponse<PaginatedResponse<Item>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const queryParams = req.query as Record<string, string | undefined>;
      const params: SearchParams = {
        page: Number(queryParams.page) || 1,
        limit: Number(queryParams.limit) || 20,
        query: queryParams.query,
        category: queryParams.category,
        minPrice: queryParams.minPrice ? Number(queryParams.minPrice) : undefined,
        maxPrice: queryParams.maxPrice ? Number(queryParams.maxPrice) : undefined,
        isActive: queryParams.isActive !== undefined ? queryParams.isActive === 'true' : undefined,
      };

      const result = await itemService.findAll(params);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, unknown, UpdateItemDto>,
    res: Response<ApiResponse<Item>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const item = await itemService.update(req.params.id, req.body);
      res.json({
        success: true,
        data: item,
        message: 'Item updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<null>>,
    next: NextFunction
  ): Promise<void> {
    try {
      await itemService.delete(req.params.id);
      res.json({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getCategories(
    _req: Request,
    res: Response<ApiResponse<string[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const categories = await itemService.getCategories();
      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const itemController = new ItemController();
