import { Repository } from 'typeorm';
import { Pool } from '../models';
import { getDataSource } from '../config/database';
import { CreatePoolRequest, Rarity } from '../types';
import { config } from '../config';

export class PoolRepository {
  private repository: Repository<Pool>;

  constructor() {
    this.repository = getDataSource().getRepository(Pool);
  }

  async create(data: CreatePoolRequest): Promise<Pool> {
    const pool = this.repository.create({
      name: data.name,
      description: data.description,
      items: data.items,
      rarityWeights: data.rarityWeights || config.gacha.defaultRates,
      isActive: true,
    });
    return this.repository.save(pool);
  }

  async findById(id: string): Promise<Pool | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findActive(): Promise<Pool[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findAll(): Promise<Pool[]> {
    return this.repository.find({
      order: { name: 'ASC' },
    });
  }

  async update(id: string, data: Partial<CreatePoolRequest>): Promise<Pool | null> {
    const pool = await this.findById(id);
    if (!pool) return null;

    if (data.name !== undefined) pool.name = data.name;
    if (data.description !== undefined) pool.description = data.description ?? '';
    if (data.items !== undefined) pool.items = data.items;
    if (data.rarityWeights !== undefined) {
      pool.rarityWeights = {
        [Rarity.COMMON]: data.rarityWeights[Rarity.COMMON] ?? pool.rarityWeights[Rarity.COMMON],
        [Rarity.RARE]: data.rarityWeights[Rarity.RARE] ?? pool.rarityWeights[Rarity.RARE],
        [Rarity.EPIC]: data.rarityWeights[Rarity.EPIC] ?? pool.rarityWeights[Rarity.EPIC],
        [Rarity.LEGENDARY]: data.rarityWeights[Rarity.LEGENDARY] ?? pool.rarityWeights[Rarity.LEGENDARY],
        [Rarity.MYTHIC]: data.rarityWeights[Rarity.MYTHIC] ?? pool.rarityWeights[Rarity.MYTHIC],
      };
    }

    return this.repository.save(pool);
  }

  async addItems(id: string, itemIds: string[]): Promise<Pool | null> {
    const pool = await this.findById(id);
    if (!pool) return null;

    const uniqueItems = [...new Set([...pool.items, ...itemIds])];
    pool.items = uniqueItems;
    return this.repository.save(pool);
  }

  async removeItems(id: string, itemIds: string[]): Promise<Pool | null> {
    const pool = await this.findById(id);
    if (!pool) return null;

    pool.items = pool.items.filter((item) => !itemIds.includes(item));
    return this.repository.save(pool);
  }

  async delete(id: string): Promise<boolean> {
    const pool = await this.findById(id);
    if (!pool) return false;

    pool.isActive = false;
    await this.repository.save(pool);
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
