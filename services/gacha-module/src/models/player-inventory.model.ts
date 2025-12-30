import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('gacha_player_inventory')
@Unique(['playerId', 'itemId'])
@Index(['playerId'])
@Index(['itemId'])
export class PlayerInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'uuid' })
  itemId: string;

  @Column({ type: 'integer', default: 1 })
  quantity: number;

  @Column({ type: 'integer', default: 0 })
  duplicateCount: number;

  @Column({ type: 'timestamp with time zone' })
  firstObtainedAt: Date;

  @Column({ type: 'timestamp with time zone' })
  lastObtainedAt: Date;

  @Column({ type: 'varchar', length: 255 })
  obtainedFrom: string;

  @Column({ type: 'boolean', default: false })
  isLocked: boolean;

  @Column({ type: 'boolean', default: false })
  isFavorite: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nftTokenId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nftContractAddress: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
