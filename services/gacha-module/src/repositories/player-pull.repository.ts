import { Repository, Between } from 'typeorm';
import { PlayerPull } from '../models';
import { getDataSource } from '../config/database';
import { Rarity, CurrencyType, ItemType } from '../types';

export interface CreatePullRecord {
  playerId: string;
  bannerId: string;
  bannerName: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  rarity: Rarity;
  isFeatured: boolean;
  pityCount: number;
  isGuaranteed: boolean;
  isSoftPity: boolean;
  isHardPity: boolean;
  cost: number;
  currencyType: CurrencyType;
  nftTokenId?: string;
  nftTransactionHash?: string;
  metadata?: Record<string, unknown>;
}

export interface PullHistoryQuery {
  playerId: string;
  bannerId?: string;
  rarity?: Rarity;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export class PlayerPullRepository {
  private repository: Repository<PlayerPull>;

  constructor() {
    this.repository = getDataSource().getRepository(PlayerPull);
  }

  async create(data: CreatePullRecord): Promise<PlayerPull> {
    const pull = this.repository.create(data);
    return this.repository.save(pull);
  }

  async createMany(records: CreatePullRecord[]): Promise<PlayerPull[]> {
    const pulls = records.map((record) => this.repository.create(record));
    return this.repository.save(pulls);
  }

  async findById(id: string): Promise<PlayerPull | null> {
    return this.repository.findOne({ where: { id } });
  }

  async getHistory(query: PullHistoryQuery): Promise<{ pulls: PlayerPull[]; total: number }> {
    const { playerId, bannerId, rarity, startDate, endDate, page = 1, pageSize = 20 } = query;

    const whereClause: Record<string, unknown> = { playerId };
    if (bannerId) whereClause.bannerId = bannerId;
    if (rarity) whereClause.rarity = rarity;
    if (startDate && endDate) {
      whereClause.timestamp = Between(startDate, endDate);
    }

    const [pulls, total] = await this.repository.findAndCount({
      where: whereClause,
      order: { timestamp: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { pulls, total };
  }

  async getRecentPulls(playerId: string, limit: number = 10): Promise<PlayerPull[]> {
    return this.repository.find({
      where: { playerId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getPullsByBanner(bannerId: string, limit: number = 100): Promise<PlayerPull[]> {
    return this.repository.find({
      where: { bannerId },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async countByPlayer(playerId: string): Promise<number> {
    return this.repository.count({ where: { playerId } });
  }

  async countByPlayerAndBanner(playerId: string, bannerId: string): Promise<number> {
    return this.repository.count({ where: { playerId, bannerId } });
  }

  async countByPlayerToday(playerId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.repository.count({
      where: {
        playerId,
        timestamp: Between(today, tomorrow),
      },
    });
  }

  async getRarityDistribution(playerId: string): Promise<Record<Rarity, number>> {
    const result = await this.repository
      .createQueryBuilder('pull')
      .select('pull.rarity', 'rarity')
      .addSelect('COUNT(*)', 'count')
      .where('pull.playerId = :playerId', { playerId })
      .groupBy('pull.rarity')
      .getRawMany();

    const distribution: Record<Rarity, number> = {
      [Rarity.COMMON]: 0,
      [Rarity.RARE]: 0,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
      [Rarity.MYTHIC]: 0,
    };

    for (const row of result) {
      distribution[row.rarity as Rarity] = parseInt(row.count, 10);
    }

    return distribution;
  }

  async getBannerStatistics(bannerId: string): Promise<{
    totalPulls: number;
    uniquePlayers: number;
    rarityDistribution: Record<Rarity, number>;
    featuredCount: number;
    pityTriggerCount: number;
  }> {
    const totalPulls = await this.repository.count({ where: { bannerId } });

    const uniquePlayersResult = await this.repository
      .createQueryBuilder('pull')
      .select('COUNT(DISTINCT pull.playerId)', 'count')
      .where('pull.bannerId = :bannerId', { bannerId })
      .getRawOne();
    const uniquePlayers = parseInt(uniquePlayersResult?.count || '0', 10);

    const rarityResult = await this.repository
      .createQueryBuilder('pull')
      .select('pull.rarity', 'rarity')
      .addSelect('COUNT(*)', 'count')
      .where('pull.bannerId = :bannerId', { bannerId })
      .groupBy('pull.rarity')
      .getRawMany();

    const rarityDistribution: Record<Rarity, number> = {
      [Rarity.COMMON]: 0,
      [Rarity.RARE]: 0,
      [Rarity.EPIC]: 0,
      [Rarity.LEGENDARY]: 0,
      [Rarity.MYTHIC]: 0,
    };

    for (const row of rarityResult) {
      rarityDistribution[row.rarity as Rarity] = parseInt(row.count, 10);
    }

    const featuredCount = await this.repository.count({
      where: { bannerId, isFeatured: true },
    });

    const pityTriggerCount = await this.repository.count({
      where: { bannerId, isHardPity: true },
    });

    return {
      totalPulls,
      uniquePlayers,
      rarityDistribution,
      featuredCount,
      pityTriggerCount,
    };
  }
}
