import { Request, Response } from 'express';
import { ItemRepository, PoolRepository } from '../repositories';
import { ApiResponse, CreateItemRequest, CreatePoolRequest, Rarity, ItemType } from '../types';

export class ItemController {
  private itemRepository: ItemRepository;
  private poolRepository: PoolRepository;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.poolRepository = new PoolRepository();
  }

  createItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const itemData: CreateItemRequest = req.body;

      if (!itemData.name || !itemData.rarity || !itemData.type) {
        res.status(400).json({
          success: false,
          error: 'name, rarity, and type are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (!Object.values(Rarity).includes(itemData.rarity)) {
        res.status(400).json({
          success: false,
          error: `Invalid rarity. Must be one of: ${Object.values(Rarity).join(', ')}`,
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      if (!Object.values(ItemType).includes(itemData.type)) {
        res.status(400).json({
          success: false,
          error: `Invalid type. Must be one of: ${Object.values(ItemType).join(', ')}`,
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const item = await this.itemRepository.create(itemData);

      res.status(201).json({
        success: true,
        data: item,
        message: 'Item created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof item>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemId } = req.params;

      const item = await this.itemRepository.findById(itemId);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof item>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getAllItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const { rarity, type, active } = req.query;

      let items;

      if (active === 'true') {
        items = await this.itemRepository.findActive();
      } else {
        items = await this.itemRepository.findAll();
      }

      if (rarity) {
        items = items.filter((item) => item.rarity === rarity);
      }

      if (type) {
        items = items.filter((item) => item.type === type);
      }

      res.status(200).json({
        success: true,
        data: { items, total: items.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get items',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  updateItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemId } = req.params;
      const updateData: Partial<CreateItemRequest> = req.body;

      const item = await this.itemRepository.update(itemId, updateData);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
        message: 'Item updated successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof item>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  deleteItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemId } = req.params;

      const deleted = await this.itemRepository.delete(itemId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Item not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Item deleted successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  createPool = async (req: Request, res: Response): Promise<void> => {
    try {
      const poolData: CreatePoolRequest = req.body;

      if (!poolData.name || !poolData.items) {
        res.status(400).json({
          success: false,
          error: 'name and items are required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const pool = await this.poolRepository.create(poolData);

      res.status(201).json({
        success: true,
        data: pool,
        message: 'Pool created successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof pool>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pool',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getPool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;

      const pool = await this.poolRepository.findById(poolId);

      if (!pool) {
        res.status(404).json({
          success: false,
          error: 'Pool not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: pool,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof pool>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pool',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getAllPools = async (_req: Request, res: Response): Promise<void> => {
    try {
      const pools = await this.poolRepository.findAll();

      res.status(200).json({
        success: true,
        data: { pools, total: pools.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get pools',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  updatePool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;
      const updateData: Partial<CreatePoolRequest> = req.body;

      const pool = await this.poolRepository.update(poolId, updateData);

      if (!pool) {
        res.status(404).json({
          success: false,
          error: 'Pool not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: pool,
        message: 'Pool updated successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof pool>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update pool',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  deletePool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;

      const deleted = await this.poolRepository.delete(poolId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Pool not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Pool deleted successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete pool',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  addItemsToPool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;
      const { itemIds } = req.body;

      if (!itemIds || !Array.isArray(itemIds)) {
        res.status(400).json({
          success: false,
          error: 'itemIds array is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const pool = await this.poolRepository.addItems(poolId, itemIds);

      if (!pool) {
        res.status(404).json({
          success: false,
          error: 'Pool not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: pool,
        message: 'Items added to pool successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof pool>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add items to pool',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  removeItemsFromPool = async (req: Request, res: Response): Promise<void> => {
    try {
      const { poolId } = req.params;
      const { itemIds } = req.body;

      if (!itemIds || !Array.isArray(itemIds)) {
        res.status(400).json({
          success: false,
          error: 'itemIds array is required',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const pool = await this.poolRepository.removeItems(poolId, itemIds);

      if (!pool) {
        res.status(404).json({
          success: false,
          error: 'Pool not found',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: pool,
        message: 'Items removed from pool successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof pool>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove items from pool',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };
}
