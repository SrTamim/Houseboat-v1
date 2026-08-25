import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  SETTING_DEFS,
  SETTING_DEF_BY_KEY,
  type SettingDef,
  type SettingKey,
} from './setting-defs';

/**
 * Reads and writes runtime-editable operational settings.
 *
 * Reads go through a short-lived in-memory cache so hot paths (every cabin hold
 * reads hold.ttlMin) don't hit the DB each time. The cache is per-process and
 * invalidated on write; with a single API instance that is authoritative, and
 * even multi-instance staleness is bounded by CACHE_TTL_MS — acceptable for
 * values that change on human timescales. When no row exists (or the DB read
 * fails) the compiled-in default is returned, so an empty table — or a brief DB
 * blip — reproduces the prior hardcoded behaviour rather than breaking a booking.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache: Map<string, number> | null = null;
  private cacheAt = 0;
  private static readonly CACHE_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Numeric value for one setting, falling back to its default. */
  async getNumber(key: SettingKey): Promise<number> {
    const def = SETTING_DEF_BY_KEY[key];
    if (!def) throw new Error(`Unknown setting key: ${key}`);
    const map = await this.load();
    const val = map.get(key);
    return val ?? def.default;
  }

  /** Every setting with its current effective value + metadata, for the console. */
  async list(): Promise<
    (SettingDef & { value: number; isDefault: boolean })[]
  > {
    const map = await this.load();
    return SETTING_DEFS.map((def) => {
      const stored = map.get(def.key);
      return {
        ...def,
        value: stored ?? def.default,
        isDefault: stored === undefined,
      };
    });
  }

  /**
   * Set one setting. Validates against the def's min/max, records an audit row
   * with before/after, and clears the cache so the next read is fresh.
   */
  async set(key: string, value: number, actorId: string): Promise<void> {
    const def = SETTING_DEF_BY_KEY[key];
    if (!def) throw new BadRequestException(`Unknown setting: ${key}`);
    if (!Number.isInteger(value)) {
      throw new BadRequestException(`${def.label} must be a whole number`);
    }
    if (value < def.min || value > def.max) {
      throw new BadRequestException(
        `${def.label} must be between ${def.min} and ${def.max} ${def.unit}`,
      );
    }

    const before = await this.getNumber(key as SettingKey);
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: String(value) },
      update: { value: String(value) },
    });
    this.invalidate();

    await this.audit.log({
      actorAccountId: actorId,
      action: 'setting_update',
      entityType: 'app_setting',
      entityId: key,
      before: { value: before },
      after: { value },
    });
  }

  private invalidate() {
    this.cache = null;
    this.cacheAt = 0;
  }

  private async load(): Promise<Map<string, number>> {
    const now = Date.now();
    if (this.cache && now - this.cacheAt < SettingsService.CACHE_TTL_MS) {
      return this.cache;
    }
    const map = new Map<string, number>();
    try {
      const rows = await this.prisma.appSetting.findMany();
      for (const row of rows) {
        const n = Number(row.value);
        if (Number.isFinite(n)) map.set(row.key, n);
      }
    } catch (e) {
      // Never let a settings read break a booking/login: fall back to defaults.
      this.logger.warn(
        `Settings read failed, using defaults: ${(e as Error).message}`,
      );
    }
    this.cache = map;
    this.cacheAt = now;
    return map;
  }
}
