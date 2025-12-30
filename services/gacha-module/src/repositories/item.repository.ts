import { Repository, In } from 'typeorm';
import { Item } from '../models';
import { getDataSource } from '../config/database';
import { Rarity, ItemType, CreateItemRequest } from '../types';

export class ItemRepository {
  private repository: Repository<Item>;

  constructor() {
    this.repository = getDataSource().getRepository(Item);
  }

  async create(data: CreateItemRequest): Promise<Item> {
    const item = this.repository.create({
      ...data,
      isActive: true,
    });
    return this.repository.save(item);
  }

  async findById(id: string): Promise<Item | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<Item[]> {
    if (ids.length === 0) return [];
    return this.repository.find({
      where: { id: In(ids), isActive: true },
    });
  }

  async findByIdsAndRarity(ids: string[], rarity: Rarity): Promise<Item[]> {
    if (ids.length === 0) return [];
    return this.repository.find({
      where: { id: In(ids), rarity, isActive: true },
    });
  }

  async findByRarity(rarity: Rarity): Promise<Item[]> {
    return this.repository.find({
      where: { rarity, isActive: true },
    });
  }

  async findByType(type: ItemType): Promise<Item[]> {
    return this.repository.find({
      where: { type, isActive: true },
    });
  }

  async findActive(): Promise<Item[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { rarity: 'DESC', name: 'ASC' },
    });
  }

  async findAll(): Promise<Item[]> {
    return this.repository.find({
      order: { rarity: 'DESC', name: 'ASC' },
    });
  }

  async findNFTItems(): Promise<Item[]> {
    return this.repository.find({
      where: { isNFT: true, isActive: true },
    });
  }

  async update(id: string, data: Partial<CreateItemRequest>): Promise<Item | null> {
    const item = await this.findById(id);
    if (!item) return null;

    Object.assign(item, data);
    return this.repository.save(item);
  }

  async delete(id: string): Promise<boolean> {
    const item = await this.findById(id);
    if (!item) return false;

    item.isActive = false;
    await this.repository.save(item);
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(): Promise<number> {
    return this.repository.count({ where: { isActive: true } });
  }

  async countByRarity(rarity: Rarity): Promise<number> {
    return this.repository.count({ where: { rarity, isActive: true } });
  }
}
