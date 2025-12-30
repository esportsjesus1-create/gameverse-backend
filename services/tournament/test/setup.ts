import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

export const createTestingModule = async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      TypeOrmModule.forRoot({
        type: 'sqlite',
        database: ':memory:',
        entities: [__dirname + '/../src/entities/*.entity{.ts,.js}'],
        synchronize: true,
        dropSchema: true,
      }),
      CacheModule.register({
        ttl: 60,
        max: 100,
      }),
    ],
  }).compile();

  return moduleFixture;
};

export const createTestApp = async (moduleFixture: TestingModule): Promise<INestApplication> => {
  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();
  return app;
};

export const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const createMockTournament = (overrides = {}) => ({
  name: 'Test Tournament',
  description: 'A test tournament',
  gameId: 'game-123',
  gameName: 'Test Game',
  format: 'single_elimination',
  organizerId: generateUUID(),
  organizerName: 'Test Organizer',
  teamSize: 1,
  maxParticipants: 16,
  minParticipants: 2,
  startDate: new Date(Date.now() + 86400000).toISOString(),
  ...overrides,
});

export const createMockRegistration = (tournamentId: string, overrides = {}) => ({
  tournamentId,
  participantId: generateUUID(),
  participantName: 'Test Player',
  mmr: 1500,
  identityVerified: true,
  region: 'NA',
  ...overrides,
});

export const createMockParticipants = (count: number, tournamentId: string) => {
  return Array.from({ length: count }, (_, i) => ({
    tournamentId,
    participantId: generateUUID(),
    participantName: `Player ${i + 1}`,
    mmr: 1500 + Math.floor(Math.random() * 500),
    identityVerified: true,
    region: 'NA',
  }));
};
