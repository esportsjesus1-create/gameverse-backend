import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialFeedController } from './social-feed.controller';
import { SocialFeedService } from './social-feed.service';
import {
  SocialFeedEvent,
  FeedEventLike,
  FeedEventComment,
} from '../../database/entities/social-feed-event.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship } from '../../database/entities/friendship.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SocialFeedEvent,
      FeedEventLike,
      FeedEventComment,
      SocialProfile,
      Friendship,
      BlockedUser,
    ]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [SocialFeedController],
  providers: [SocialFeedService],
  exports: [SocialFeedService],
})
export class SocialFeedModule {}
