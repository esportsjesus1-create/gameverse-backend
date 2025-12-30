import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CurrencyType, TransactionType, TransactionStatus } from '../types';

@Entity('gacha_currency_transactions')
@Index(['playerId', 'createdAt'])
@Index(['transactionType', 'status'])
@Index(['externalTransactionId'])
export class CurrencyTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'enum', enum: CurrencyType })
  currencyType: CurrencyType;

  @Column({ type: 'enum', enum: TransactionType })
  transactionType: TransactionType;

  @Column({ type: 'bigint' })
  amount: number;

  @Column({ type: 'bigint' })
  balanceBefore: number;

  @Column({ type: 'bigint' })
  balanceAfter: number;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.COMPLETED })
  status: TransactionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalTransactionId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  paymentMethod: string | null;

  @Column({ type: 'uuid', nullable: true })
  relatedPullId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
