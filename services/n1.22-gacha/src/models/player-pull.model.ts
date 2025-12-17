import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Rarity } from '../types';
import { Banner } from './banner.model';
import { Item } from './item.model';

@Entity('player_pulls')
@Index(['playerId', 'bannerId'])
@Index(['playerId', 'timestamp'])
export class PlayerPull {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  playerId!: string;

  @Column({ type: 'uuid' })
  @Index()
  bannerId!: string;

  @ManyToOne(() => Banner)
  @JoinColumn({ name: 'bannerId' })
  banner!: Banner;

  @Column({ type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'itemId' })
  item!: Item;

  @Column({ type: 'varchar', length: 255 })
  itemName!: string;

  @Column({ type: 'enum', enum: Rarity })
  rarity!: Rarity;

  @Column({ type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ type: 'integer' })
  pityCount!: number;

  @Column({ type: 'boolean', default: false })
  isGuaranteed!: boolean;

  @CreateDateColumn()
  @Index()
  timestamp!: Date;
}
