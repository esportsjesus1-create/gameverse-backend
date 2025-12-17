import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { BannerType } from '../types';

@Entity('player_pity')
@Unique(['playerId', 'bannerType'])
export class PlayerPity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  playerId!: string;

  @Column({ type: 'enum', enum: BannerType })
  @Index()
  bannerType!: BannerType;

  @Column({ type: 'integer', default: 0 })
  pityCounter!: number;

  @Column({ type: 'boolean', default: false })
  guaranteedFeatured!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastPullTimestamp!: Date | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}
