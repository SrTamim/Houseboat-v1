import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

export interface AuditEntry {
  houseboatId?: string | null;
  actorAccountId?: string | null;
  action: string; // mark_paid, void, price_change, role_change…
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  /** device clock for offline-synced actions; server stamps server_time itself */
  deviceTime?: Date;
  syncedOffline?: boolean;
  /** request origin — needed to tell a normal action from a hijacked session */
  ip?: string | null;
  userAgent?: string | null;
}

/** Request shape we need for audit context — avoids importing express here. */
export interface AuditRequestLike {
  ip?: string;
  headers?: Record<string, unknown>;
}

/**
 * Pull IP + user agent off a request for an AuditEntry.
 *
 * req.ip is only trustworthy because main.ts sets `trust proxy` — otherwise
 * every request behind the platform proxy reports the same address.
 */
export function auditContext(req?: AuditRequestLike): {
  ip: string | null;
  userAgent: string | null;
} {
  const ua = req?.headers?.['user-agent'];
  return {
    ip: req?.ip ?? null,
    userAgent: typeof ua === 'string' ? ua : null,
  };
}

/**
 * Append-only audit trail. The DB trigger (trg_audit_no_update) blocks any
 * UPDATE/DELETE, so this service only ever INSERTs. Mask PII in before/after —
 * store references, never raw bank details.
 *
 * Accepts an optional Prisma transaction client so an audit row commits (or
 * rolls back) atomically with the action it records.
 */
@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pre-create the current and next month's audit_log partitions on boot.
   *
   * Partitioning migration 00000000000003 used to auto-create the month
   * partition from a BEFORE INSERT trigger, but `CREATE TABLE ... PARTITION OF`
   * cannot run while that same INSERT holds the parent lock — the first insert
   * of every new month failed with SQLSTATE 55006 and turned successful logins
   * into 500s. We create partitions here instead, outside any insert, so the
   * error is impossible. Idempotent (audit_log_ensure_partition is a no-op if
   * the partition exists) and best-effort: the DEFAULT partition still catches
   * any month we miss, so a failure here must not block startup.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(
        `SELECT audit_log_ensure_partition(date_trunc('month', now())::timestamptz)`,
      );
      await this.prisma.$executeRawUnsafe(
        `SELECT audit_log_ensure_partition((date_trunc('month', now()) + interval '1 month')::timestamptz)`,
      );
    } catch (e) {
      this.logger.error(
        'Failed to pre-create audit_log month partitions on boot; ' +
          'new rows will land in audit_log_default until fixed',
        e instanceof Error ? e.stack : String(e),
      );
    }
  }

  async log(
    entry: AuditEntry,
    tx?: Pick<PrismaService, 'auditLog'>,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        id: newId(),
        houseboatId: entry.houseboatId ?? null,
        actorAccountId: entry.actorAccountId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        deviceTime: entry.deviceTime,
        syncedOffline: entry.syncedOffline ?? false,
        ip: entry.ip ?? null,
        // Bound it: User-Agent is attacker-controlled free text.
        userAgent: entry.userAgent?.slice(0, 512) ?? null,
      },
    });
  }

  /**
   * Read the trail for one boat, newest first.
   *
   * Keyset-paged on (server_time, id) rather than the shared id-only cursor in
   * common/paginate: audit_log is partitioned by month and its PK is composite,
   * so an id alone does not identify a row. The cursor is "<ISO>|<id>".
   */
  async list(
    houseboatId: string,
    opts: {
      action?: string;
      search?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit?: number;
    } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

    let before: { serverTime: Date; id: string } | null = null;
    if (opts.cursor) {
      const [time, id] = opts.cursor.split('|');
      const parsed = new Date(time);
      if (!Number.isNaN(parsed.getTime()) && id) {
        before = { serverTime: parsed, id };
      }
    }

    // Each condition group is a separate AND element so they intersect rather
    // than collide: the keyset OR, the search OR and the serverTime range all
    // constrain independently. Sharing one top-level OR key would let a later
    // filter silently overwrite the keyset cursor and break "Load more".
    const and: Prisma.AuditLogWhereInput[] = [];

    if (before) {
      and.push({
        OR: [
          { serverTime: { lt: before.serverTime } },
          { serverTime: before.serverTime, id: { lt: before.id } },
        ],
      });
    }

    if (opts.search) {
      // phone is digits — plain contains, no case folding.
      and.push({
        OR: [
          { action: { contains: opts.search, mode: 'insensitive' } },
          { actor: { is: { name: { contains: opts.search, mode: 'insensitive' } } } },
          { actor: { is: { phone: { contains: opts.search } } } },
        ],
      });
    }

    const from = opts.from ? new Date(opts.from) : null;
    const to = opts.to ? new Date(opts.to) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      and.push({
        serverTime: {
          ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
          ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
        },
      });
    }

    const rows = await this.prisma.auditLog.findMany({
      where: {
        houseboatId,
        ...(opts.action ? { action: opts.action } : {}),
        ...(and.length ? { AND: and } : {}),
      },
      orderBy: [{ serverTime: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        deviceTime: true,
        serverTime: true,
        syncedOffline: true,
        actor: { select: { id: true, name: true, phone: true } },
      },
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return {
      items,
      nextCursor:
        hasMore && last ? `${last.serverTime.toISOString()}|${last.id}` : null,
    };
  }

  /** Distinct actions present for a boat — populates the audit filter dropdown. */
  async actions(houseboatId: string): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { houseboatId },
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
      take: 100,
    });
    return rows.map((r) => r.action);
  }

  /**
   * Best-effort variant for paths where the audit row must not be able to fail
   * the request — notably failed logins, where throwing would turn a wrong
   * password into a 500 and hand an attacker a way to distinguish accounts.
   *
   * Never use this inside a transaction: there `log()` must throw so the audit
   * row and the action it records commit or roll back together.
   */
  async tryLog(entry: AuditEntry): Promise<void> {
    try {
      await this.log(entry);
    } catch (e) {
      this.logger.error(
        `Failed to write audit row for "${entry.action}"`,
        e instanceof Error ? e.stack : String(e),
      );
    }
  }
}
