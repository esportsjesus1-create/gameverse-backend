import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { FriendModule } from './modules/friend/friend.module';
import { BlockModule } from './modules/block/block.module';
import { SocialFeedModule } from './modules/social-feed/social-feed.module';
import { PresenceModule } from './modules/presence/presence.module';
import { ProfileModule } from './modules/profile/profile.module';
import { NotificationModule } from './modules/notification/notification.module';
import { GamerstakeModule } from './modules/gamerstake/gamerstake.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [__dirname + '/database/entities/*.entity{.ts,.js}'],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    FriendModule,
    BlockModule,
    SocialFeedModule,
    PresenceModule,
    ProfileModule,
    NotificationModule,
    GamerstakeModule,
  ],
})
export class AppModule {}
