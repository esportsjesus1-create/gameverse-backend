import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PartyModule } from './party.module';

async function bootstrap() {
  const app = await NestFactory.create(PartyModule);

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('GameVerse Party API')
    .setDescription('Party management, invitations, chat, and matchmaking API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Party', 'Party management endpoints')
    .addTag('Members', 'Party member management')
    .addTag('Invites', 'Party invitation system')
    .addTag('Chat', 'Party chat messaging')
    .addTag('Settings', 'Party settings configuration')
    .addTag('Matchmaking', 'Party matchmaking and ready checks')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Party service running on port ${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
