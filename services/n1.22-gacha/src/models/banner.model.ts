import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { BannerType, RarityRates, PityConfig } from '../types';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ type: 'enum', enum: BannerType })
  @Index()
  type!: BannerType;

  @Column({ type: 'jsonb' })
  baseRates!: RarityRates;

  @Column({ type: 'jsonb' })
  pityConfig!: PityConfig;

  @Column({ type: 'jsonb' })
  featuredItems!: string[];

  @Column({ type: 'jsonb' })
  itemPool!: string[];

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 0.5 })
  featuredRate!: number;

  @Column({ type: 'timestamp with time zone' })
  @Index()
  startDate!: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  @Index()
  endDate!: Date | null;

  @Column({ type: 'integer', default: 160 })
  pullCost!: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.0 })
  multiPullDiscount!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
