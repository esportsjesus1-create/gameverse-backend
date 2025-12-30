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

@Entity('tournament_standings')
@Index(['tournamentId', 'rank'])
@Index(['tournamentId', 'points'])
@Index(['participantId'])
@Unique(['tournamentId', 'participantId'])
export class TournamentStanding {
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

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'int', default: 0 })
  seed: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  points: number;

  @Column({ type: 'int', default: 0 })
  wins: number;

  @Column({ type: 'int', default: 0 })
  losses: number;

  @Column({ type: 'int', default: 0 })
  draws: number;

  @Column({ type: 'int', default: 0 })
  matchesPlayed: number;

  @Column({ type: 'int', default: 0 })
  gamesWon: number;

  @Column({ type: 'int', default: 0 })
  gamesLost: number;

  @Column({ type: 'int', default: 0 })
  roundsWon: number;

  @Column({ type: 'int', default: 0 })
  roundsLost: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  winRate: number;

  @Column({ type: 'int', default: 0 })
  buchholzScore: number;

  @Column({ type: 'int', default: 0 })
  opponentWinRate: number;

  @Column({ type: 'int', default: 0 })
  headToHeadWins: number;

  @Column({ type: 'int', default: 0 })
  currentStreak: number;

  @Column({ length: 10, default: 'none' })
  streakType: string;

  @Column({ type: 'int', default: 0 })
  longestWinStreak: number;

  @Column({ type: 'boolean', default: false })
  isEliminated: boolean;

  @Column({ type: 'int', nullable: true })
  eliminatedInRound: number;

  @Column({ type: 'uuid', nullable: true })
  eliminatedBy: string;

  @Column({ type: 'boolean', default: false })
  isDisqualified: boolean;

  @Column({ length: 500, nullable: true })
  disqualificationReason: string;

  @Column({ type: 'int', nullable: true })
  finalPlacement: number;

  @Column({ type: 'jsonb', nullable: true })
  gameStats: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne('Tournament', 'standings', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;
}
