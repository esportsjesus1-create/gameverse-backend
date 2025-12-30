import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('gacha_player_spending')
@Unique(['playerId'])
@Index(['playerId'])
export class PlayerSpending {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  dailySpent: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  weeklySpent: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  monthlySpent: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalLifetimeSpent: number;

  @Column({ type: 'integer', default: 0 })
  dailyPullCount: number;

  @Column({ type: 'integer', default: 0 })
  weeklyPullCount: number;

  @Column({ type: 'integer', default: 0 })
  monthlyPullCount: number;

  @Column({ type: 'integer', default: 0 })
  totalLifetimePulls: number;

  @Column({ type: 'timestamp with time zone' })
  lastDailyReset: Date;

  @Column({ type: 'timestamp with time zone' })
  lastWeeklyReset: Date;

  @Column({ type: 'timestamp with time zone' })
  lastMonthlyReset: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 500 })
  dailyLimit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 2000 })
  weeklyLimit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 5000 })
  monthlyLimit: number;

  @Column({ type: 'boolean', default: false })
  hasCustomLimits: boolean;

  @Column({ type: 'boolean', default: false })
  isLimitReached: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  limitReachedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
