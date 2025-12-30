import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Rarity, ItemType } from '../types';

@Entity('gacha_items')
@Index(['rarity', 'isActive'])
@Index(['type', 'isActive'])
export class Item {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: Rarity })
  rarity: Rarity;

  @Column({ type: 'enum', enum: ItemType })
  type: ItemType;

  @Column({ type: 'boolean', default: false })
  isNFT: boolean;

  @Column({ type: 'jsonb', nullable: true })
  nftMetadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 512, nullable: true })
  imageUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 6, default: 1.0 })
  weight: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
