import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CsrfModule } from './security/csrf.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { RbacModule } from './rbac/rbac.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { PermissionGuard } from './rbac/permission.guard';
import { HealthController } from './health/health.controller';
import { HouseboatsModule } from './houseboats/houseboats.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: authenticate → check per-boat permission → rate limit.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
