import { Repository } from 'typeorm';
import { DropRateDisclosure } from '../models';
import { getDataSource } from '../config/database';
import { RarityRates } from '../types';
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from '../config/redis';

export interface CreateDropRateDisclosure {
  bannerId: string;
  bannerName: string;
  rates: RarityRates;
  featuredRate: number;
  pitySystem: {
    softPityStart: number;
    hardPity: number;
    softPityRateIncrease: number;
    guaranteedFeatured: boolean;
  };
  featuredItems: Array<{
    id: string;
    name: string;
    rarity: string;
    individualRate: number;
  }>;
  poolItems: Array<{
    id: string;
    name: string;
    rarity: string;
    individualRate: number;
  }>;
  legalDisclaimer?: string;
  regulatoryRegion?: string;
}

export class DropRateDisclosureRepository {
  private repository: Repository<DropRateDisclosure>;

  constructor() {
    this.repository = getDataSource().getRepository(DropRateDisclosure);
  }

  async create(data: CreateDropRateDisclosure): Promise<DropRateDisclosure> {
    const existing = await this.findByBanner(data.bannerId);
    
    if (existing) {
      existing.isActive = false;
      await this.repository.save(existing);
    }

    const disclosure = this.repository.create({
      ...data,
      isActive: true,
      version: existing ? existing.version + 1 : 1,
    });

    const saved = await this.repository.save(disclosure);
    await this.updateCache(data.bannerId, saved);
    return saved;
  }

  async findById(id: string): Promise<DropRateDisclosure | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByBanner(bannerId: string): Promise<DropRateDisclosure | null> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.dropRates(bannerId);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          updatedAt: new Date(parsed.updatedAt),
        } as DropRateDisclosure;
      }
    } catch {
      // Cache miss or error, continue to database
    }

    const disclosure = await this.repository.findOne({
      where: { bannerId, isActive: true },
      order: { version: 'DESC' },
    });

    if (disclosure) {
      await redis.setex(cacheKey, REDIS_TTL.dropRates, JSON.stringify(disclosure));
    }

    return disclosure;
  }

  async findAllActive(): Promise<DropRateDisclosure[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { bannerName: 'ASC' },
    });
  }

  async findVersionHistory(bannerId: string): Promise<DropRateDisclosure[]> {
    return this.repository.find({
      where: { bannerId },
      order: { version: 'DESC' },
    });
  }

  async update(
    bannerId: string,
    data: Partial<CreateDropRateDisclosure>
  ): Promise<DropRateDisclosure | null> {
    const disclosure = await this.findByBanner(bannerId);
    if (!disclosure) return null;

    if (data.bannerName !== undefined) disclosure.bannerName = data.bannerName;
    if (data.rates !== undefined) disclosure.rates = data.rates;
    if (data.featuredRate !== undefined) disclosure.featuredRate = data.featuredRate;
    if (data.pitySystem !== undefined) disclosure.pitySystem = data.pitySystem;
    if (data.featuredItems !== undefined) disclosure.featuredItems = data.featuredItems;
    if (data.poolItems !== undefined) disclosure.poolItems = data.poolItems;
    if (data.legalDisclaimer !== undefined) disclosure.legalDisclaimer = data.legalDisclaimer ?? '';
    if (data.regulatoryRegion !== undefined) disclosure.regulatoryRegion = data.regulatoryRegion ?? '';

    const saved = await this.repository.save(disclosure);
    await this.updateCache(bannerId, saved);
    return saved;
  }

  async deactivate(bannerId: string): Promise<boolean> {
    const disclosure = await this.findByBanner(bannerId);
    if (!disclosure) return false;

    disclosure.isActive = false;
    await this.repository.save(disclosure);
    await this.invalidateCache(bannerId);
    return true;
  }

  private async updateCache(bannerId: string, disclosure: DropRateDisclosure): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.dropRates(bannerId);
    await redis.setex(cacheKey, REDIS_TTL.dropRates, JSON.stringify(disclosure));
  }

  async invalidateCache(bannerId: string): Promise<void> {
    const redis = getRedisClient();
    const cacheKey = REDIS_KEYS.dropRates(bannerId);
    await redis.del(cacheKey);
  }
}
