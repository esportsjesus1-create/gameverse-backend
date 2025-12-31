import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { Party } from './entities/party.entity';
import { PartyMember } from './entities/party-member.entity';
import { PartyInvite } from './entities/party-invite.entity';
import { PartyChatMessage } from './entities/party-chat-message.entity';
import { PartySettings } from './entities/party-settings.entity';

import { PartyService } from './services/party.service';
import { PartyMemberService } from './services/party-member.service';
import { PartyInviteService } from './services/party-invite.service';
import { PartyChatService } from './services/party-chat.service';
import { PartySettingsService } from './services/party-settings.service';
import { PartyMatchmakingService } from './services/party-matchmaking.service';
import { RedisCacheService } from './services/redis-cache.service';
import { GamerstakeService } from './services/gamerstake.service';

import { PartyController } from './controllers/party.controller';
import { PartyGateway } from './gateways/party.gateway';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { WsAuthGuard } from './guards/ws-auth.guard';

import configuration from './config/configuration';

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
        entities: [Party, PartyMember, PartyInvite, PartyChatMessage, PartySettings],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Party,
      PartyMember,
      PartyInvite,
      PartyChatMessage,
      PartySettings,
    ]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ([
        {
          name: 'short',
          ttl: configService.get<number>('rateLimit.shortTtl', 1000),
          limit: configService.get<number>('rateLimit.shortLimit', 10),
        },
        {
          name: 'medium',
          ttl: configService.get<number>('rateLimit.mediumTtl', 10000),
          limit: configService.get<number>('rateLimit.mediumLimit', 50),
        },
        {
          name: 'long',
          ttl: configService.get<number>('rateLimit.longTtl', 60000),
          limit: configService.get<number>('rateLimit.longLimit', 100),
        },
      ]),
      inject: [ConfigService],
    }),
  ],
  controllers: [PartyController],
  providers: [
    PartyService,
    PartyMemberService,
    PartyInviteService,
    PartyChatService,
    PartySettingsService,
    PartyMatchmakingService,
    RedisCacheService,
    GamerstakeService,
    PartyGateway,
    JwtAuthGuard,
    WsAuthGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    PartyService,
    PartyMemberService,
    PartyInviteService,
    PartyChatService,
    PartySettingsService,
    PartyMatchmakingService,
    RedisCacheService,
    GamerstakeService,
  ],
})
export class PartyModule {}
