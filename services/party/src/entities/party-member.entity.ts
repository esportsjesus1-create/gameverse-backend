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
import { Party } from './party.entity';

export enum MemberRole {
  LEADER = 'leader',
  CO_LEADER = 'co_leader',
  MEMBER = 'member',
}

export enum MemberStatus {
  ACTIVE = 'active',
  AWAY = 'away',
  BUSY = 'busy',
  IN_GAME = 'in_game',
  OFFLINE = 'offline',
}

export enum ReadyStatus {
  NOT_READY = 'not_ready',
  READY = 'ready',
  PENDING = 'pending',
}

@Entity('party_members')
@Unique(['partyId', 'userId'])
@Index(['userId'])
@Index(['partyId', 'role'])
export class PartyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  partyId: string;

  @Column({ type: 'uuid' })
  @Index()
  userId: string;

  @Column({ length: 50 })
  username: string;

  @Column({ length: 255, nullable: true })
  avatarUrl: string;

  @Column({
    type: 'enum',
    enum: MemberRole,
    default: MemberRole.MEMBER,
  })
  role: MemberRole;

  @Column({
    type: 'enum',
    enum: MemberStatus,
    default: MemberStatus.ACTIVE,
  })
  status: MemberStatus;

  @Column({
    type: 'enum',
    enum: ReadyStatus,
    default: ReadyStatus.NOT_READY,
  })
  readyStatus: ReadyStatus;

  @Column({ type: 'int', nullable: true })
  rank: number;

  @Column({ type: 'int', nullable: true })
  level: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  preferredRole: string;

  @Column({ type: 'boolean', default: false })
  isMuted: boolean;

  @Column({ type: 'boolean', default: false })
  isDeafened: boolean;

  @Column({ type: 'boolean', default: true })
  canInvite: boolean;

  @Column({ type: 'boolean', default: false })
  canKick: boolean;

  @Column({ type: 'boolean', default: false })
  canChangeSettings: boolean;

  @Column({ type: 'boolean', default: false })
  canStartMatchmaking: boolean;

  @Column({ type: 'jsonb', nullable: true })
  gameStats: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  walletVerified: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  walletBalance: string;

  @Column({ type: 'timestamp', nullable: true })
  lastActiveAt: Date;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt: Date;

  @ManyToOne(() => Party, (party) => party.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partyId' })
  party: Party;
}
