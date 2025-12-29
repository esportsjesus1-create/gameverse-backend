import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';

import {
  Tournament,
  TournamentRegistration,
  TournamentMatch,
  TournamentBracket,
  TournamentStanding,
  TournamentPrize,
} from './entities';

import {
  TournamentService,
  RegistrationService,
  BracketService,
  MatchService,
  LeaderboardService,
  PrizeService,
} from './services';

import { TournamentController } from './controllers';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'gameverse'),
        entities: [
          Tournament,
          TournamentRegistration,
          TournamentMatch,
          TournamentBracket,
          TournamentStanding,
          TournamentPrize,
        ],
        synchronize: configService.get('DB_SYNCHRONIZE', false),
        logging: configService.get('DB_LOGGING', false),
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      Tournament,
      TournamentRegistration,
      TournamentMatch,
      TournamentBracket,
      TournamentStanding,
      TournamentPrize,
    ]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore as unknown as string,
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        ttl: 60,
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TournamentController],
  providers: [
    TournamentService,
    RegistrationService,
    BracketService,
    MatchService,
    LeaderboardService,
    PrizeService,
  ],
  exports: [
    TournamentService,
    RegistrationService,
    BracketService,
    MatchService,
    LeaderboardService,
    PrizeService,
  ],
})
export class TournamentModule {}
