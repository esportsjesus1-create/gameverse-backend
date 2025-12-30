import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { CurrencyType } from '../types';

@Entity('gacha_player_currency')
@Unique(['playerId', 'currencyType'])
@Index(['playerId'])
export class PlayerCurrency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'enum', enum: CurrencyType })
  currencyType: CurrencyType;

  @Column({ type: 'bigint', default: 0 })
  balance: number;

  @Column({ type: 'bigint', default: 0 })
  lifetimeEarned: number;

  @Column({ type: 'bigint', default: 0 })
  lifetimeSpent: number;

  @Column({ type: 'bigint', default: 0 })
  pendingBalance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
