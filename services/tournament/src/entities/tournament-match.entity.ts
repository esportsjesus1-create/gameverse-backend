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
import { Tournament } from './tournament.entity';
import { TournamentBracket } from './tournament-bracket.entity';

export enum MatchStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  CHECK_IN = 'check_in',
  IN_PROGRESS = 'in_progress',
  AWAITING_CONFIRMATION = 'awaiting_confirmation',
  DISPUTED = 'disputed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
  FORFEIT = 'forfeit',
}

export enum MatchType {
  WINNERS = 'winners',
  LOSERS = 'losers',
  GRAND_FINALS = 'grand_finals',
  GRAND_FINALS_RESET = 'grand_finals_reset',
  SWISS = 'swiss',
  ROUND_ROBIN = 'round_robin',
}

@Entity('tournament_matches')
@Index(['tournamentId', 'status'])
@Index(['tournamentId', 'round'])
@Index(['bracketId'])
@Index(['scheduledAt'])
@Index(['participant1Id'])
@Index(['participant2Id'])
export class TournamentMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'uuid', nullable: true })
  bracketId: string;

  @Column({ type: 'int' })
  round: number;

  @Column({ type: 'int' })
  matchNumber: number;

  @Column({
    type: 'enum',
    enum: MatchType,
    default: MatchType.WINNERS,
  })
  matchType: MatchType;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.PENDING,
  })
  status: MatchStatus;

  @Column({ type: 'uuid', nullable: true })
  participant1Id: string;

  @Column({ length: 100, nullable: true })
  participant1Name: string;

  @Column({ type: 'int', nullable: true })
  participant1Seed: number;

  @Column({ type: 'uuid', nullable: true })
  participant2Id: string;

  @Column({ length: 100, nullable: true })
  participant2Name: string;

  @Column({ type: 'int', nullable: true })
  participant2Seed: number;

  @Column({ type: 'int', nullable: true })
  participant1Score: number;

  @Column({ type: 'int', nullable: true })
  participant2Score: number;

  @Column({ type: 'uuid', nullable: true })
  winnerId: string;

  @Column({ length: 100, nullable: true })
  winnerName: string;

  @Column({ type: 'uuid', nullable: true })
  loserId: string;

  @Column({ length: 100, nullable: true })
  loserName: string;

  @Column({ type: 'boolean', default: false })
  participant1Confirmed: boolean;

  @Column({ type: 'boolean', default: false })
  participant2Confirmed: boolean;

  @Column({ type: 'boolean', default: false })
  adminOverride: boolean;

  @Column({ type: 'uuid', nullable: true })
  adminOverrideBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  adminOverrideAt: Date;

  @Column({ length: 500, nullable: true })
  adminOverrideReason: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt: Date;

  @Column({ type: 'boolean', default: false })
  participant1CheckedIn: boolean;

  @Column({ type: 'boolean', default: false })
  participant2CheckedIn: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  participant1CheckedInAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  participant2CheckedInAt: Date;

  @Column({ length: 100, nullable: true })
  serverId: string;

  @Column({ length: 100, nullable: true })
  serverName: string;

  @Column({ length: 100, nullable: true })
  lobbyCode: string;

  @Column({ length: 500, nullable: true })
  streamUrl: string;

  @Column({ type: 'uuid', nullable: true })
  nextMatchId: string;

  @Column({ type: 'uuid', nullable: true })
  loserNextMatchId: string;

  @Column({ type: 'text', nullable: true })
  disputeReason: string;

  @Column({ type: 'uuid', nullable: true })
  disputeRaisedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  disputeRaisedAt: Date;

  @Column({ type: 'text', nullable: true })
  disputeResolution: string;

  @Column({ type: 'uuid', nullable: true })
  disputeResolvedBy: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  disputeResolvedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  gameStats: Record<string, unknown>[];

  @Column({ type: 'int', default: 1 })
  bestOf: number;

  @Column({ type: 'int', default: 0 })
  gamesPlayed: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => Tournament, (tournament) => tournament.matches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @ManyToOne(() => TournamentBracket, (bracket) => bracket.matches, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'bracketId' })
  bracket: TournamentBracket;
}
