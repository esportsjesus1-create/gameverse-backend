import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship } from '../../database/entities/friendship.entity';
import { BlockedUser } from '../../database/entities/blocked-user.entity';
import { FriendModule } from '../friend/friend.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialProfile, Friendship, BlockedUser]),
    FriendModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
