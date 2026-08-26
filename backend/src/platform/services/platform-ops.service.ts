import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
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
    private readonly audit: AuditService,
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
        // Local driver is always ready (writes to disk); R2 needs its creds.
        configured:
          (get<string>('storage.driver') ?? 'local') === 'local' ||
          (Boolean(get<string>('storage.endpoint')) &&
            Boolean(get<string>('storage.bucket')) &&
            Boolean(get<string>('storage.accessKeyId')) &&
            Boolean(get<string>('storage.secretAccessKey'))),
        driver: get<string>('storage.driver') ?? 'local',
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
      // Only gateway receipts are the platform's to verify — owner-recorded
      // cash/bkash/bank/online settle on the owner's word and never queue here.
      this.prisma.invoice.count({
        where: { status: 'paid', payments: { some: { method: 'gateway' } } },
      }),
      // Must mirror the Payouts page list (payoutQueue in
      // platform-finance.service.ts): verified/approved, unbatched, trip
      // completed, fully paid — otherwise the sidebar badge counts rows the
      // page never shows and never clears.
      this.prisma.invoice.count({
        where: {
          status: { in: ['payment_verified', 'payout_approved'] },
          payoutBatchId: null,
          amountPaid: { gte: this.prisma.invoice.fields.displayTotal },
          booking: { is: { status: 'completed' } },
        },
      }),
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
    const q = query.q?.trim();
    const rows = await this.prisma.booking.findMany({
      ...cursorArgs(query),
      where: {
        status: query.status ?? undefined,
        departure: query.houseboatId
          ? { package: { houseboatId: query.houseboatId } }
          : undefined,
        ...(q
          ? {
              OR: [
                { customer: { name: { contains: q, mode: 'insensitive' } } },
                { customer: { phone: { contains: q } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        type: true,
        channel: true,
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

  /**
   * Full detail for one booking — powers the admin "Open" drawer. Read-only:
   * the customer, trip/boat, per-cabin manifest, the invoice bill breakdown with
   * its payments, and any reschedule history. 404 if the id is unknown.
   */
  async getBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        type: true,
        channel: true,
        status: true,
        headcount: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
        departure: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            package: {
              select: {
                durationLabel: true,
                houseboat: { select: { id: true, name: true } },
              },
            },
          },
        },
        cabins: {
          select: {
            id: true,
            adults: true,
            children: true,
            occupancy: true,
            roomPrice: true,
            isOpenSeat: true,
            cabin: { select: { id: true, name: true } },
          },
        },
        guests: {
          select: { id: true, name: true, phone: true, email: true },
        },
        invoice: {
          select: {
            id: true,
            status: true,
            roomTotal: true,
            discountAmount: true,
            displayTotal: true,
            amountPaid: true,
            amountOverpaid: true,
            payments: {
              select: {
                id: true,
                amount: true,
                method: true,
                paidAt: true,
              },
              orderBy: { paidAt: 'asc' },
            },
          },
        },
        rescheduleHistory: {
          select: {
            id: true,
            oldPrice: true,
            newPrice: true,
            reason: true,
            changedAt: true,
            prevDeparture: { select: { startDate: true } },
            toDeparture: { select: { startDate: true } },
            changedByAccount: { select: { id: true, name: true } },
          },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async listReviews(query: ListReviewsQueryDto): Promise<Page<{ id: string }>> {
    const q = query.q?.trim();
    const rows = await this.prisma.review.findMany({
      ...cursorArgs(query),
      where: {
        houseboatId: query.houseboatId ?? undefined,
        hidden:
          query.hidden === undefined ? undefined : query.hidden === 'true',
        ...(q
          ? {
              OR: [
                { text: { contains: q, mode: 'insensitive' } },
                { customer: { name: { contains: q, mode: 'insensitive' } } },
                { houseboat: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        rating: true,
        text: true,
        ownerReply: true,
        hidden: true,
        houseboat: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        booking: { select: { id: true, createdAt: true } },
      },
    });
    return toPage(rows, query);
  }

  /**
   * Hide or unhide a review (platform moderation). A hidden review is withheld
   * from public listings and rating aggregates; every toggle is audited.
   */
  async setReviewHidden(reviewId: string, hidden: boolean, actorId: string) {
    const existing = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, hidden: true, houseboatId: true },
    });
    if (!existing) throw new NotFoundException('Review not found');
    if (existing.hidden === hidden) return { ok: true };

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { hidden },
    });
    await this.audit.log({
      houseboatId: existing.houseboatId,
      actorAccountId: actorId,
      action: hidden ? 'review_hidden' : 'review_unhidden',
      entityType: 'review',
      entityId: reviewId,
      before: { hidden: existing.hidden },
      after: { hidden },
    });
    return { ok: true };
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
    const q = query.q?.trim();
    const rows = await this.prisma.houseboatMember.findMany({
      ...cursorArgs(query),
      where: {
        houseboatId: query.houseboatId ?? undefined,
        status: query.status ?? undefined,
        ...(q
          ? {
              OR: [
                { account: { name: { contains: q, mode: 'insensitive' } } },
                { account: { phone: { contains: q } } },
                { houseboat: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }
          : {}),
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
    const q = query.q?.trim();
    // Range on server_time: `before` is the exclusive upper bound (older-page
    // cursor), `after` the inclusive lower bound (a date-range filter).
    const serverTime =
      query.before || query.after
        ? {
            ...(query.before ? { lt: new Date(query.before) } : {}),
            ...(query.after ? { gte: new Date(query.after) } : {}),
          }
        : undefined;
    const rows = await this.prisma.auditLog.findMany({
      take: limit + 1,
      orderBy: { serverTime: 'desc' },
      where: {
        houseboatId: query.houseboatId ?? undefined,
        action: query.action ?? undefined,
        serverTime,
        // "Admin panel activity" proxy: AuditLog has no actor-role column, so
        // restrict to actors flagged as platform staff. Default-on for the admin
        // audit page; 'false'/absent returns all actors.
        ...(query.platformOnly === 'true'
          ? { actor: { is: { isPlatform: true } } }
          : {}),
        ...(q
          ? {
              OR: [
                { action: { contains: q, mode: 'insensitive' } },
                { actor: { is: { name: { contains: q, mode: 'insensitive' } } } },
                { actor: { is: { phone: { contains: q } } } },
              ],
            }
          : {}),
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
