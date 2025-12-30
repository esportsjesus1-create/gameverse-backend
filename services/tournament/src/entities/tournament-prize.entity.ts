import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Tournament } from './tournament.entity';

export enum PrizeStatus {
  PENDING = 'pending',
  CALCULATED = 'calculated',
  PROCESSING = 'processing',
  DISTRIBUTED = 'distributed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PrizeType {
  CASH = 'cash',
  TOKEN = 'token',
  NFT = 'nft',
  ITEM = 'item',
  POINTS = 'points',
}

@Entity('tournament_prizes')
@Index(['tournamentId', 'placement'])
@Index(['tournamentId', 'status'])
@Index(['recipientId'])
@Index(['walletTransactionId'])
export class TournamentPrize {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'int' })
  placement: number;

  @Column({ type: 'uuid', nullable: true })
  recipientId: string;

  @Column({ length: 100, nullable: true })
  recipientName: string;

  @Column({ type: 'uuid', nullable: true })
  teamId: string;

  @Column({ length: 100, nullable: true })
  teamName: string;

  @Column({
    type: 'enum',
    enum: PrizeType,
    default: PrizeType.CASH,
  })
  prizeType: PrizeType;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  amount: number;

  @Column({ length: 10, default: 'USD' })
  currency: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentageOfPool: number;

  @Column({
    type: 'enum',
    enum: PrizeStatus,
    default: PrizeStatus.PENDING,
  })
  status: PrizeStatus;

  @Column({ type: 'uuid', nullable: true })
  walletId: string;

  @Column({ length: 200, nullable: true })
  walletAddress: string;

  @Column({ length: 100, nullable: true })
  walletTransactionId: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  distributedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  distributedBy: string;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastRetryAt: Date;

  @Column({ type: 'boolean', default: false })
  identityVerified: boolean;

  @Column({ type: 'boolean', default: false })
  taxFormSubmitted: boolean;

  @Column({ length: 100, nullable: true })
  taxFormId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  taxWithheld: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  netAmount: number;

  @Column({ length: 100, nullable: true })
  nftTokenId: string;

  @Column({ length: 200, nullable: true })
  nftContractAddress: string;

  @Column({ length: 50, nullable: true })
  nftChain: string;

  @Column({ type: 'jsonb', nullable: true })
  itemDetails: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne('Tournament', 'prizes', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;
}
