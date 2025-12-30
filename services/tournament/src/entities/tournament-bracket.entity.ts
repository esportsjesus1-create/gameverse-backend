import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tournament, TournamentFormat } from './tournament.entity';
import { TournamentMatch } from './tournament-match.entity';

export enum BracketType {
  WINNERS = 'winners',
  LOSERS = 'losers',
  GRAND_FINALS = 'grand_finals',
  SWISS = 'swiss',
  ROUND_ROBIN = 'round_robin',
  GROUPS = 'groups',
}

export enum BracketStatus {
  PENDING = 'pending',
  GENERATED = 'generated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

@Entity('tournament_brackets')
@Index(['tournamentId', 'bracketType'])
@Index(['tournamentId', 'status'])
export class TournamentBracket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({
    type: 'enum',
    enum: BracketType,
    default: BracketType.WINNERS,
  })
  bracketType: BracketType;

  @Column({
    type: 'enum',
    enum: TournamentFormat,
    default: TournamentFormat.SINGLE_ELIMINATION,
  })
  format: TournamentFormat;

  @Column({
    type: 'enum',
    enum: BracketStatus,
    default: BracketStatus.PENDING,
  })
  status: BracketStatus;

  @Column({ type: 'int', default: 0 })
  totalRounds: number;

  @Column({ type: 'int', default: 0 })
  currentRound: number;

  @Column({ type: 'int', default: 0 })
  totalMatches: number;

  @Column({ type: 'int', default: 0 })
  completedMatches: number;

  @Column({ type: 'int', default: 0 })
  participantCount: number;

  @Column({ type: 'int', default: 0 })
  byeCount: number;

  @Column({ type: 'jsonb', nullable: true })
  seeds: { participantId: string; seed: number; name: string }[];

  @Column({ type: 'jsonb', nullable: true })
  bracketData: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  visualizationData: Record<string, unknown>;

  @Column({ length: 100, nullable: true })
  groupName: string;

  @Column({ type: 'int', nullable: true })
  groupNumber: number;

  @Column({ type: 'int', nullable: true })
  advancingCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => Tournament, (tournament) => tournament.brackets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @OneToMany(() => TournamentMatch, (match) => match.bracket)
  matches: TournamentMatch[];
}
