import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { PlayerPity } from '../models';
import { BannerType, PlayerPityState } from '../types';

export class PlayerPityRepository {
  private repository: Repository<PlayerPity>;

  constructor() {
    this.repository = AppDataSource.getRepository(PlayerPity);
  }

  async findByPlayerAndBannerType(
    playerId: string,
    bannerType: BannerType
  ): Promise<PlayerPity | null> {
    return this.repository.findOne({ where: { playerId, bannerType } });
  }

  async findByPlayer(playerId: string): Promise<PlayerPity[]> {
    return this.repository.find({ where: { playerId } });
  }

  async upsert(data: Partial<PlayerPity>): Promise<PlayerPity> {
    const existing = await this.findByPlayerAndBannerType(
      data.playerId!,
      data.bannerType!
    );

    if (existing) {
      await this.repository.update(existing.id, data);
      return (await this.findByPlayerAndBannerType(data.playerId!, data.bannerType!))!;
    }

    const pity = this.repository.create(data);
    return this.repository.save(pity);
  }

  async incrementPity(
    playerId: string,
    bannerType: BannerType,
    increment: number = 1
  ): Promise<PlayerPity> {
    const existing = await this.findByPlayerAndBannerType(playerId, bannerType);

    if (existing) {
      existing.pityCounter += increment;
      existing.lastPullTimestamp = new Date();
      return this.repository.save(existing);
    }

    const pity = this.repository.create({
      playerId,
      bannerType,
      pityCounter: increment,
      guaranteedFeatured: false,
      lastPullTimestamp: new Date(),
    });
    return this.repository.save(pity);
  }

  async resetPity(
    playerId: string,
    bannerType: BannerType,
    setGuaranteed: boolean = false
  ): Promise<PlayerPity> {
    const existing = await this.findByPlayerAndBannerType(playerId, bannerType);

    if (existing) {
      existing.pityCounter = 0;
      existing.guaranteedFeatured = setGuaranteed;
      existing.lastPullTimestamp = new Date();
      return this.repository.save(existing);
    }

    const pity = this.repository.create({
      playerId,
      bannerType,
      pityCounter: 0,
      guaranteedFeatured: setGuaranteed,
      lastPullTimestamp: new Date(),
    });
    return this.repository.save(pity);
  }

  async getPityState(playerId: string, bannerType: BannerType): Promise<PlayerPityState> {
    const pity = await this.findByPlayerAndBannerType(playerId, bannerType);

    if (pity) {
      return {
        playerId: pity.playerId,
        bannerType: pity.bannerType,
        pityCounter: pity.pityCounter,
        guaranteedFeatured: pity.guaranteedFeatured,
        lastPullTimestamp: pity.lastPullTimestamp,
      };
    }

    return {
      playerId,
      bannerType,
      pityCounter: 0,
      guaranteedFeatured: false,
      lastPullTimestamp: null,
    };
  }
}
