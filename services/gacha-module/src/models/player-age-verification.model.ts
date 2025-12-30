import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { AgeVerificationStatus } from '../types';

@Entity('gacha_player_age_verification')
@Unique(['playerId'])
@Index(['playerId'])
@Index(['status'])
export class PlayerAgeVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'enum', enum: AgeVerificationStatus, default: AgeVerificationStatus.UNVERIFIED })
  status: AgeVerificationStatus;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ type: 'integer', nullable: true })
  calculatedAge: number | null;

  @Column({ type: 'boolean', default: false })
  meetsMinimumAge: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  verificationMethod: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  documentId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  verificationProvider: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'integer', default: 0 })
  verificationAttempts: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
