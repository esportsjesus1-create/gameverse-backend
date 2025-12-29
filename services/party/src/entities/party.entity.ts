import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PartyMember } from './party-member.entity';
import { PartyInvite } from './party-invite.entity';
import { PartyChatMessage } from './party-chat-message.entity';
import { PartySettings } from './party-settings.entity';

export enum PartyStatus {
  ACTIVE = 'active',
  IN_QUEUE = 'in_queue',
  IN_GAME = 'in_game',
  DISBANDED = 'disbanded',
}

export enum PartyVisibility {
  PUBLIC = 'public',
  FRIENDS_ONLY = 'friends_only',
  INVITE_ONLY = 'invite_only',
  PRIVATE = 'private',
}

@Entity('parties')
@Index(['status', 'gameId'])
@Index(['leaderId'])
@Index(['createdAt'])
export class Party {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'uuid' })
  @Index()
  leaderId: string;

  @Column({ length: 50, nullable: true })
  leaderUsername: string;

  @Column({ type: 'uuid', nullable: true })
  gameId: string;

  @Column({ length: 100, nullable: true })
  gameName: string;

  @Column({ length: 50, nullable: true })
  gameMode: string;

  @Column({
    type: 'enum',
    enum: PartyStatus,
    default: PartyStatus.ACTIVE,
  })
  status: PartyStatus;

  @Column({
    type: 'enum',
    enum: PartyVisibility,
    default: PartyVisibility.FRIENDS_ONLY,
  })
  visibility: PartyVisibility;

  @Column({ type: 'int', default: 4 })
  maxSize: number;

  @Column({ type: 'int', default: 1 })
  currentSize: number;

  @Column({ type: 'int', default: 0 })
  minRank: number;

  @Column({ type: 'int', default: 10000 })
  maxRank: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  region: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 6, nullable: true, unique: true })
  @Index()
  joinCode: string;

  @Column({ type: 'boolean', default: false })
  isMatchmaking: boolean;

  @Column({ type: 'uuid', nullable: true })
  matchmakingTicketId: string;

  @Column({ type: 'timestamp', nullable: true })
  matchmakingStartedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  currentMatchId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  requiresWallet: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  minimumWalletBalance: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  walletCurrency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  disbandedAt: Date;

  @OneToMany(() => PartyMember, (member) => member.party)
  members: PartyMember[];

  @OneToMany(() => PartyInvite, (invite) => invite.party)
  invites: PartyInvite[];

  @OneToMany(() => PartyChatMessage, (message) => message.party)
  chatMessages: PartyChatMessage[];

  @OneToOne(() => PartySettings, (settings) => settings.party)
  @JoinColumn()
  settings: PartySettings;
}
