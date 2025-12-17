import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Banner } from '../models';
import { BannerType } from '../types';

export class BannerRepository {
  private repository: Repository<Banner>;

  constructor() {
    this.repository = AppDataSource.getRepository(Banner);
  }

  async findById(id: string): Promise<Banner | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByType(type: BannerType): Promise<Banner[]> {
    return this.repository.find({ where: { type, isActive: true } });
  }

  async findActive(): Promise<Banner[]> {
    const now = new Date();
    return this.repository.find({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: Or(MoreThanOrEqual(now), IsNull()),
      },
      order: { startDate: 'DESC' },
    });
  }

  async findActiveByType(type: BannerType): Promise<Banner[]> {
    const now = new Date();
    return this.repository.find({
      where: {
        type,
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: Or(MoreThanOrEqual(now), IsNull()),
      },
      order: { startDate: 'DESC' },
    });
  }

  async create(data: Partial<Banner>): Promise<Banner> {
    const banner = this.repository.create(data);
    return this.repository.save(banner);
  }

  async update(id: string, data: Partial<Banner>): Promise<Banner | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  async findAll(): Promise<Banner[]> {
    return this.repository.find({ order: { createdAt: 'DESC' } });
  }
}
