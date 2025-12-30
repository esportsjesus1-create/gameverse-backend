import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

export interface TestUser {
  id: string;
  username: string;
  displayName: string;
  token: string;
}

export function generateTestUser(prefix: string = 'user'): TestUser {
  const id = uuidv4();
  const username = `${prefix}_${id.substring(0, 8)}`;
  return {
    id,
    username,
    displayName: `Test ${prefix}`,
    token: generateMockToken(id, username),
  };
}

export function generateMockToken(userId: string, username: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      username,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64');
  const signature = 'mock_signature';
  return `${header}.${payload}.${signature}`;
}

export async function createTestingModule(imports: unknown[]): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            database: {
              host: process.env.TEST_DB_HOST || 'localhost',
              port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
              username: process.env.TEST_DB_USERNAME || 'postgres',
              password: process.env.TEST_DB_PASSWORD || 'postgres',
              database: process.env.TEST_DB_DATABASE || 'gameverse_social_test',
            },
            redis: {
              host: process.env.TEST_REDIS_HOST || 'localhost',
              port: parseInt(process.env.TEST_REDIS_PORT || '6379', 10),
            },
            neo4j: {
              uri: process.env.TEST_NEO4J_URI || 'bolt://localhost:7687',
              username: process.env.TEST_NEO4J_USERNAME || 'neo4j',
              password: process.env.TEST_NEO4J_PASSWORD || 'password',
            },
          }),
        ],
      }),
      ...imports,
    ],
  }).compile();
}

export async function setupTestApp(module: TestingModule): Promise<INestApplication> {
  const app = module.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}
