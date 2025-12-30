import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BannerType, CurrencyType, Rarity, RarityRates, PityConfig } from '../types';

@Entity('gacha_banners')
@Index(['type', 'isActive'])
@Index(['startDate', 'endDate'])
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: BannerType })
  type: BannerType;

  @Column({ type: 'jsonb' })
  baseRates: RarityRates;

  @Column({ type: 'jsonb' })
  pityConfig: PityConfig;

  @Column({ type: 'uuid', array: true, default: [] })
  featuredItems: string[];

  @Column({ type: 'uuid', array: true, default: [] })
  itemPool: string[];

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 0.5 })
  featuredRate: number;

  @Column({ type: 'timestamp with time zone' })
  startDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  endDate: Date | null;

  @Column({ type: 'integer' })
  pullCost: number;

  @Column({ type: 'enum', enum: CurrencyType, default: CurrencyType.PREMIUM })
  currencyType: CurrencyType;

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.1 })
  multiPullDiscount: number;

  @Column({ type: 'integer', default: 10 })
  multiPullCount: number;

  @Column({ type: 'enum', enum: Rarity, nullable: true })
  guaranteedRarityOnMulti: Rarity | null;

  @Column({ type: 'integer', nullable: true })
  maxPullsPerDay: number | null;

  @Column({ type: 'boolean', default: true })
  requiresAgeVerification: boolean;

  @Column({ type: 'boolean', default: false })
  nftRewardsEnabled: boolean;

  @Column({ type: 'varchar', length: 512, nullable: true })
  imageUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'bigint', default: 0 })
  totalPulls: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
