import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { SocialProfile } from './social-profile.entity';

export enum FeedEventType {
  STATUS_UPDATE = 'status_update',
  ACHIEVEMENT = 'achievement',
  GAME_RESULT = 'game_result',
  PROFILE_UPDATE = 'profile_update',
  MILESTONE = 'milestone',
}

export enum FeedEventVisibility {
  PUBLIC = 'public',
  FRIENDS = 'friends',
  PRIVATE = 'private',
}

@Entity('social_feed_events')
@Index(['authorId', 'createdAt'])
@Index(['eventType'])
@Index(['visibility'])
export class SocialFeedEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  authorId: string;

  @Column({
    type: 'enum',
    enum: FeedEventType,
    default: FeedEventType.STATUS_UPDATE,
  })
  eventType: FeedEventType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: FeedEventVisibility,
    default: FeedEventVisibility.FRIENDS,
  })
  visibility: FeedEventVisibility;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ type: 'int', default: 0 })
  commentCount: number;

  @Column({ type: 'int', default: 0 })
  shareCount: number;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => SocialProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: SocialProfile;

  @OneToMany(() => FeedEventLike, (like) => like.event)
  likes: FeedEventLike[];

  @OneToMany(() => FeedEventComment, (comment) => comment.event)
  comments: FeedEventComment[];
}

@Entity('feed_event_likes')
@Index(['eventId', 'userId'], { unique: true })
export class FeedEventLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  eventId: string;

  @Column('uuid')
  @Index()
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => SocialFeedEvent, (event) => event.likes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: SocialFeedEvent;

  @ManyToOne(() => SocialProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: SocialProfile;
}

@Entity('feed_event_comments')
@Index(['eventId', 'createdAt'])
export class FeedEventComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  @Index()
  eventId: string;

  @Column('uuid')
  @Index()
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'uuid', nullable: true })
  parentCommentId: string | null;

  @Column({ type: 'boolean', default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => SocialFeedEvent, (event) => event.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: SocialFeedEvent;

  @ManyToOne(() => SocialProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: SocialProfile;
}
