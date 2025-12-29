import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserPresence } from './user-presence.entity';
import { Friendship } from './friendship.entity';

export enum ProfileVisibility {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private',
}

export interface GamingPlatform {
  platform: string;
  username: string;
  profileUrl?: string;
  verified: boolean;
  addedAt: Date;
}

export interface GameStatistics {
  gameId: string;
  gameName: string;
  hoursPlayed: number;
  wins: number;
  losses: number;
  rank?: string;
  lastPlayed: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  unlockedAt: Date;
  gameId?: string;
  gameName?: string;
  rarity?: string;
}

@Entity('social_profiles')
@Index(['username'], { unique: true })
@Index(['displayName'])
@Index(['visibility'])
export class SocialProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  @Index()
  userId: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 100 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bannerUrl: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({
    type: 'enum',
    enum: ProfileVisibility,
    default: ProfileVisibility.PUBLIC,
  })
  visibility: ProfileVisibility;

  @Column({ type: 'jsonb', default: [] })
  gamingPlatforms: GamingPlatform[];

  @Column({ type: 'jsonb', default: [] })
  gameStatistics: GameStatistics[];

  @Column({ type: 'jsonb', default: [] })
  achievements: Achievement[];

  @Column({ type: 'int', default: 0 })
  friendCount: number;

  @Column({ type: 'int', default: 0 })
  followerCount: number;

  @Column({ type: 'int', default: 0 })
  followingCount: number;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'boolean', default: true })
  allowFriendRequests: boolean;

  @Column({ type: 'boolean', default: true })
  showOnlineStatus: boolean;

  @Column({ type: 'boolean', default: true })
  showGameActivity: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gamerstakeUserId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  gamerstakeLastSyncAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => UserPresence, (presence) => presence.user)
  presence: UserPresence;

  @OneToMany(() => Friendship, (friendship) => friendship.requester)
  sentFriendRequests: Friendship[];

  @OneToMany(() => Friendship, (friendship) => friendship.addressee)
  receivedFriendRequests: Friendship[];
}
