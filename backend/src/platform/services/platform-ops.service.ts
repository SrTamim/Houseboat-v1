import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { cursorArgs, toPage, type Page } from '../../common/paginate';
import type {
  ListAccountsQueryDto,
  ListAuditQueryDto,
  ListBookingsQueryDto,
  ListMembershipsQueryDto,
  ListNotificationsQueryDto,
  ListReschedulesQueryDto,
  ListReviewsQueryDto,
  ListRolesQueryDto,
  ListWaitlistQueryDto,
} from '../dto/platform.dto';

/**
 * Cross-boat operational reads for the platform console.
 */
@Injectable()
export class PlatformOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Non-secret runtime config status for the console settings page.
   *
   * SECRET VALUES NEVER CROSS THIS BOUNDARY — only presence booleans.
   * senderId / emailFrom / bucket / provider / URLs are display values, not
   * credentials. Settings themselves are env vars validated at boot
   * (config/validate-env.ts); this endpoint only reports state.
   */
  settingsStatus() {
    const get = <T>(key: string) => this.config.get<T>(key);
    const isProd = get<string>('env') === 'production';
    return {
      gateway: {
        provider: get<string>('gateway.provider') ?? null,
        sandbox: get<boolean>('gateway.sandbox') ?? true,
        storeConfigured:
          Boolean(get<string>('gateway.storeId')) &&
          Boolean(get<string>('gateway.storePassword')),
      },
      sms: {
        configured:
          Boolean(get<string>('notifications.smsApiUrl')) &&
          Boolean(get<string>('notifications.smsApiKey')),
        senderId: get<string>('notifications.smsSenderId') ?? null,
      },
      email: {
        configured: Boolean(get<string>('notifications.smtpUrl')),
        from: get<string>('notifications.emailFrom') ?? null,
      },
      storage: {
        configured:
          Boolean(get<string>('storage.endpoint')) &&
          Boolean(get<string>('storage.bucket')) &&
          Boolean(get<string>('storage.accessKeyId')) &&
          Boolean(get<string>('storage.secretAccessKey')),
        bucket: get<string>('storage.bucket') ?? null,
      },
      push: {
        configured:
          Boolean(get<string>('push.publicKey')) &&
          Boolean(get<string>('push.privateKey')),
      },
      // Mirrors main.ts: swagger is on outside prod, or when explicitly enabled.
      swaggerEnabled: !isProd || process.env.SWAGGER_ENABLED === 'true',
      env: get<string>('env') ?? 'development',
      webOrigin: get<string>('webOrigin') ?? null,
      apiPublicUrl: get<string>('apiPublicUrl') ?? null,
    };
  }

  /**
   * Live counts for the console dashboard and sidebar badges.
   *
   * One round-trip of cheap indexed counts (invoice.status and
   * houseboat.status are both indexed) rather than six requests.
   */
  async overview() {
    const [
      pendingBoats,
      liveBoats,
      invoicesToVerify,
      readyForPayout,
      refundsInFlight,
      waitlisted,
    ] = await this.prisma.$transaction([
      this.prisma.houseboat.count({ where: { status: 'pending' } }),
      this.prisma.houseboat.count({ where: { status: 'live' } }),
      this.prisma.invoice.count({ where: { status: 'paid' } }),
      this.prisma.invoice.count({ where: { status: 'payment_verified' } }),
      this.prisma.invoiceRefund.count({
        where: { status: { in: ['requested', 'verified'] } },
      }),
      this.prisma.bookingWaitlist.count(),
    ]);
    return {
      pendingBoats,
      liveBoats,
      invoicesToVerify,
      readyForPayout,
      refundsInFlight,
      waitlisted,
    };
  }

  /**
   * Every route, active or retired, with a count of boats using each.
   *
   * The public GET /api/routes returns only active ones — correct for the
   * booking site, but the moderation screen must show retired routes too or
   * they'd be impossible to reactivate.
   */
  listRoutes() {
    return this.prisma.route.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      include: {
        _count: { select: { houseboatRoutes: true } },
      },
    });
  }

  /**
   * Waitlist entries across all departures, newest first.
   *
   * WaitlistService.listForDeparture is departure-scoped and unrouted; the
   * console needs the platform-wide view with an optional filter.
   */
  async listWaitlist(query: ListWaitlistQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.bookingWaitlist.findMany({
      ...cursorArgs(query),
      where: query.departureId ? { departureId: query.departureId } : undefined,
      include: {
        // Narrow select: this is customer PII, so return only what the
        // waitlist screen renders.
        customer: { select: { id: true, name: true, phone: true } },
        departure: {
          select: {
            id: true,
            startDate: true,
            status: true,
            availableCount: true,
            package: {
              select: {
                durationLabel: true,
                houseboat: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });
    return toPage(rows, query);
  }

  /** Bookings across all boats, newest first. Boat filter goes via the departure's package. */
  async listBookings(query: ListBookingsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.booking.findMany({
      ...cursorArgs(query),
      where: {
        status: query.status ?? undefined,
        departure: query.houseboatId
          ? { package: { houseboatId: query.houseboatId } }
          : undefined,
      },
      select: {
        id: true,
        type: true,
        status: true,
        headcount: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true } },
        departure: {
          select: {
            id: true,
            startDate: true,
            status: true,
            package: {
              select: {
                durationLabel: true,
                houseboat: { select: { id: true, name: true } },
              },
            },
          },
        },
        invoice: {
          select: { id: true, status: true, displayTotal: true, amountPaid: true },
        },
        cabins: { select: { id: true } },
      },
    });
    return toPage(
      rows.map(({ cabins, ...b }) => ({ ...b, cabinCount: cabins.length })),
      query,
    );
  }

  async listReviews(query: ListReviewsQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.review.findMany({
      ...cursorArgs(query),
      where: query.houseboatId ? { houseboatId: query.houseboatId } : undefined,
      select: {
        id: true,
        rating: true,
        text: true,
        ownerReply: true,
        houseboat: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        booking: { select: { id: true, createdAt: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Account directory. `q` matches name, phone, or email. Password hash is
   * never selected; phone/email are PII the staff directory legitimately needs.
   */
  async listAccounts(query: ListAccountsQueryDto): Promise<Page<{ id: string }>> {
    const q = query.q?.trim();
    const rows = await this.prisma.account.findMany({
      ...cursorArgs(query),
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        phoneVerified: true,
        isPlatform: true,
        platformRole: { select: { id: true, name: true } },
        createdAt: true,
        _count: {
          select: { memberships: true, bookingsAsCustomer: true },
        },
      },
    });
    return toPage(rows, query);
  }

  async listMemberships(
    query: ListMembershipsQueryDto,
  ): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.houseboatMember.findMany({
      ...cursorArgs(query),
      where: {
        houseboatId: query.houseboatId ?? undefined,
        status: query.status ?? undefined,
      },
      select: {
        id: true,
        shareholderPct: true,
        startDate: true,
        endDate: true,
        status: true,
        account: { select: { id: true, name: true, phone: true } },
        houseboat: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });
    return toPage(rows, query);
  }

  async listReschedules(
    query: ListReschedulesQueryDto,
  ): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.bookingRescheduleHistory.findMany({
      ...cursorArgs(query),
      select: {
        id: true,
        oldPrice: true,
        newPrice: true,
        reason: true,
        changedAt: true,
        booking: {
          select: {
            id: true,
            customer: { select: { id: true, name: true } },
          },
        },
        prevDeparture: {
          select: {
            startDate: true,
            package: { select: { houseboat: { select: { name: true } } } },
          },
        },
        toDeparture: { select: { startDate: true } },
        changedByAccount: { select: { id: true, name: true } },
      },
    });
    return toPage(rows, query);
  }

  async listNotifications(
    query: ListNotificationsQueryDto,
  ): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.notification.findMany({
      ...cursorArgs(query),
      where: {
        channel: query.channel ?? undefined,
        delivered:
          query.delivered === undefined ? undefined : query.delivered === 'true',
      },
      select: {
        id: true,
        event: true,
        channel: true,
        delivered: true,
        at: true,
        // Selected only to derive hasPayload — message bodies stay off the
        // list wire format.
        payload: true,
        account: { select: { id: true, name: true, phone: true } },
      },
    });
    return toPage(
      rows.map(({ payload, ...row }) => ({
        ...row,
        hasPayload: payload !== null,
      })),
      query,
    );
  }

  /** Per-boat roles across the platform, with member counts. Read-only. */
  async listRoles(query: ListRolesQueryDto): Promise<Page<{ id: string }>> {
    const rows = await this.prisma.role.findMany({
      ...cursorArgs(query),
      where: { houseboatId: query.houseboatId ?? undefined },
      select: {
        id: true,
        name: true,
        isTemplate: true,
        houseboat: { select: { id: true, name: true } },
        _count: { select: { members: true, staff: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Departures at or past their date that have not finished advancing —
   * the cutoff/finalize watch view. The status-advance job normally moves
   * these; a row lingering here means it is stuck.
   */
  listDueDepartures() {
    return this.prisma.tripDeparture.findMany({
      where: {
        startDate: { lte: new Date() },
        status: { in: ['scheduled', 'in_progress'] },
      },
      orderBy: { startDate: 'asc' },
      take: 100,
      select: {
        id: true,
        startDate: true,
        endDate: true,
        status: true,
        availableCount: true,
        package: {
          select: {
            durationLabel: true,
            houseboat: { select: { id: true, name: true } },
          },
        },
        _count: { select: { bookings: true, holds: true } },
      },
    });
  }

  /**
   * Audit log browse, newest first.
   *
   * Paged by server_time (`before`) rather than the shared cursor helper —
   * audit_log's PK is composite (id, server_time) for partitioning, so Prisma
   * cannot cursor on `id` alone.
   */
  async listAudit(query: ListAuditQueryDto) {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const rows = await this.prisma.auditLog.findMany({
      take: limit + 1,
      orderBy: { serverTime: 'desc' },
      where: {
        houseboatId: query.houseboatId ?? undefined,
        action: query.action ?? undefined,
        serverTime: query.before ? { lt: new Date(query.before) } : undefined,
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        serverTime: true,
        syncedOffline: true,
        houseboat: { select: { id: true, name: true } },
        actor: { select: { id: true, name: true, phone: true } },
      },
    });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return {
      items,
      nextBefore: hasMore
        ? (items[items.length - 1]?.serverTime.toISOString() ?? null)
        : null,
    };
  }
}
