import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';
import { CsrfModule } from './security/csrf.module';
import { ThrottlerRedisStorage } from './security/throttler-redis.storage';
import { AccountThrottlerGuard } from './security/account-throttler.guard';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionGuard } from './rbac/permission.guard';
import { PlatformPermissionGuard } from './platform/rbac/platform-permission.guard';
import { HealthController } from './health/health.controller';
import { HouseboatsModule } from './houseboats/houseboats.module';
import { MeModule } from './me/me.module';
import { AssetsModule } from './assets/assets.module';
import { MediaModule } from './media/media.module';
import { PricingModule } from './pricing/pricing.module';
import { TripsModule } from './trips/trips.module';
import { BookingModule } from './booking/booking.module';
import { MoneyModule } from './money/money.module';
import { QuotesModule } from './quotes/quotes.module';
import { GatewayModule } from './gateway/gateway.module';
import { HrModule } from './hr/hr.module';
import { OpsModule } from './ops/ops.module';
import { SyncModule } from './sync/sync.module';
import { PlatformModule } from './platform/platform.module';
import { SettingsModule } from './platform/settings/settings.module';
import { OwnerModule } from './owner/owner.module';
import { MaintenanceModule } from './maintenance/maintenance.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Structured request logging. The redact list is the security-critical
    // part: auth cookies, bearer tokens, CSRF tokens and passwords must never
    // reach disk, because logs outlive the request and are widely readable.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('env') === 'production';
        return {
          pinoHttp: {
            level: isProd ? 'info' : 'debug',
            // Pretty output locally; JSON in prod for log aggregators.
            transport: isProd
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true } },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-csrf-token"]',
                'res.headers["set-cookie"]',
                'req.body.password',
                'req.body.passwordHash',
                'req.body.bankDetails',
                'req.body.store_passwd',
                'req.body.leadGuestNid',
                '*.password',
                '*.passwordHash',
                '*.store_passwd',
                '*.leadGuestNid',
                '*.nidEncrypted',
              ],
              censor: '[redacted]',
            },
            // Health checks are polled constantly; logging them buries signal.
            autoLogging: {
              ignore: (req) => req.url === '/api/health',
            },
            customProps: (req) => ({
              // Who did it, for correlating with the audit trail.
              actorId: (req as { user?: { id?: string } }).user?.id,
            }),
          },
        };
      },
    }),
    // Redis-backed so limits are shared across instances and survive deploys.
    // RedisModule is global-scoped, so the storage's deps resolve here.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService, ConfigService],
      useFactory: (redis: RedisService, config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new ThrottlerRedisStorage(redis, config),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    CsrfModule,
    NotificationsModule,
    RealtimeModule,
    AuditModule,
    AuthModule,
    RbacModule,
    HouseboatsModule,
    MeModule,
    AssetsModule,
    MediaModule,
    PricingModule,
    TripsModule,
    BookingModule,
    MoneyModule,
    QuotesModule,
    GatewayModule,
    HrModule,
    OpsModule,
    SyncModule,
    SettingsModule,
    PlatformModule,
    OwnerModule,
    MaintenanceModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate → check per-boat permission → check
    // platform permission → rate limit. The throttler runs last so req.user
    // is set and it can key per account rather than per IP.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: PlatformPermissionGuard },
    { provide: APP_GUARD, useClass: AccountThrottlerGuard },
    // Maps Prisma errors to real status codes and keeps internals out of
    // client responses.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
