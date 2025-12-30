import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { ApiResponse, Rarity } from '../types';

export class InventoryController {
  private inventoryService: InventoryService;

  constructor() {
    this.inventoryService = new InventoryService();
  }

  getInventory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;
      const { rarity } = req.query;

      let inventory;

      if (rarity) {
        if (!Object.values(Rarity).includes(rarity as Rarity)) {
          res.status(400).json({
            success: false,
            error: `Invalid rarity. Must be one of: ${Object.values(Rarity).join(', ')}`,
            timestamp: new Date().toISOString(),
          } as ApiResponse<null>);
          return;
        }

        inventory = await this.inventoryService.getInventoryByRarity(playerId, rarity as Rarity);
      } else {
        inventory = await this.inventoryService.getInventory(playerId);
      }

      res.status(200).json({
        success: true,
        data: { items: inventory, total: inventory.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get inventory',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getInventoryStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const stats = await this.inventoryService.getInventoryStats(playerId);

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof stats>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get inventory stats',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  getNFTItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId } = req.params;

      const nftItems = await this.inventoryService.getNFTItems(playerId);

      res.status(200).json({
        success: true,
        data: { items: nftItems, total: nftItems.length },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get NFT items',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  lockItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, itemId } = req.params;

      const item = await this.inventoryService.lockItem(playerId, itemId);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found in inventory',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
        message: 'Item locked successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof item>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lock item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  unlockItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, itemId } = req.params;

      const item = await this.inventoryService.unlockItem(playerId, itemId);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found in inventory',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
        message: 'Item unlocked successfully',
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof item>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlock item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  setFavorite = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, itemId } = req.params;
      const { favorite } = req.body;

      if (typeof favorite !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'favorite must be a boolean',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      const item = await this.inventoryService.setFavorite(playerId, itemId, favorite);

      if (!item) {
        res.status(404).json({
          success: false,
          error: 'Item not found in inventory',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        data: item,
        message: `Item ${favorite ? 'added to' : 'removed from'} favorites`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof item>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update favorite status',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  discardItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, itemId } = req.params;
      const { quantity } = req.body;

      const discardQuantity = quantity || 1;

      const success = await this.inventoryService.removeItem(playerId, itemId, discardQuantity);

      if (!success) {
        res.status(400).json({
          success: false,
          error: 'Failed to discard item. Item not found or insufficient quantity.',
          timestamp: new Date().toISOString(),
        } as ApiResponse<null>);
        return;
      }

      res.status(200).json({
        success: true,
        message: `Discarded ${discardQuantity} item(s) successfully`,
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to discard item',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };

  checkDuplicates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { playerId, itemId } = req.params;

      const duplicateInfo = await this.inventoryService.checkDuplicates(playerId, itemId);

      res.status(200).json({
        success: true,
        data: duplicateInfo,
        timestamp: new Date().toISOString(),
      } as ApiResponse<typeof duplicateInfo>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check duplicates',
        timestamp: new Date().toISOString(),
      } as ApiResponse<null>);
    }
  };
}
