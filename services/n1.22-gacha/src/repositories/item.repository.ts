import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Item } from '../models';
import { Rarity, ItemType } from '../types';

export class ItemRepository {
  private repository: Repository<Item>;

  constructor() {
    this.repository = AppDataSource.getRepository(Item);
  }

  async findById(id: string): Promise<Item | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<Item[]> {
    return this.repository.findByIds(ids);
  }

  async findByRarity(rarity: Rarity): Promise<Item[]> {
    return this.repository.find({ where: { rarity, isActive: true } });
  }

  async findByType(type: ItemType): Promise<Item[]> {
    return this.repository.find({ where: { type, isActive: true } });
  }

  async findActive(): Promise<Item[]> {
    return this.repository.find({ where: { isActive: true } });
  }

  async create(data: Partial<Item>): Promise<Item> {
    const item = this.repository.create(data);
    return this.repository.save(item);
  }

  async update(id: string, data: Partial<Item>): Promise<Item | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    Object.assign(existing, data);
    return this.repository.save(existing);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  async findByIdsAndRarity(ids: string[], rarity: Rarity): Promise<Item[]> {
    return this.repository
      .createQueryBuilder('item')
      .where('item.id IN (:...ids)', { ids })
      .andWhere('item.rarity = :rarity', { rarity })
      .andWhere('item.isActive = true')
      .getMany();
  }
}
