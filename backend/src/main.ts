import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { validateEnv } from './config/validate-env';
import { CSRF_UTILS, CsrfUtils } from './security/csrf.module';

async function bootstrap(): Promise<void> {
  // Fail fast before doing any work if production secrets are missing/insecure.
  validateEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // CSRF for cookie-authenticated, state-changing requests. Must run after
  // cookieParser (reads the session cookie) and before routing.
  const { doubleCsrfProtection } = app.get<CsrfUtils>(CSRF_UTILS);
  app.use(doubleCsrfProtection);

  app.enableCors({
    origin: config.get<string>('webOrigin'),
    credentials: true, // cookies flow cross-origin (web ↔ api)
  });

  // Whitelist + transform all incoming DTOs. Reject unknown props.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // API docs. Off in production unless SWAGGER_ENABLED=true (don't expose the
  // full surface publicly by default).
  const swaggerOn =
    config.get<string>('env') !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';
  if (swaggerOn) {
    // The @nestjs/swagger CLI plugin (nest-cli.json) bakes DTO metadata into the
    // compiled classes, so request schemas are typed without any extra loading.
    const doc = new DocumentBuilder()
      .setTitle('Houseboat API')
      .setDescription('Booking SaaS backend')
      .setVersion('0.1.0')
      .addCookieAuth('hb_access')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, doc),
    );
  }

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
