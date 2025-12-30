import { PlayerInventoryRepository, ItemRepository } from '../repositories';
import { PlayerInventory } from '../models';
import { PlayerInventoryItem, Rarity } from '../types';

export interface InventoryItemWithDetails extends PlayerInventoryItem {
  itemName: string;
  itemRarity: Rarity;
  itemType: string;
  imageUrl?: string;
}

export class InventoryService {
  private inventoryRepository: PlayerInventoryRepository;
  private itemRepository: ItemRepository;

  constructor() {
    this.inventoryRepository = new PlayerInventoryRepository();
    this.itemRepository = new ItemRepository();
  }

  async addItem(
    playerId: string,
    itemId: string,
    obtainedFrom: string,
    quantity: number = 1,
    nftTokenId?: string,
    nftContractAddress?: string
  ): Promise<{ inventory: PlayerInventoryItem; isNew: boolean }> {
    const result = await this.inventoryRepository.addItem({
      playerId,
      itemId,
      quantity,
      obtainedFrom,
      nftTokenId,
      nftContractAddress,
    });

    return {
      inventory: this.toPlayerInventoryItem(result.inventory),
      isNew: result.isNew,
    };
  }

  async getInventory(playerId: string): Promise<InventoryItemWithDetails[]> {
    const inventory = await this.inventoryRepository.getInventory(playerId);
    const itemIds = inventory.map((inv) => inv.itemId);
    const items = await this.itemRepository.findByIds(itemIds);
    const itemMap = new Map(items.map((item) => [item.id, item]));

    return inventory.map((inv) => {
      const item = itemMap.get(inv.itemId);
      return {
        ...this.toPlayerInventoryItem(inv),
        itemName: item?.name || 'Unknown Item',
        itemRarity: item?.rarity || Rarity.COMMON,
        itemType: item?.type || 'UNKNOWN',
        imageUrl: item?.imageUrl,
      };
    });
  }

  async getInventoryByRarity(playerId: string, rarity: Rarity): Promise<InventoryItemWithDetails[]> {
    const fullInventory = await this.getInventory(playerId);
    return fullInventory.filter((item) => item.itemRarity === rarity);
  }

  async hasItem(playerId: string, itemId: string): Promise<boolean> {
    return this.inventoryRepository.hasItem(playerId, itemId);
  }

  async getItemQuantity(playerId: string, itemId: string): Promise<number> {
    return this.inventoryRepository.getItemQuantity(playerId, itemId);
  }

  async removeItem(playerId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    return this.inventoryRepository.removeItem(playerId, itemId, quantity);
  }

  async lockItem(playerId: string, itemId: string): Promise<PlayerInventoryItem | null> {
    const result = await this.inventoryRepository.setLocked(playerId, itemId, true);
    return result ? this.toPlayerInventoryItem(result) : null;
  }

  async unlockItem(playerId: string, itemId: string): Promise<PlayerInventoryItem | null> {
    const result = await this.inventoryRepository.setLocked(playerId, itemId, false);
    return result ? this.toPlayerInventoryItem(result) : null;
  }

  async setFavorite(playerId: string, itemId: string, favorite: boolean): Promise<PlayerInventoryItem | null> {
    const result = await this.inventoryRepository.setFavorite(playerId, itemId, favorite);
    return result ? this.toPlayerInventoryItem(result) : null;
  }

  async getInventoryStats(playerId: string): Promise<{
    uniqueItems: number;
    totalItems: number;
    rarityBreakdown: Record<Rarity, number>;
    nftCount: number;
  }> {
    const inventory = await this.getInventory(playerId);
    const nftItems = await this.inventoryRepository.getNFTItems(playerId);

    const rarityBreakdown: Record<Rarity, number> = {
      [Rarity.COMMON]: 0,
      [Rarity.RARE]: 0,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
      [Rarity.MYTHIC]: 0,
    };

    for (const item of inventory) {
      rarityBreakdown[item.itemRarity] += item.quantity;
    }

    return {
      uniqueItems: inventory.length,
      totalItems: inventory.reduce((sum, item) => sum + item.quantity, 0),
      rarityBreakdown,
      nftCount: nftItems.length,
    };
  }

  async getNFTItems(playerId: string): Promise<InventoryItemWithDetails[]> {
    const nftInventory = await this.inventoryRepository.getNFTItems(playerId);
    const itemIds = nftInventory.map((inv) => inv.itemId);
    const items = await this.itemRepository.findByIds(itemIds);
    const itemMap = new Map(items.map((item) => [item.id, item]));

    return nftInventory.map((inv) => {
      const item = itemMap.get(inv.itemId);
      return {
        ...this.toPlayerInventoryItem(inv),
        itemName: item?.name || 'Unknown Item',
        itemRarity: item?.rarity || Rarity.COMMON,
        itemType: item?.type || 'UNKNOWN',
        imageUrl: item?.imageUrl,
      };
    });
  }

  async checkDuplicates(playerId: string, itemId: string): Promise<{
    hasDuplicate: boolean;
    currentQuantity: number;
    duplicateCount: number;
  }> {
    const item = await this.inventoryRepository.getItem(playerId, itemId);
    
    if (!item) {
      return { hasDuplicate: false, currentQuantity: 0, duplicateCount: 0 };
    }

    return {
      hasDuplicate: item.quantity > 1 || item.duplicateCount > 0,
      currentQuantity: item.quantity,
      duplicateCount: item.duplicateCount,
    };
  }

  private toPlayerInventoryItem(inventory: PlayerInventory): PlayerInventoryItem {
    return {
      id: inventory.id,
      playerId: inventory.playerId,
      itemId: inventory.itemId,
      quantity: inventory.quantity,
      obtainedAt: inventory.firstObtainedAt,
      obtainedFrom: inventory.obtainedFrom,
      isLocked: inventory.isLocked,
      nftTokenId: inventory.nftTokenId || undefined,
    };
  }
}
