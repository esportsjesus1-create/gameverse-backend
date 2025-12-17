import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { PlayerPull } from '../models';

export interface PullHistoryQuery {
  playerId: string;
  bannerId?: string;
  page?: number;
  pageSize?: number;
}

export class PlayerPullRepository {
  private repository: Repository<PlayerPull>;

  constructor() {
    this.repository = AppDataSource.getRepository(PlayerPull);
  }

  async create(data: Partial<PlayerPull>): Promise<PlayerPull> {
    const pull = this.repository.create(data);
    return this.repository.save(pull);
  }

  async createMany(data: Partial<PlayerPull>[]): Promise<PlayerPull[]> {
    const pulls = this.repository.create(data);
    return this.repository.save(pulls);
  }

  async findByPlayer(
    playerId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ pulls: PlayerPull[]; total: number }> {
    const [pulls, total] = await this.repository.findAndCount({
      where: { playerId },
      order: { timestamp: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['item', 'banner'],
    });

    return { pulls, total };
  }

  async findByPlayerAndBanner(
    playerId: string,
    bannerId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ pulls: PlayerPull[]; total: number }> {
    const [pulls, total] = await this.repository.findAndCount({
      where: { playerId, bannerId },
      order: { timestamp: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: ['item', 'banner'],
    });

    return { pulls, total };
  }

  async getHistory(query: PullHistoryQuery): Promise<{ pulls: PlayerPull[]; total: number }> {
    const { playerId, bannerId, page = 1, pageSize = 20 } = query;

    const queryBuilder = this.repository
      .createQueryBuilder('pull')
      .leftJoinAndSelect('pull.item', 'item')
      .leftJoinAndSelect('pull.banner', 'banner')
      .where('pull.playerId = :playerId', { playerId });

    if (bannerId) {
      queryBuilder.andWhere('pull.bannerId = :bannerId', { bannerId });
    }

    const [pulls, total] = await queryBuilder
      .orderBy('pull.timestamp', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { pulls, total };
  }

  async countByPlayerAndBanner(playerId: string, bannerId: string): Promise<number> {
    return this.repository.count({ where: { playerId, bannerId } });
  }

  async getLastPull(playerId: string, bannerId: string): Promise<PlayerPull | null> {
    return this.repository.findOne({
      where: { playerId, bannerId },
      order: { timestamp: 'DESC' },
    });
  }
}
