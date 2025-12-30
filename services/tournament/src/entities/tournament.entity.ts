import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TournamentRegistration } from './tournament-registration.entity';
import { TournamentMatch } from './tournament-match.entity';
import { TournamentBracket } from './tournament-bracket.entity';
import { TournamentStanding } from './tournament-standing.entity';
import { TournamentPrize } from './tournament-prize.entity';

export enum TournamentFormat {
  SINGLE_ELIMINATION = 'single_elimination',
  DOUBLE_ELIMINATION = 'double_elimination',
  SWISS = 'swiss',
  ROUND_ROBIN = 'round_robin',
}

export enum TournamentStatus {
  DRAFT = 'draft',
  REGISTRATION_OPEN = 'registration_open',
  REGISTRATION_CLOSED = 'registration_closed',
  CHECK_IN = 'check_in',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TournamentVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted',
}

export enum RegistrationType {
  OPEN = 'open',
  INVITE_ONLY = 'invite_only',
}

@Entity('tournaments')
@Index(['status', 'startDate'])
@Index(['gameId', 'status'])
@Index(['organizerId'])
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 100 })
  gameId: string;

  @Column({ length: 100, nullable: true })
  gameName: string;

  @Column({
    type: 'enum',
    enum: TournamentFormat,
    default: TournamentFormat.SINGLE_ELIMINATION,
  })
  format: TournamentFormat;

  @Column({
    type: 'enum',
    enum: TournamentStatus,
    default: TournamentStatus.DRAFT,
  })
  status: TournamentStatus;

  @Column({
    type: 'enum',
    enum: TournamentVisibility,
    default: TournamentVisibility.PUBLIC,
  })
  visibility: TournamentVisibility;

  @Column({
    type: 'enum',
    enum: RegistrationType,
    default: RegistrationType.OPEN,
  })
  registrationType: RegistrationType;

  @Column({ type: 'uuid' })
  organizerId: string;

  @Column({ length: 100, nullable: true })
  organizerName: string;

  @Column({ type: 'int', default: 1 })
  teamSize: number;

  @Column({ type: 'int', default: 16 })
  maxParticipants: number;

  @Column({ type: 'int', default: 2 })
  minParticipants: number;

  @Column({ type: 'int', nullable: true })
  minMmr: number;

  @Column({ type: 'int', nullable: true })
  maxMmr: number;

  @Column({ type: 'boolean', default: false })
  requiresIdentityVerification: boolean;

  @Column({ type: 'simple-array', nullable: true })
  allowedRegions: string[];

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  prizePool: number;

  @Column({ length: 10, default: 'USD' })
  prizeCurrency: string;

  @Column({ type: 'jsonb', nullable: true })
  prizeDistribution: Record<number, number>;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  entryFee: number;

  @Column({ length: 10, default: 'USD' })
  entryFeeCurrency: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  registrationStartDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  registrationEndDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  checkInStartDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  checkInEndDate: Date;

  @Column({ type: 'timestamp with time zone' })
  startDate: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  endDate: Date;

  @Column({ type: 'int', default: 30 })
  matchIntervalMinutes: number;

  @Column({ type: 'text', nullable: true })
  rules: string;

  @Column({ type: 'boolean', default: true })
  allowSpectators: boolean;

  @Column({ type: 'boolean', default: false })
  enableStreaming: boolean;

  @Column({ length: 500, nullable: true })
  streamUrl: string;

  @Column({ length: 500, nullable: true })
  discordUrl: string;

  @Column({ length: 500, nullable: true })
  bannerImageUrl: string;

  @Column({ length: 500, nullable: true })
  thumbnailUrl: string;

  @Column({ type: 'int', default: 3 })
  swissRounds: number;

  @Column({ type: 'boolean', default: true })
  grandFinalsReset: boolean;

  @Column({ type: 'uuid', nullable: true })
  templateId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @OneToMany(() => TournamentRegistration, (registration) => registration.tournament)
  registrations: TournamentRegistration[];

  @OneToMany(() => TournamentMatch, (match) => match.tournament)
  matches: TournamentMatch[];

  @OneToMany(() => TournamentBracket, (bracket) => bracket.tournament)
  brackets: TournamentBracket[];

  @OneToMany(() => TournamentStanding, (standing) => standing.tournament)
  standings: TournamentStanding[];

  @OneToMany(() => TournamentPrize, (prize) => prize.tournament)
  prizes: TournamentPrize[];
}
