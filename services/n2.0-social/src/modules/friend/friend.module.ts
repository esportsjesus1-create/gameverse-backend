import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';
import { Neo4jService } from './neo4j.service';
import { Friendship } from '../../database/entities/friendship.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { NotificationModule } from '../notification/notification.module';
import { SocialCacheService } from '../../common/services/cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Friendship, SocialProfile, BlockedUser]),
    forwardRef(() => NotificationModule),
  ],
  controllers: [FriendController],
  providers: [FriendService, Neo4jService, SocialCacheService],
  exports: [FriendService, Neo4jService, SocialCacheService],
})
export class FriendModule {}
