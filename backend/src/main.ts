import 'reflect-metadata';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import { AppModule } from './app.module';
import { validateEnv } from './config/validate-env';
import { CSRF_UTILS, CsrfUtils } from './security/csrf.module';

/**
 * Max request body. Generous enough for the largest offline-sync batch but
 * bounded, so an unauthenticated caller can't force large allocations.
 */
const JSON_BODY_LIMIT = '256kb';

async function bootstrap(): Promise<void> {
  // Fail fast before doing any work if production secrets are missing/insecure.
  validateEnv();

  // bufferLogs so startup messages replay through pino once it's installed.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);
  const config = app.get(ConfigService);

  // Behind a single platform proxy (Railway), so req.ip must come from the
  // last X-Forwarded-For hop. Without this Express reports the proxy's own
  // address for every client and all IP-keyed rate limits collapse into one
  // shared bucket. Use 1, not `true`: trusting the whole chain would let a
  // client spoof its own address via a forged header.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const isProd = config.get<string>('env') === 'production';

  app.use(
    helmet({
      // This is a JSON API, not an HTML app — it should never be a script or
      // frame source. Swagger UI is the one exception, relaxed below.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
        },
      },
      // The SPA is on a different origin in production (Vercel ↔ Railway).
      // helmet's default `same-origin` would block it from reading anything
      // the API serves directly.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // Cross-origin isolation would break the cross-site cookie flow.
      crossOriginOpenerPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 63_072_000, // 2 years
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  // Explicit body cap. Express defaults to 100kb, but relying on an implicit
  // default for a security-relevant bound is fragile — state it.
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

  // CSRF for cookie-authenticated, state-changing requests. Must run after
  // cookieParser (reads the session cookie) and before routing.
  const { doubleCsrfProtection } = app.get<CsrfUtils>(CSRF_UTILS);
  app.use(doubleCsrfProtection);

  app.enableCors({
    origin: config.get<string>('webOrigin'),
    credentials: true, // cookies flow cross-origin (web ↔ api)
    // Without an explicit list the cors package reflects whatever the client
    // asks for in Access-Control-Request-Headers, so x-csrf-token was being
    // allowed by accident rather than by intent.
    allowedHeaders: ['content-type', 'authorization', 'x-csrf-token'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    // Cache preflights for a day instead of re-issuing one per request.
    maxAge: 86_400,
  });

  // Whitelist + transform all incoming DTOs. Reject unknown props.
  //
  // Error messages are suppressed in production: combined with
  // forbidNonWhitelisted, the default responses enumerate every accepted
  // property and constraint, which hands an attacker the full request schema
  // even with Swagger disabled. Dev keeps them — they're the main debugging
  // signal when a request is rejected.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: isProd,
    }),
  );

  app.setGlobalPrefix('api');

  // Local storage driver serves uploaded (already-compressed, immutable) webp
  // images off disk. Mounted outside the /api prefix. In production STORAGE_DRIVER
  // is 'r2' and images are served by the bucket/CDN instead, so this is skipped.
  if ((config.get<string>('storage.driver') ?? 'local') === 'local') {
    const localDir = config.get<string>('storage.localDir') ?? 'uploads';
    app.useStaticAssets(join(process.cwd(), localDir), {
      prefix: '/uploads/',
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    });
  }

  // API docs. Off in production unless SWAGGER_ENABLED=true (don't expose the
  // full surface publicly by default).
  const swaggerOn = !isProd || process.env.SWAGGER_ENABLED === 'true';
  if (swaggerOn) {
    // Swagger UI is the one HTML surface here and needs its own inline
    // scripts/styles, which the API-wide `default-src 'none'` policy forbids.
    // Scope the relaxation to the docs path only.
    app.use(
      '/api/docs',
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            frameAncestors: ["'none'"],
          },
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        crossOriginOpenerPolicy: false,
        crossOriginEmbedderPolicy: false,
      }),
    );
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
  logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
