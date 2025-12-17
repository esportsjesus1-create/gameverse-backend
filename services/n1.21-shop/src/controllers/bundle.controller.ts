import { Request, Response, NextFunction } from 'express';
import { bundleService } from '../services';
import { CreateBundleDto, UpdateBundleDto, PaginationParams, ApiResponse, Bundle, BundleWithPricing, PaginatedResponse } from '../types';

export class BundleController {
  async create(
    req: Request<unknown, unknown, CreateBundleDto>,
    res: Response<ApiResponse<Bundle>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bundle = await bundleService.create(req.body);
      res.status(201).json({
        success: true,
        data: bundle,
        message: 'Bundle created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async findById(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<BundleWithPricing>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bundle = await bundleService.findByIdWithPricing(req.params.id);
      res.json({
        success: true,
        data: bundle,
      });
    } catch (error) {
      next(error);
    }
  }

  async findAll(
    req: Request,
    res: Response<ApiResponse<PaginatedResponse<BundleWithPricing>>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const queryParams = req.query as Record<string, string | undefined>;
      const params: PaginationParams = {
        page: Number(queryParams.page) || 1,
        limit: Number(queryParams.limit) || 20,
      };

      const result = await bundleService.findAll(params);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(
    req: Request<{ id: string }, unknown, UpdateBundleDto>,
    res: Response<ApiResponse<Bundle>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const bundle = await bundleService.update(req.params.id, req.body);
      res.json({
        success: true,
        data: bundle,
        message: 'Bundle updated successfully',
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
      await bundleService.delete(req.params.id);
      res.json({
        success: true,
        message: 'Bundle deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const bundleController = new BundleController();
