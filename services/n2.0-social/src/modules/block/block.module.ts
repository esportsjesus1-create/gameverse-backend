import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockController } from './block.controller';
import { BlockService } from './block.service';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship } from '../../database/entities/friendship.entity';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BlockedUser, SocialProfile, Friendship]),
    FriendModule,
  ],
  controllers: [BlockController],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
