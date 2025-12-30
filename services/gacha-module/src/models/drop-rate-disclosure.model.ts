import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { RarityRates } from '../types';

@Entity('gacha_drop_rate_disclosures')
@Index(['bannerId'])
@Index(['isActive'])
export class DropRateDisclosure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  bannerId: string;

  @Column({ type: 'varchar', length: 255 })
  bannerName: string;

  @Column({ type: 'jsonb' })
  rates: RarityRates;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  featuredRate: number;

  @Column({ type: 'jsonb' })
  pitySystem: {
    softPityStart: number;
    hardPity: number;
    softPityRateIncrease: number;
    guaranteedFeatured: boolean;
  };

  @Column({ type: 'jsonb' })
  featuredItems: Array<{
    id: string;
    name: string;
    rarity: string;
    individualRate: number;
  }>;

  @Column({ type: 'jsonb' })
  poolItems: Array<{
    id: string;
    name: string;
    rarity: string;
    individualRate: number;
  }>;

  @Column({ type: 'text', nullable: true })
  legalDisclaimer: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  regulatoryRegion: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
