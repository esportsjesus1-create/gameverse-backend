import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TournamentModule } from './tournament.module';

async function bootstrap() {
  const app = await NestFactory.create(TournamentModule);

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

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('GameVerse Tournament API')
    .setDescription('Tournament management API for GameVerse platform - Session 3 Implementation')
    .setVersion('1.0')
    .addTag('Tournaments', 'Tournament creation and management (FR-001 to FR-010)')
    .addTag('Registrations', 'Tournament registration management (FR-011 to FR-020)')
    .addTag('Brackets', 'Bracket generation and management (FR-021 to FR-030)')
    .addTag('Matches', 'Match scheduling and results (FR-031 to FR-046)')
    .addTag('Leaderboards', 'Standings and leaderboards (FR-047 to FR-050)')
    .addTag('Prizes', 'Prize distribution (FR-051 to FR-052)')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Tournament service running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
}

bootstrap();
