import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { Public } from '../auth/decorators';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Liveness + dependency reachability. Used by Railway health checks, which
   * key on the HTTP status code — so an unhealthy instance must answer 503,
   * not a 200 with a sad body, or it never gets restarted or pulled.
   *
   * Redis is checked because production runs it fail-closed: the refresh-token
   * deny-list treats "store unreachable" as revoked, so a Redis outage silently
   * breaks session refresh platform-wide. Without REDIS_URL (dev) it reports
   * 'disabled' and does not fail the check; validate-env.ts guarantees the URL
   * exists in production.
   *
   * Never throttled: the throttler fails closed in production, so a Redis
   * outage would otherwise make this return 429, the platform would read that
   * as an unhealthy instance, and a cache blip would become a restart loop.
   */
  @Public()
  @SkipThrottle()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    let redis: 'up' | 'down' | 'disabled' = 'disabled';
    const client = this.redis.instance;
    if (client) {
      try {
        await client.ping();
        redis = 'up';
      } catch {
        redis = 'down';
      }
    }

    const healthy = db === 'up' && redis !== 'down';
    res.status(healthy ? 200 : 503);
    return {
      status: healthy ? 'ok' : 'degraded',
      db,
      redis,
      time: new Date().toISOString(),
    };
  }
}
