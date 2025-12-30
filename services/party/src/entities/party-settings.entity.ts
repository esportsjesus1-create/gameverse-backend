import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Party } from './party.entity';

@Entity('party_settings')
@Index(['partyId'])
export class PartySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  partyId: string;

  @Column({ type: 'boolean', default: true })
  allowInvites: boolean;

  @Column({ type: 'boolean', default: false })
  membersCanInvite: boolean;

  @Column({ type: 'boolean', default: true })
  autoAcceptFriends: boolean;

  @Column({ type: 'boolean', default: false })
  requireApproval: boolean;

  @Column({ type: 'boolean', default: true })
  chatEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  voiceChatEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  pushToTalk: boolean;

  @Column({ type: 'boolean', default: true })
  notificationsEnabled: boolean;

  @Column({ type: 'boolean', default: true })
  soundsEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  autoReadyCheck: boolean;

  @Column({ type: 'int', default: 30 })
  readyCheckTimeout: number;

  @Column({ type: 'boolean', default: true })
  showMemberStatus: boolean;

  @Column({ type: 'boolean', default: true })
  showMemberRank: boolean;

  @Column({ type: 'boolean', default: false })
  anonymousMode: boolean;

  @Column({ type: 'boolean', default: false })
  strictRankMatching: boolean;

  @Column({ type: 'int', default: 500 })
  rankTolerance: number;

  @Column({ type: 'boolean', default: true })
  allowSpectators: boolean;

  @Column({ type: 'int', default: 0 })
  maxSpectators: number;

  @Column({ type: 'boolean', default: false })
  streamMode: boolean;

  @Column({ type: 'int', default: 0 })
  streamDelay: number;

  @Column({ type: 'boolean', default: false })
  tournamentMode: boolean;

  @Column({ type: 'uuid', nullable: true })
  tournamentId: string;

  @Column({ type: 'boolean', default: false })
  wagerEnabled: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  wagerAmount: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  wagerCurrency: string;

  @Column({ type: 'boolean', default: false })
  requireWalletVerification: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, nullable: true })
  minimumBalance: string;

  @Column({ type: 'jsonb', nullable: true })
  preferredServers: string[];

  @Column({ type: 'jsonb', nullable: true })
  blockedRegions: string[];

  @Column({ type: 'int', default: 100 })
  maxPing: number;

  @Column({ type: 'jsonb', nullable: true })
  gameSpecificSettings: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  customRoles: Array<{
    name: string;
    permissions: string[];
    color: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  chatFilters: {
    profanityFilter: boolean;
    linkFilter: boolean;
    spamFilter: boolean;
    customBlockedWords: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  matchmakingPreferences: {
    preferSimilarRank: boolean;
    preferSameRegion: boolean;
    preferSameLanguage: boolean;
    avoidRecentOpponents: boolean;
    prioritizeSpeed: boolean;
  };

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Party, (party) => party.settings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partyId' })
  party: Party;
}
