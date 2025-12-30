import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SocialProfile } from './social-profile.entity';

@Entity('blocked_users')
@Index(['blockerId', 'blockedId'], { unique: true })
@Index(['blockerId'])
@Index(['blockedId'])
export class BlockedUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  blockerId: string;

  @Column('uuid')
  blockedId: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => SocialProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockerId' })
  blocker: SocialProfile;

  @ManyToOne(() => SocialProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockedId' })
  blocked: SocialProfile;
}
