import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { BannerType } from '../types';

@Entity('gacha_player_pity')
@Unique(['playerId', 'bannerType', 'bannerId'])
@Index(['playerId'])
@Index(['bannerType'])
export class PlayerPity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'enum', enum: BannerType })
  bannerType: BannerType;

  @Column({ type: 'uuid', nullable: true })
  bannerId: string | null;

  @Column({ type: 'integer', default: 0 })
  pityCounter: number;

  @Column({ type: 'boolean', default: false })
  guaranteedFeatured: boolean;

  @Column({ type: 'integer', default: 0 })
  weaponPityCounter: number;

  @Column({ type: 'integer', default: 0 })
  totalPulls: number;

  @Column({ type: 'integer', default: 0 })
  legendaryCount: number;

  @Column({ type: 'integer', default: 0 })
  featuredCount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastPullTimestamp: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
