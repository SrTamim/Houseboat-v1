import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, PlatformOnly } from '../../auth/decorators';
import { AuthUser } from '../../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PlatformPermission } from '../rbac/platform-permission.decorator';
import { SettingsService } from '../settings/settings.service';
import { UpdateSettingDto } from '../dto/platform.dto';

/**
 * Admin "System & health" surface: read/edit runtime operational settings and
 * read a live health snapshot. Class-guarded @PlatformOnly() like the other
 * platform controllers; the settings module gates it (view to read, edit to
 * write).
 */
@PlatformOnly()
@PlatformPermission('jobs', 'view')
@Controller('platform/system')
export class PlatformSystemController {
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Every editable setting with its current value, bounds and display metadata. */
  @Get('settings')
  listSettings() {
    return this.settings.list();
  }

  /** Update one setting. Bounds + audit are enforced in the service. */
  @PlatformPermission('jobs', 'edit')
  @Put('settings/:key')
  async updateSetting(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.settings.set(key, dto.value, user.id);
    return { ok: true };
  }

  /**
   * Live health snapshot for the console panel. Mirrors the public /health probe
   * (db + redis reachability) but is staff-gated and never sets a non-200 status
   * — the console only displays it, it isn't a load-balancer probe.
   */
  @SkipThrottle()
  @Get('health')
  async health() {
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

    return {
      status: db === 'up' && redis !== 'down' ? 'ok' : 'degraded',
      db,
      redis,
      time: new Date().toISOString(),
    };
  }

  /**
   * SMS provider balance for the console. Never returns the API key — only the
   * balance (or a "not configured" flag). Polled by the page, so throttle-exempt
   * like health().
   */
  @SkipThrottle()
  @Get('sms-balance')
  async smsBalance() {
    const result = await this.notifications.getSmsBalance();
    return { ...result, time: new Date().toISOString() };
  }
}
