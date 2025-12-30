import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import type { Tournament } from './tournament.entity';

export enum RegistrationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  WAITLISTED = 'waitlisted',
  CANCELLED = 'cancelled',
  DISQUALIFIED = 'disqualified',
  NO_SHOW = 'no_show',
}

@Entity('tournament_registrations')
@Index(['tournamentId', 'status'])
@Index(['participantId'])
@Index(['teamId'])
@Unique(['tournamentId', 'participantId'])
export class TournamentRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'uuid' })
  participantId: string;

  @Column({ length: 100 })
  participantName: string;

  @Column({ type: 'uuid', nullable: true })
  teamId: string;

  @Column({ length: 100, nullable: true })
  teamName: string;

  @Column({ type: 'simple-array', nullable: true })
  teamMemberIds: string[];

  @Column({ type: 'simple-array', nullable: true })
  teamMemberNames: string[];

  @Column({
    type: 'enum',
    enum: RegistrationStatus,
    default: RegistrationStatus.PENDING,
  })
  status: RegistrationStatus;

  @Column({ type: 'int', nullable: true })
  seed: number;

  @Column({ type: 'int', nullable: true })
  mmr: number;

  @Column({ type: 'boolean', default: false })
  identityVerified: boolean;

  @Column({ length: 50, nullable: true })
  region: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  entryFeePaid: number;

  @Column({ length: 100, nullable: true })
  paymentTransactionId: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  checkedInAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  cancelledAt: Date;

  @Column({ length: 500, nullable: true })
  cancellationReason: string;

  @Column({ type: 'boolean', default: false })
  refundIssued: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  refundAmount: number;

  @Column({ length: 100, nullable: true })
  refundTransactionId: string;

  @Column({ type: 'int', nullable: true })
  waitlistPosition: number;

  @Column({ type: 'uuid', nullable: true })
  substitutedById: string;

  @Column({ length: 100, nullable: true })
  substitutedByName: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  substitutedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne('Tournament', 'registrations', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;
}
