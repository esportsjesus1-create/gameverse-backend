import { Repository } from 'typeorm';
import { PlayerInventory } from '../models';
import { getDataSource } from '../config/database';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export interface AddInventoryItem {
  playerId: string;
  itemId: string;
  quantity?: number;
  obtainedFrom: string;
  nftTokenId?: string;
  nftContractAddress?: string;
  metadata?: Record<string, unknown>;
}

export class PlayerInventoryRepository {
  private repository: Repository<PlayerInventory>;

  constructor() {
    this.repository = getDataSource().getRepository(PlayerInventory);
  }

  async addItem(data: AddInventoryItem): Promise<{ inventory: PlayerInventory; isNew: boolean }> {
    const existing = await this.repository.findOne({
      where: { playerId: data.playerId, itemId: data.itemId },
    });

    if (existing) {
      existing.quantity += data.quantity || 1;
      existing.duplicateCount += 1;
      existing.lastObtainedAt = new Date();
      if (data.nftTokenId) existing.nftTokenId = data.nftTokenId;
      if (data.nftContractAddress) existing.nftContractAddress = data.nftContractAddress;

      const saved = await this.repository.save(existing);
      await this.invalidateCache(data.playerId);
      return { inventory: saved, isNew: false };
    }

    const inventory = this.repository.create({
      playerId: data.playerId,
      itemId: data.itemId,
      quantity: data.quantity || 1,
      duplicateCount: 0,
      firstObtainedAt: new Date(),
      lastObtainedAt: new Date(),
      obtainedFrom: data.obtainedFrom,
      isLocked: false,
      isFavorite: false,
      nftTokenId: data.nftTokenId,
      nftContractAddress: data.nftContractAddress,
      metadata: data.metadata,
    });

    const saved = await this.repository.save(inventory);
    await this.invalidateCache(data.playerId);
    return { inventory: saved, isNew: true };
  }

  async getInventory(playerId: string): Promise<PlayerInventory[]> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerInventory(playerId);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PlayerInventory[];
        return parsed.map((item) => ({
          ...item,
          firstObtainedAt: new Date(item.firstObtainedAt),
          lastObtainedAt: new Date(item.lastObtainedAt),
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        }));
      }
    } catch {
      // Cache miss or error, continue to database
    }

    const inventory = await this.repository.find({
      where: { playerId },
      order: { lastObtainedAt: 'DESC' },
    });

    await redis.setex(cacheKey, REDIS_TTL.inventory, JSON.stringify(inventory));
    return inventory;
  }

  async getItem(playerId: string, itemId: string): Promise<PlayerInventory | null> {
    return this.repository.findOne({
      where: { playerId, itemId },
    });
  }

  async hasItem(playerId: string, itemId: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { playerId, itemId },
    });
    return count > 0;
  }

  async getItemQuantity(playerId: string, itemId: string): Promise<number> {
    const item = await this.getItem(playerId, itemId);
    return item?.quantity || 0;
  }

  async updateQuantity(
    playerId: string,
    itemId: string,
    quantity: number
  ): Promise<PlayerInventory | null> {
    const item = await this.getItem(playerId, itemId);
    if (!item) return null;

    item.quantity = quantity;
    const saved = await this.repository.save(item);
    await this.invalidateCache(playerId);
    return saved;
  }

  async removeItem(playerId: string, itemId: string, quantity: number = 1): Promise<boolean> {
    const item = await this.getItem(playerId, itemId);
    if (!item || item.quantity < quantity) return false;

    if (item.quantity === quantity) {
      await this.repository.remove(item);
    } else {
      item.quantity -= quantity;
      await this.repository.save(item);
    }

    await this.invalidateCache(playerId);
    return true;
  }

  async setLocked(playerId: string, itemId: string, locked: boolean): Promise<PlayerInventory | null> {
    const item = await this.getItem(playerId, itemId);
    if (!item) return null;

    item.isLocked = locked;
    const saved = await this.repository.save(item);
    await this.invalidateCache(playerId);
    return saved;
  }

  async setFavorite(playerId: string, itemId: string, favorite: boolean): Promise<PlayerInventory | null> {
    const item = await this.getItem(playerId, itemId);
    if (!item) return null;

    item.isFavorite = favorite;
    const saved = await this.repository.save(item);
    await this.invalidateCache(playerId);
    return saved;
  }

  async countUniqueItems(playerId: string): Promise<number> {
    return this.repository.count({ where: { playerId } });
  }

  async countTotalItems(playerId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('inventory')
      .select('SUM(inventory.quantity)', 'total')
      .where('inventory.playerId = :playerId', { playerId })
      .getRawOne();

    return parseInt(result?.total || '0', 10);
  }

  async getNFTItems(playerId: string): Promise<PlayerInventory[]> {
    return this.repository.find({
      where: { playerId },
    }).then((items) => items.filter((item) => item.nftTokenId !== null));
  }

  private async invalidateCache(playerId: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.playerInventory(playerId);
    await redis.del(cacheKey);
  }
}
