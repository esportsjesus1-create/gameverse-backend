import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PartyModule } from './party.module';
import { PartyExceptionFilter } from './filters';
import { LoggingInterceptor } from './interceptors';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(PartyModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  });

  app.useGlobalFilters(new PartyExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const validationErrors: Record<string, string[]> = {};
        for (const error of errors) {
          const property = error.property;
          if (error.constraints) {
            validationErrors[property] = Object.values(error.constraints);
          }
        }
        return {
          statusCode: 400,
          errorCode: 'VALIDATION_001',
          message: 'Validation failed',
          timestamp: new Date().toISOString(),
          details: { errors: validationErrors },
        };
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

  logger.log(`Party service running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
}

bootstrap();
