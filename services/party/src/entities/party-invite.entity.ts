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
import { Party } from './party.entity';

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum InviteType {
  DIRECT = 'direct',
  LINK = 'link',
  CODE = 'code',
  FRIEND_REQUEST = 'friend_request',
}

@Entity('party_invites')
@Index(['partyId', 'inviteeId'])
@Index(['inviteeId', 'status'])
@Index(['expiresAt'])
export class PartyInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  partyId: string;

  @Column({ type: 'uuid' })
  @Index()
  inviterId: string;

  @Column({ length: 50 })
  inviterUsername: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  inviteeId: string;

  @Column({ length: 50, nullable: true })
  inviteeUsername: string;

  @Column({ length: 255, nullable: true })
  inviteeEmail: string;

  @Column({
    type: 'enum',
    enum: InviteType,
    default: InviteType.DIRECT,
  })
  type: InviteType;

  @Column({
    type: 'enum',
    enum: InviteStatus,
    default: InviteStatus.PENDING,
  })
  status: InviteStatus;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  inviteToken: string;

  @Column({ type: 'int', default: 0 })
  maxUses: number;

  @Column({ type: 'int', default: 0 })
  currentUses: number;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Party, (party) => party.invites, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partyId' })
  party: Party;
}
