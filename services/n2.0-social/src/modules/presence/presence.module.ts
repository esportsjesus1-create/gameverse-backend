import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { RedisService } from './redis.service';
import { UserPresence } from '../../database/entities/user-presence.entity';
import { SocialProfile } from '../../database/entities/social-profile.entity';
import { Friendship } from '../../database/entities/friendship.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserPresence, SocialProfile, Friendship]),
    ScheduleModule.forRoot(),
  ],
  controllers: [PresenceController],
  providers: [PresenceService, RedisService],
  exports: [PresenceService, RedisService],
})
export class PresenceModule {}
