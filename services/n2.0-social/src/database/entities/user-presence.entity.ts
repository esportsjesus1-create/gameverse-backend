import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { SocialProfile } from './social-profile.entity';

export enum PresenceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
  INVISIBLE = 'invisible',
  IN_GAME = 'in_game',
}

@Entity('user_presence')
@Index(['status'])
@Index(['lastSeenAt'])
export class UserPresence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  @Index()
  userId: string;

  @Column({
    type: 'enum',
    enum: PresenceStatus,
    default: PresenceStatus.OFFLINE,
  })
  status: PresenceStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customMessage: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentActivity: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentGameId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  currentGameName: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  platform: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceType: string | null;

  @Column({ type: 'timestamp' })
  lastSeenAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastActivityAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isGamerstakeSynced: boolean;

  @Column({ type: 'timestamp', nullable: true })
  gamerstakeLastSyncAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => SocialProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: SocialProfile;
}
