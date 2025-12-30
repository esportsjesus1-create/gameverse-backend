import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Rarity, ItemType, CurrencyType } from '../types';

@Entity('gacha_player_pulls')
@Index(['playerId', 'timestamp'])
@Index(['bannerId', 'timestamp'])
@Index(['playerId', 'bannerId'])
@Index(['rarity'])
export class PlayerPull {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'uuid' })
  bannerId: string;

  @Column({ type: 'varchar', length: 255 })
  bannerName: string;

  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'varchar', length: 255 })
  itemName: string;

  @Column({ type: 'enum', enum: ItemType })
  itemType: ItemType;

  @Column({ type: 'enum', enum: Rarity })
  rarity: Rarity;

  @Column({ type: 'boolean', default: false })
  isFeatured: boolean;

  @Column({ type: 'integer' })
  pityCount: number;

  @Column({ type: 'boolean', default: false })
  isGuaranteed: boolean;

  @Column({ type: 'boolean', default: false })
  isSoftPity: boolean;

  @Column({ type: 'boolean', default: false })
  isHardPity: boolean;

  @Column({ type: 'integer' })
  cost: number;

  @Column({ type: 'enum', enum: CurrencyType })
  currencyType: CurrencyType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nftTokenId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nftTransactionHash: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  timestamp: Date;
}
