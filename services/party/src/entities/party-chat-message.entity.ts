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

export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  EMOTE = 'emote',
  IMAGE = 'image',
  VOICE_CLIP = 'voice_clip',
  GAME_EVENT = 'game_event',
  READY_CHECK = 'ready_check',
  MATCHMAKING_UPDATE = 'matchmaking_update',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  DELETED = 'deleted',
  MODERATED = 'moderated',
}

@Entity('party_chat_messages')
@Index(['partyId', 'createdAt'])
@Index(['senderId'])
export class PartyChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  partyId: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  senderId: string;

  @Column({ length: 50, nullable: true })
  senderUsername: string;

  @Column({ length: 255, nullable: true })
  senderAvatarUrl: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: MessageStatus,
    default: MessageStatus.SENT,
  })
  status: MessageStatus;

  @Column({ type: 'uuid', nullable: true })
  replyToId: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{
    type: string;
    url: string;
    name: string;
    size: number;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  reactions: Record<string, string[]>;

  @Column({ type: 'jsonb', nullable: true })
  mentions: string[];

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'uuid', nullable: true })
  pinnedBy: string;

  @Column({ type: 'timestamp', nullable: true })
  pinnedAt: Date;

  @Column({ type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ type: 'timestamp', nullable: true })
  editedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ type: 'simple-array', nullable: true })
  readBy: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date;

  @ManyToOne(() => Party, (party) => party.chatMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partyId' })
  party: Party;
}
