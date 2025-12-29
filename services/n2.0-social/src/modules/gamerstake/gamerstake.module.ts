import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { GamerstakeController } from './gamerstake.controller';
import { GamerstakeService } from './gamerstake.service';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship } from '../../database/entities/friendship.entity';
import { FriendModule } from '../friend/friend.module';
import { PresenceModule } from '../presence/presence.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialProfile, Friendship]),
    ScheduleModule.forRoot(),
    forwardRef(() => FriendModule),
    forwardRef(() => PresenceModule),
    forwardRef(() => ProfileModule),
  ],
  controllers: [GamerstakeController],
  providers: [GamerstakeService],
  exports: [GamerstakeService],
})
export class GamerstakeModule {}
