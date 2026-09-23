import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PricingService } from '../pricing/pricing.service';
import { AuditService } from '../audit/audit.service';
import { RbacService } from '../rbac/rbac.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityGateway } from '../realtime/availability.gateway';
import { SettingsService } from '../platform/settings/settings.service';
import { encryptJson } from '../common/crypto';
import { newId } from '../common/uuid';
import { money, ZERO, add, sub, percentOf } from '../common/money';
import { buildBill, CouponInput } from '../common/billing';
import { priceForParty, ChildBand } from '../common/child-policy';
import {
  refundPercent,
  refundAmount,
  daysUntil,
  PolicySnapshot,
} from '../common/cancellation';
import { InvoiceStatus, assertTransition } from '../money/invoice-state';
import { CheckoutDto } from './dto/booking.dto';
import { MIN_DEPOSIT_PCT } from './booking.limits';

/** A cabin to price. `holdId` is only needed by the checkout conversion. */
export interface PriceableCabin {
  cabinId: string;
  holdId?: string;
  adults: number;
  children?: number;
  childAges?: number[];
  openSeat?: boolean;
}

/** Owner-only pricing controls, supplied by the counter-sale path only. */
export interface PriceOpts {
  /** cabinId → manual room price, for cabins with no configured rate. */
  overrides?: Map<string, number>;
  /** Flat taka discount folded into the bill. */
  ownerDiscount?: number | null;
  /** false = don't throw on a missing rate; mark the cabin unpriced instead. */
  throwOnUnpriced?: boolean;
  /**
   * Counter-sale only: allow a headcount above the cabin's rated capacity. Such
   * a cabin is returned unpriced (needs a manual price) rather than rejected.
   */
  allowOverCapacity?: boolean;
  /**
   * Booking origin. 'pos' (owner counter sale) forces commission to 0 — the
   * platform only earns on 'web' customer self-service bookings. Defaults to
   * 'web' everywhere it is unset. Persisted on Booking.channel at creation.
   */
  channel?: 'web' | 'pos';
  /**
   * The customer the booking is for. Used to enforce a coupon's per-user
   * redemption limit. Optional: the price-quote path may omit it (limits then
   * fall back to the global maxUses check only).
   */
  customerId?: string;
  /**
   * The caller's guest token (hb_gid). At checkout a hold still owned by a guest
   * token (login-claim didn't run) may be converted ONLY if its heldByToken
   * matches this — so a caller can never convert a stranger's unclaimed hold
   * (audit B-H3). Undefined → only account-owned holds convert.
   */
  callerToken?: string;
}

/**
 * Booking + checkout. Converts held cabins into a confirmed booking, its
 * booking_cabin rows, and a single invoice — atomically (plan §11).
 *
 * Price is set at the ROOM SELECTION step from adults+children and the date's
 * pricing profile. The invoice is built with the fixed bill order (billing.ts).
 * Confirmation is instant; no owner approval.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly audit: AuditService,
    private readonly rbac: RbacService,
    private readonly notifications: NotificationsService,
    private readonly realtime: AvailabilityGateway,
    private readonly config: ConfigService,
    // Last, and @Optional(): the booking unit tests construct this service with
    // seven positional args. Adding a required eighth would leave it undefined
    // there anyway (the `as never` casts hide it from tsc), so the one place
    // that uses it — get(), for the invoice logo — optional-chains the call.
    @Optional() private readonly storage?: StorageService,
    // Also @Optional() for the same reason: the unit tests don't provide it, so
    // priceSelection() falls back to the compiled-in child ceiling when absent.
    @Optional() private readonly settings?: SettingsService,
  ) {}

  /**
   * Encrypt a NID/passport for at-rest storage, or return null when absent.
   * Ciphertext is never returned to clients or logged (redacted in pino).
   */
  private encryptNid(nid?: string): string | null {
    const v = nid?.trim();
    if (!v) return null;
    return encryptJson(v, this.config.get<string>('encryptionKey') ?? '');
  }

  /**
   * Tell the waitlist that a place freed (plan §2 — all at once, no queue, the
   * link routes through a normal hold so first-to-hold wins).
   *
   * Scoped to the cabins that actually freed: someone waiting on cabin B should
   * not be texted because cabin A opened. Rows with a NULL cabin mean "any cabin
   * on this trip", so they are always included.
   */
  private async notifyWaitlist(
    departureId: string,
    boatName: string,
    freedCabinIds: string[],
  ): Promise<void> {
    const waiting = await this.prisma.bookingWaitlist.findMany({
      where: {
        departureId,
        OR: [{ cabinId: null }, { cabinId: { in: freedCabinIds } }],
      },
      include: {
        customer: { select: { id: true, phone: true, email: true } },
        cabin: { select: { name: true } },
      },
    });
    await Promise.all(
      waiting.map((w) =>
        this.notifications.notify({
          accountId: w.customer.id,
          event: 'waitlist_open',
          to: {
            phone: w.customer.phone ?? undefined,
            email: w.customer.email ?? undefined,
          },
          subject: `A place opened on ${boatName}`,
          // Name the cabin when they asked for a specific one — an alert they
          // can act on beats a generic "something freed".
          message: w.cabin
            ? `${w.cabin.name} just freed on ${boatName}. First to book wins — grab it now.`
            : `A cabin just freed on ${boatName}. First to book wins — grab it now.`,
        }),
      ),
    );
  }

  /**
   * Spend the customer's open credits toward an invoice, up to `cap` (the amount
   * owed). Consumes credits oldest-first; a credit larger than the remaining cap
   * is split (the leftover stays open). Returns the total credit applied.
   */
  private async applyCredits(
    tx: Prisma.TransactionClient,
    accountId: string,
    invoiceId: string,
    cap: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    // Lock this account's open credit rows for the life of the transaction.
    // Without it, two checkouts the same customer fires at once could both read
    // the same open credits and each spend them — double-spending the wallet.
    // Prisma has no FOR UPDATE, so take the row locks with raw SQL first; the
    // second checkout then blocks here until the first commits and sees the
    // credits already 'used'. FIFO order matches the findMany below.
    await tx.$queryRaw`
      SELECT id FROM customer_credit
      WHERE account_id = ${accountId}::uuid AND status = 'open'
      ORDER BY id ASC
      FOR UPDATE`;
    const credits = await tx.customerCredit.findMany({
      where: { accountId, status: 'open' },
      orderBy: { id: 'asc' }, // UUIDv7 ids are time-ordered → FIFO
    });
    let remaining = money(cap);
    let applied = ZERO;
    for (const c of credits) {
      if (!remaining.greaterThan(ZERO)) break;
      const amt = money(c.amount);
      if (amt.greaterThan(remaining)) {
        // Partially spend: close this credit for `remaining`, reopen the rest.
        await tx.customerCredit.update({
          where: { id: c.id },
          data: { amount: remaining, status: 'used', usedInInvoiceId: invoiceId },
        });
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId,
            sourceInvoiceId: c.sourceInvoiceId,
            amount: sub(amt, remaining),
            status: 'open',
            kind: c.kind, // remainder inherits the original's kind (same money)
          },
        });
        applied = add(applied, remaining);
        remaining = ZERO;
      } else {
        await tx.customerCredit.update({
          where: { id: c.id },
          data: { status: 'used', usedInInvoiceId: invoiceId },
        });
        applied = add(applied, amt);
        remaining = sub(remaining, amt);
      }
    }
    return applied;
  }

  /**
   * Resolve an applicable coupon, or null when it does not apply.
   *
   * Beyond active + date-window, this now enforces the usage limits (audit
   * M-H1): a coupon that is exhausted (maxUses reached), already used up by this
   * customer (perUserLimit), or below its minSpend simply does NOT apply —
   * returns null exactly like an invalid code, so the bill is charged in full
   * rather than the whole checkout failing. Only non-cancelled bookings count
   * toward a limit (a cancelled booking freed the redemption).
   *
   * `priceShown` (room total) drives the minSpend check; `customerId` drives the
   * per-user check (omit it in the quote path to skip only that one).
   */
  private async resolveCoupon(
    houseboatId: string,
    code: string | undefined,
    when: Date,
    priceShown?: Prisma.Decimal,
    customerId?: string,
  ): Promise<{ id: string; input: CouponInput } | null> {
    if (!code) return null;
    const coupon = await this.prisma.coupon.findFirst({
      where: {
        houseboatId,
        code,
        isActive: true,
        OR: [{ validFrom: null }, { validFrom: { lte: when } }],
        AND: [{ OR: [{ validTo: null }, { validTo: { gte: when } }] }],
      },
    });
    if (!coupon) return null;

    // Minimum spend (against the pre-discount room total).
    if (
      coupon.minSpend != null &&
      priceShown != null &&
      priceShown.lessThan(money(coupon.minSpend))
    ) {
      return null;
    }

    // Total redemptions across all customers.
    if (coupon.maxUses != null) {
      const totalUsed = await this.prisma.booking.count({
        where: { couponId: coupon.id, status: { not: 'cancelled' } },
      });
      if (totalUsed >= coupon.maxUses) return null;
    }

    // Per-customer redemptions.
    if (coupon.perUserLimit != null && customerId) {
      const byCustomer = await this.prisma.booking.count({
        where: {
          couponId: coupon.id,
          customerId,
          status: { not: 'cancelled' },
        },
      });
      if (byCustomer >= coupon.perUserLimit) return null;
    }

    return {
      id: coupon.id,
      input: {
        kind: coupon.kind as CouponInput['kind'],
        value: money(coupon.value),
      },
    };
  }

  /**
   * Re-verify a coupon's maxUses/perUserLimit INSIDE the booking tx, holding a
   * FOR UPDATE lock on the coupon row so concurrent redemptions serialize (audit
   * #8/F4). Returns false when redeeming now would exceed a limit. minSpend is
   * not re-checked — it is a function of the (already-fixed) price, not a race.
   */
  private async couponRedeemableInTx(
    tx: Prisma.TransactionClient,
    couponId: string,
    customerId?: string,
  ): Promise<boolean> {
    await tx.$queryRaw`
      SELECT id FROM coupon WHERE id = ${couponId}::uuid FOR UPDATE`;
    const coupon = await tx.coupon.findUnique({
      where: { id: couponId },
      select: { maxUses: true, perUserLimit: true },
    });
    if (!coupon) return false;
    if (coupon.maxUses != null) {
      const totalUsed = await tx.booking.count({
        where: { couponId, status: { not: 'cancelled' } },
      });
      if (totalUsed >= coupon.maxUses) return false;
    }
    if (coupon.perUserLimit != null && customerId) {
      const byCustomer = await tx.booking.count({
        where: { couponId, customerId, status: { not: 'cancelled' } },
      });
      if (byCustomer >= coupon.perUserLimit) return false;
    }
    return true;
  }

  /**
   * Price a cabin selection WITHOUT writing anything — the single source of
   * truth for what a booking costs. Both real checkout and the counter-sale
   * price quote call this, so a quoted price can never diverge from the price
   * the booking is actually billed at.
   *
   * `opts.overrides` (cabinId → room price) lets the counter operator set a
   * manual price for a cabin whose occupancy tier has no configured rate; it
   * replaces the computed room_price for that cabin only. `opts.ownerDiscount`
   * is a flat taka discount folded into the bill. Both are owner-only and are
   * never reachable from the customer checkout path.
   *
   * `throwOnUnpriced` (checkout) surfaces a missing rate as an error; the quote
   * path passes false so an unpriced cabin comes back marked `priced:false`
   * (room_price 0) for the UI to show a manual-price input instead of crashing.
   */
  async priceSelection(
    dto: {
      departureId: string;
      cabins: PriceableCabin[];
      couponCode?: string;
    },
    opts?: PriceOpts,
  ) {
    const departure = await this.prisma.tripDeparture.findUnique({
      where: { id: dto.departureId },
      include: { package: { include: { houseboat: { select: { id: true, childPolicy: true } } } } },
    });
    if (!departure) throw new NotFoundException('Departure not found');
    if (departure.status !== 'scheduled') {
      throw new BadRequestException('Departure is no longer bookable');
    }
    const houseboatId = departure.package.houseboatId;

    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    const commissionPct = billing?.commissionPct
      ? money(billing.commissionPct)
      : null;

    const overrides = opts?.overrides;
    const throwOnUnpriced = opts?.throwOnUnpriced ?? true;

    // Compute each cabin's room price from its category + occupancy + date.
    const cabinRows: {
      cabinId: string;
      holdId: string;
      adults: number;
      children: number;
      occupancy: number;
      roomPrice: Prisma.Decimal;
      isOpenSeat: boolean;
      /** false when there was no configured rate AND no manual override. */
      priced: boolean;
    }[] = [];
    let roomTotal = ZERO;

    for (const sel of dto.cabins) {
      const cabin = await this.prisma.houseboatCabin.findUnique({
        where: { id: sel.cabinId },
        include: { category: true },
      });
      if (!cabin) throw new NotFoundException(`Cabin ${sel.cabinId} not found`);

      const children = sel.children ?? 0;
      // Admin-editable per-cabin children cap. The DTO already enforces the hard
      // ceiling (MAX_CHILDREN_PER_CABIN) at request validation; this enforces the
      // lower, admin-tightened value in the shared pricing path. Self-service
      // only — the counter path (allowOverCapacity) stays uncapped, exactly like
      // the DTO. Falls back to no extra cap when settings is absent (unit tests).
      if (!opts?.allowOverCapacity && this.settings) {
        const maxChildren = await this.settings.getNumber(
          'booking.maxChildrenPerCabin',
        );
        if (children > maxChildren) {
          throw new BadRequestException(
            `Cabin ${cabin.name}: up to ${maxChildren} children per cabin`,
          );
        }
      }
      /**
       * Total heads in the room. This is the MANIFEST figure: it is persisted on
       * booking_cabin.occupancy and read as a head count by the owner dashboard,
       * the financial reports, booking.headcount and the open-seat `spare`
       * calculation. It must always be adults + children.
       */
      const occupancy = sel.adults + children;
      /**
       * Which of the owner's price rows to use. Adults only — the owner sets a
       * rate per ADULT party size ("2 people", "3 people"…), and children are
       * then discounted off that rate by the boat's child_policy. Counting
       * children here would jump to a different (or non-existent) row: a 2-berth
       * cabin with 2 adults + 3 children looked like occupancy 5, which had no
       * rate row and was rejected outright, so the price silently stopped
       * updating as soon as a child was added.
       */
      const payingHeads = sel.adults;
      const baseCap = cabin.category.baseCapacity;
      const cap = cabin.category.extendedCapacity ?? baseCap;

      if (payingHeads === 0 && children > 0) {
        throw new BadRequestException(
          `Cabin ${cabin.name}: add at least one adult — children cannot book a cabin alone`,
        );
      }

      // A manual override (owner-typed price) wins over the pricing profile — it
      // exists precisely for cabins whose occupancy tier has no configured rate.
      const override = overrides?.get(sel.cabinId);

      // Over the cabin's rated capacity. Judged on ADULTS: children share their
      // parents' berths, so a family may exceed the bed count (capped separately
      // per booking). Online booking treats this as a hard limit; the counter may
      // oversell (real walk-ups get squeezed in), so when allowOverCapacity is
      // set we don't throw — the cabin just needs a manual price (there's no rate
      // row beyond capacity). An override satisfies that.
      const overCapacity = payingHeads > cap;
      if (overCapacity && !opts?.allowOverCapacity) {
        throw new BadRequestException(
          `Cabin ${cabin.name}: ${payingHeads} adults exceeds capacity ${cap}`,
        );
      }

      // Open seat (plan §3): the party doesn't fill the room and chooses to share
      // the spare place(s). It's priced at the full-capacity BUYOUT, and the room
      // is offered to others until it fills. (Not applicable over capacity.)
      //
      // Uses total heads, not payingHeads: sharing is about physical berths, so a
      // room filled by adults + children has no place left to sell.
      const isOpenSeat =
        !overCapacity && Boolean(sel.openSeat) && occupancy < baseCap;
      if (sel.openSeat && !overCapacity && occupancy >= baseCap) {
        throw new BadRequestException(
          `Cabin ${cabin.name}: it is already full — no open seat to share`,
        );
      }

      let roomPrice: Prisma.Decimal;
      let priced = true;
      if (override !== undefined) {
        roomPrice = money(override);
      } else if (overCapacity) {
        // Allowed oversell with no manual price yet. There is no rate row beyond
        // capacity, so it needs a manual price. The quote marks it unpriced (for
        // the manual-price input); checkout must not silently bill ৳0, so it
        // fails loudly exactly like any other unpriced cabin.
        if (throwOnUnpriced) {
          throw new BadRequestException(
            `Cabin ${cabin.name}: set a price for ${payingHeads} adults (over the rated capacity ${cap}).`,
          );
        }
        roomPrice = ZERO;
        priced = false;
      } else if (isOpenSeat) {
        roomPrice = await this.pricing.priceFor(
          houseboatId,
          cabin.cabinCategoryId,
          baseCap,
          departure.startDate,
          departure.package.routeId,
        );
      } else {
        // The room total is the per-person rate for this ADULT party size, applied
        // per adult, plus each child at its child_policy age-band fraction of the
        // same rate. Children never change which rate row is used.
        try {
          const perPerson = await this.pricing.pricePerPersonFor(
            houseboatId,
            cabin.cabinCategoryId,
            payingHeads,
            departure.startDate,
            departure.package.routeId,
          );
          roomPrice = priceForParty({
            pricePerPerson: perPerson,
            adults: sel.adults,
            children,
            childAges: sel.childAges,
            childPolicy: departure.package.houseboat.childPolicy as
              | ChildBand[]
              | null,
          });
        } catch (e) {
          // No configured rate for this occupancy tier. Checkout must fail loudly;
          // the quote path swallows it and marks the cabin unpriced so the UI can
          // offer a manual price input.
          if (throwOnUnpriced) throw e;
          roomPrice = ZERO;
          priced = false;
        }
      }
      roomTotal = add(roomTotal, roomPrice);
      cabinRows.push({
        cabinId: sel.cabinId,
        holdId: sel.holdId ?? '',
        adults: sel.adults,
        children,
        occupancy,
        roomPrice,
        isOpenSeat,
        priced,
      });
    }

    const coupon = await this.resolveCoupon(
      houseboatId,
      dto.couponCode,
      departure.startDate,
      roomTotal,
      opts?.customerId,
    );
    // POS counter sales earn the platform no commission; force it to 0 by
    // dropping the boat's rate. 'web' (default) keeps the configured rate.
    const effectiveCommissionPct =
      opts?.channel === 'pos' ? null : commissionPct;
    const bill = buildBill({
      roomTotal,
      commissionPct: effectiveCommissionPct,
      coupon: coupon?.input,
      ownerDiscount: opts?.ownerDiscount != null ? money(opts.ownerDiscount) : null,
    });

    return { departure, houseboatId, cabinRows, coupon, bill };
  }

  /**
   * Checkout: caller must already hold every cabin (holdId per cabin). We
   * convert the holds, create booking + cabins + invoice in one transaction.
   * If any hold is not valid/owned, the whole thing rolls back.
   *
   * This is the DIRECT path — used by owner POS (counter staff take payment
   * their own way, no deposit gate). The customer self-service path does NOT
   * call this; it goes createIntent → confirmIntent so a booking is only created
   * once a valid deposit is confirmed (audit M-H2).
   */
  async checkout(
    customerId: string,
    bookedBy: string,
    dto: CheckoutDto,
    opts?: PriceOpts,
  ) {
    const priced = await this.priceSelection(dto, { ...opts, customerId });
    return this.prisma.$transaction((tx) =>
      this.createBookingTx(tx, { customerId, bookedBy, dto, opts, priced }),
    );
  }

  /**
   * The shared booking-creation transaction body: convert this caller's holds,
   * create booking + cabins + guest + invoice, apply credits. Optionally records
   * an initial payment (the confirmed deposit) in the SAME transaction so a
   * booking never exists without its deposit. Reused by checkout() (POS, no
   * initialPayment) and confirmIntent() (customer, with the deposit).
   */
  private async createBookingTx(
    tx: Prisma.TransactionClient,
    params: {
      customerId: string;
      bookedBy: string;
      dto: CheckoutDto;
      opts?: PriceOpts;
      priced: Awaited<ReturnType<BookingService['priceSelection']>>;
      /** The confirmed deposit to record against the new invoice, if any. */
      initialPayment?: { amount: number; method: string; gatewayToken?: string };
    },
  ) {
    const { customerId, bookedBy, dto, opts, priced, initialPayment } = params;
    const { houseboatId, cabinRows, coupon, bill } = priced;

    // Lock the departure row for the life of this tx BEFORE converting holds, so
    // a per-cabin checkout and a whole-boat buyout (groupCheckout, which locks the
    // same row) serialize on it. Without this the buyout's booking.count() cannot
    // see an in-flight, uncommitted cabin conversion, so both commit and the boat
    // is sold twice (a group buyout AND a cabin booking on one departure — the
    // one-active-cabin trigger can't catch the group side, it writes no
    // booking_cabin). Same idiom as hold()/groupCheckout().
    await tx.$queryRaw`
      SELECT id FROM trip_departure WHERE id = ${dto.departureId}::uuid FOR UPDATE`;

    // One instant for the whole booking, so a multi-cabin conversion judges
    // every hold against the same clock instead of drifting row to row.
    const now = new Date();

    // Which holds this caller may convert. Normally the hold is already the
    // account's (taken signed-in, or claimed off the guest token at login). The
    // guest-token branch is the fallback for when the claim could not run
    // (cookie blocked/cleared between holding and paying): it accepts a hold
    // still owned by a token ONLY when that token is THIS browser's own hb_gid —
    // never any stranger's unclaimed hold (audit B-H3). With no caller token,
    // only account-owned holds convert.
    const ownerBranches: Prisma.CabinHoldWhereInput[] = [{ heldBy: bookedBy }];
    if (opts?.callerToken) {
      ownerBranches.push({ heldBy: null, heldByToken: opts.callerToken });
    }

    // Convert each hold. If a hold isn't held/owned, abort (rolls back).
    for (const row of cabinRows) {
      const converted = await tx.cabinHold.updateMany({
        where: {
          id: row.holdId,
          cabinId: row.cabinId,
          departureId: dto.departureId,
          OR: ownerBranches,
          state: 'held',
          // The sweeper only runs once a minute, so a lapsed hold sits in
          // state='held' for up to ~60s. Without this an abandoned cart could
          // still convert a cabin it no longer owns — beating a live guest who
          // was meanwhile refused by uq_cabin_hold_active.
          expiresAt: { gt: now },
        },
        data: { state: 'converted' },
      });
      if (converted.count !== 1) {
        throw new BadRequestException(
          'A held cabin expired or was taken — please re-select',
        );
      }
    }

    // Re-check the coupon's usage limits INSIDE the tx, behind a lock on the
    // coupon row (audit #8/F4). resolveCoupon counted redemptions in
    // priceSelection, outside any tx — so N concurrent checkouts all saw a count
    // below the limit and all redeemed, blowing past maxUses/perUserLimit. Here
    // the coupon row is locked, so concurrent redemptions serialize and the
    // (limit+1)th sees the true count. The bill was already built WITH the
    // discount, so rather than silently re-bill we refuse this booking — the
    // customer retries without the (now-exhausted) coupon. Rare by construction.
    if (coupon?.id) {
      const stillOk = await this.couponRedeemableInTx(tx, coupon.id, customerId);
      if (!stillOk) {
        throw new BadRequestException(
          'This coupon has just reached its usage limit — please retry without it',
        );
      }
    }

    const booking = await tx.booking.create({
      data: {
        id: newId(),
        departureId: dto.departureId,
        customerId,
        bookedBy,
        type: 'cabin',
        channel: opts?.channel ?? 'web',
        headcount: cabinRows.reduce((n, r) => n + r.occupancy, 0),
        specialInstructions: dto.specialInstructions,
        couponId: coupon?.id,
        referenceName: dto.referenceName,
        status: 'confirmed',
      },
    });

    await tx.bookingCabin.createMany({
      data: cabinRows.map((r) => ({
        id: newId(),
        bookingId: booking.id,
        cabinId: r.cabinId,
        adults: r.adults,
        children: r.children,
        occupancy: r.occupancy,
        roomPrice: r.roomPrice,
        isOpenSeat: r.isOpenSeat,
      })),
    });

    await tx.bookingGuest.create({
      data: {
        id: newId(),
        bookingId: booking.id,
        name: dto.leadGuestName,
        phone: dto.leadGuestPhone,
        email: dto.leadGuestEmail?.trim() || null,
        nidEncrypted: this.encryptNid(dto.leadGuestNid),
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        id: newId(),
        bookingId: booking.id,
        houseboatId,
        customerId,
        roomTotal: bill.roomTotal,
        gatewayFee: bill.gatewayFee,
        priceShown: bill.priceShown,
        discountAmount: bill.discountAmount,
        displayTotal: bill.displayTotal,
        commission: bill.commission,
        dueToBoat: ZERO,
        amountPaid: ZERO,
        status: 'customer_due',
        policySnapshot: await this.policySnapshot(tx, houseboatId),
      },
    });

    // Record the confirmed deposit against the fresh invoice, in this same tx —
    // so a booking never exists without the payment that justified creating it
    // (audit M-H2). amountPaid drives the customer_due → paid flip when full.
    if (initialPayment && initialPayment.amount > 0) {
      await tx.invoicePayment.create({
        data: {
          id: newId(),
          invoiceId: invoice.id,
          amount: initialPayment.amount,
          method: initialPayment.method,
          gatewayToken: initialPayment.gatewayToken,
          paidAt: new Date(),
        },
      });
      const paid = money(initialPayment.amount);
      const status = paid.greaterThanOrEqualTo(bill.displayTotal)
        ? 'paid'
        : 'customer_due';
      // Track any surplus over the bill as a platform liability (audit #9/F5),
      // exactly like recordGatewayPayment — otherwise a first deposit above the
      // total was invisible to the overpayments queue and never refunded. Normally
      // the gateway caps the deposit at displayTotal, but dev/settle and any
      // direct confirm path could exceed it; record it either way.
      const over = sub(paid, bill.displayTotal);
      const amountOverpaid = over.greaterThan(ZERO) ? over : ZERO;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { amountPaid: paid, amountOverpaid, status },
      });
      invoice.amountPaid = paid;
      invoice.status = status;
    }

    // Apply the customer's open credits toward whatever remains due.
    if (dto.useCredit) {
      const remaining = sub(bill.displayTotal, money(invoice.amountPaid));
      if (remaining.greaterThan(ZERO)) {
        const applied = await this.applyCredits(
          tx,
          customerId,
          invoice.id,
          remaining,
        );
        if (applied.greaterThan(ZERO)) {
          const total = add(money(invoice.amountPaid), applied);
          const status = total.greaterThanOrEqualTo(bill.displayTotal)
            ? 'paid'
            : 'customer_due';
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: total, status },
          });
          invoice.amountPaid = total;
          invoice.status = status;
        }
      }
    }

    await this.audit.log(
      {
        houseboatId,
        actorAccountId: bookedBy,
        action: 'booking_create',
        entityType: 'booking',
        entityId: booking.id,
        after: { invoiceId: invoice.id, displayTotal: bill.displayTotal.toFixed(2) },
      },
      tx,
    );

    return { booking, invoice };
  }

  /**
   * Price a customer checkout and stash it as a BookingIntent WITHOUT creating a
   * booking (audit M-H2). The cabins stay reserved only by their live holds; the
   * booking is created only once a deposit of at least MIN_DEPOSIT_PCT of the
   * bill is confirmed (see confirmIntent). Validates the holds are live and this
   * caller's, so an intent can never be minted over cabins the caller doesn't
   * hold. Returns what the client needs to drive payment.
   */
  async createIntent(
    customerId: string,
    bookedBy: string,
    dto: CheckoutDto,
    opts?: PriceOpts,
  ): Promise<{
    intentId: string;
    displayTotal: string;
    minDeposit: string;
    fullAmount: string;
  }> {
    const priced = await this.priceSelection(dto, { ...opts, customerId });
    const { houseboatId, cabinRows, bill } = priced;

    // Every cabin must be a live hold owned by this caller (account, or this
    // browser's guest token) — mirror the conversion filter so we never price an
    // intent the caller can't later convert. Read-only check here.
    const ownerBranches: Prisma.CabinHoldWhereInput[] = [{ heldBy: bookedBy }];
    if (opts?.callerToken) {
      ownerBranches.push({ heldBy: null, heldByToken: opts.callerToken });
    }
    const now = new Date();
    for (const row of cabinRows) {
      const live = await this.prisma.cabinHold.count({
        where: {
          id: row.holdId,
          cabinId: row.cabinId,
          departureId: dto.departureId,
          OR: ownerBranches,
          state: 'held',
          expiresAt: { gt: now },
        },
      });
      if (live !== 1) {
        throw new BadRequestException(
          'A held cabin expired or was taken — please re-select',
        );
      }
    }

    const minDeposit = percentOf(bill.displayTotal, MIN_DEPOSIT_PCT);
    // The intent lives as long as the cart's holds — it is meaningless once the
    // cabins can be taken by someone else. Read the caller's furthest hold expiry.
    const furthest = await this.prisma.cabinHold.aggregate({
      where: {
        departureId: dto.departureId,
        OR: ownerBranches,
        state: 'held',
        expiresAt: { gt: now },
      },
      _max: { expiresAt: true },
    });
    const expiresAt =
      furthest._max.expiresAt ?? new Date(now.getTime() + 10 * 60_000);

    const intent = await this.prisma.bookingIntent.create({
      data: {
        id: newId(),
        departureId: dto.departureId,
        houseboatId,
        customerId,
        bookedBy,
        channel: opts?.channel ?? 'web',
        payload: dto as unknown as Prisma.InputJsonValue,
        displayTotal: bill.displayTotal,
        // Freeze the exact bill the customer is seeing now, as 2dp strings, so
        // confirmIntent bills this even if pricing changes before payment (#10).
        billSnapshot: {
          roomTotal: bill.roomTotal.toFixed(2),
          gatewayFee: bill.gatewayFee.toFixed(2),
          priceShown: bill.priceShown.toFixed(2),
          discountAmount: bill.discountAmount.toFixed(2),
          displayTotal: bill.displayTotal.toFixed(2),
          commission: bill.commission.toFixed(2),
        } as Prisma.InputJsonValue,
        minDeposit,
        status: 'requested',
        expiresAt,
      },
    });

    return {
      intentId: intent.id,
      displayTotal: bill.displayTotal.toFixed(2),
      minDeposit: minDeposit.toFixed(2),
      fullAmount: bill.displayTotal.toFixed(2),
    };
  }

  /**
   * Turn a paid intent into a real booking (audit M-H2). Called by the gateway
   * once a payment is confirmed (dev/settle synchronously, or the IPN
   * server-to-server). Enforces the deposit floor server-side — `amount` must be
   * at least the intent's minDeposit — then runs the shared booking-creation
   * transaction, recording the deposit in the SAME tx. Idempotent: a replayed
   * confirmation (intent already consumed) returns the existing booking.
   *
   * The intent's stored payload is re-priced fresh so a stale snapshot can never
   * bill a wrong amount; the deposit is measured against the intent's recorded
   * displayTotal so it matches what the customer was shown.
   */
  async confirmIntent(
    intentId: string,
    payment: { amount: number; method: string; gatewayToken?: string },
  ): Promise<{ bookingId: string; invoiceId: string; alreadyDone: boolean }> {
    const intent = await this.prisma.bookingIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) throw new NotFoundException('Booking intent not found');

    // Idempotent replay: already consumed → return the booking it made.
    if (intent.status === 'consumed' && intent.bookingId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { bookingId: intent.bookingId },
        select: { id: true },
      });
      return {
        bookingId: intent.bookingId,
        invoiceId: inv?.id ?? '',
        alreadyDone: true,
      };
    }
    if (intent.status !== 'requested') {
      throw new BadRequestException('This booking intent is no longer payable');
    }

    // Deposit floor — the whole point of M-H2. Measured against the total the
    // customer was shown (intent.displayTotal); the client-sent amount is never
    // trusted below this.
    if (money(payment.amount).lessThan(money(intent.minDeposit))) {
      throw new BadRequestException(
        `A minimum deposit of ${money(intent.minDeposit).toFixed(0)} is required`,
      );
    }

    const dto = intent.payload as unknown as CheckoutDto;
    // Re-price fresh (never bill off a stale snapshot). The caller-token branch
    // is not available here (async IPN has no cookie), but the hold was already
    // claimed onto the account by login before payment, so account ownership
    // covers conversion. Pass channel from the intent.
    const opts: PriceOpts = {
      channel: intent.channel as 'web' | 'pos',
      customerId: intent.customerId,
    };
    const priced = await this.priceSelection(dto, opts);

    // Bill the customer exactly the price they saw at checkout (audit #10/F12).
    // priceSelection is still run above so cabin/hold/availability are validated
    // against live state, but the invoice bill comes from the frozen snapshot so
    // an owner pricing change between checkout and payment cannot silently re- or
    // under-bill. Legacy intents (no snapshot) keep the re-priced bill.
    const snap = intent.billSnapshot as Record<string, string> | null;
    if (snap) {
      priced.bill = {
        roomTotal: money(snap.roomTotal),
        gatewayFee: money(snap.gatewayFee),
        priceShown: money(snap.priceShown),
        discountAmount: money(snap.discountAmount),
        displayTotal: money(snap.displayTotal),
        commission: money(snap.commission),
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Re-lock the intent inside the tx and re-check it is still requested, so
      // two confirmations (dev/settle racing the IPN) cannot both create a
      // booking. Whoever wins flips it to consumed; the loser sees != requested.
      await tx.$queryRaw`
        SELECT id FROM booking_intent WHERE id = ${intentId}::uuid FOR UPDATE`;
      const fresh = await tx.bookingIntent.findUnique({
        where: { id: intentId },
        select: { status: true, bookingId: true },
      });
      if (!fresh) throw new NotFoundException('Booking intent not found');
      if (fresh.status === 'consumed' && fresh.bookingId) {
        const inv = await tx.invoice.findFirst({
          where: { bookingId: fresh.bookingId },
          select: { id: true },
        });
        return {
          bookingId: fresh.bookingId,
          invoiceId: inv?.id ?? '',
          alreadyDone: true,
        };
      }
      if (fresh.status !== 'requested') {
        throw new BadRequestException('This booking intent is no longer payable');
      }

      const { booking, invoice } = await this.createBookingTx(tx, {
        customerId: intent.customerId,
        bookedBy: intent.bookedBy,
        dto,
        opts,
        priced,
        initialPayment: {
          amount: payment.amount,
          method: payment.method,
          gatewayToken: payment.gatewayToken,
        },
      });

      await tx.bookingIntent.update({
        where: { id: intentId },
        data: { status: 'consumed', bookingId: booking.id },
      });

      return { bookingId: booking.id, invoiceId: invoice.id, alreadyDone: false };
    });

    return result;
  }

  /**
   * Group / full-boat buyout checkout (plan §1 Group bookings). The customer
   * picks a band and types a headcount; if it falls in a band, the band's
   * total_price becomes the whole bill — ONE total, ONE payer, no per-guest
   * split. The buyout takes the entire departure, so availability drops to 0.
   */
  async groupCheckout(
    customerId: string,
    bookedBy: string,
    dto: {
      departureId: string;
      headcount: number;
      leadGuestName: string;
      leadGuestPhone?: string;
      leadGuestEmail?: string;
      leadGuestNid?: string;
      specialInstructions?: string;
      referenceName?: string;
      useCredit?: boolean;
    },
    channel: 'web' | 'pos' = 'web',
  ) {
    const departure = await this.prisma.tripDeparture.findUnique({
      where: { id: dto.departureId },
      include: { package: { select: { houseboatId: true } } },
    });
    if (!departure) throw new NotFoundException('Departure not found');
    if (departure.status !== 'scheduled') {
      throw new BadRequestException('Departure is no longer bookable');
    }
    if (departure.availableCount <= 0) {
      throw new BadRequestException('Departure is not available for buyout');
    }
    const houseboatId = departure.package.houseboatId;

    // Band lookup rejects a headcount outside every band.
    const band = await this.pricing.bandForHeadcount(houseboatId, dto.headcount);

    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    // POS counter sales earn no commission (see checkout).
    const commissionPct =
      channel === 'pos' || !billing?.commissionPct
        ? null
        : money(billing.commissionPct);

    // The band price IS the room total; no coupon on group buyout (spec §1).
    const bill = buildBill({
      roomTotal: money(band.totalPrice),
      commissionPct,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the departure row for the life of the tx, so two concurrent buyouts
      // (and any concurrent cabin hold — hold() locks the same row) serialize
      // instead of both reading "available" and both selling the whole boat. The
      // pre-tx read above is a cheap fast-fail; THIS is the authoritative check.
      await tx.$queryRaw`
        SELECT id FROM trip_departure WHERE id = ${dto.departureId}::uuid FOR UPDATE`;
      const locked = await tx.tripDeparture.findUnique({
        where: { id: dto.departureId },
        select: { status: true, availableCount: true },
      });
      if (!locked) throw new NotFoundException('Departure not found');
      if (locked.status !== 'scheduled') {
        throw new BadRequestException('Departure is no longer bookable');
      }
      if (locked.availableCount <= 0) {
        throw new BadRequestException('Departure is not available for buyout');
      }
      // A buyout sells the WHOLE boat, so it must be refused if any cabin is
      // already booked (individual sale) or another buyout already exists — the
      // group booking writes no booking_cabin rows, so the per-cabin trigger
      // can't catch this. Count active (non-cancelled) bookings on the departure.
      const existing = await tx.booking.count({
        where: { departureId: dto.departureId, status: { not: 'cancelled' } },
      });
      if (existing > 0) {
        throw new BadRequestException(
          'This departure already has bookings and cannot be bought out',
        );
      }

      // Buyout takes the whole boat — no more cabin bookings on this departure.
      const dep = await tx.tripDeparture.update({
        where: { id: dto.departureId },
        data: { availableCount: 0 },
        select: { id: true },
      });

      // Void any cabins other shoppers are still holding on this departure. The
      // buyout just set availableCount to an absolute 0; if we left these holds
      // 'held', the sweeper would later increment the count back above 0 when
      // each expired (its release does availableCount += 1), reopening a boat
      // that was sold whole. Flip them to the existing 'released' state — NOT a
      // new state, and WITHOUT touching availableCount (it's already 0). We
      // capture the cabin ids first so watchers' carts can be cleared after
      // commit. The DB partial-unique index only covers state='held', so leaving
      // the index is exactly what freeing the slot means — no conflict.
      const heldNow = await tx.cabinHold.findMany({
        where: { departureId: dto.departureId, state: 'held' },
        select: { cabinId: true },
      });
      const voidedCabinIds = [...new Set(heldNow.map((h) => h.cabinId))];
      if (heldNow.length > 0) {
        await tx.cabinHold.updateMany({
          where: { departureId: dto.departureId, state: 'held' },
          data: { state: 'released' },
        });
      }

      const booking = await tx.booking.create({
        data: {
          id: newId(),
          departureId: dto.departureId,
          customerId,
          bookedBy,
          type: 'group',
          channel,
          headcount: dto.headcount,
          specialInstructions: dto.specialInstructions,
          referenceName: dto.referenceName,
          status: 'confirmed',
        },
      });

      await tx.bookingGuest.create({
        data: {
          id: newId(),
          bookingId: booking.id,
          name: dto.leadGuestName,
          phone: dto.leadGuestPhone,
          email: dto.leadGuestEmail?.trim() || null,
          nidEncrypted: this.encryptNid(dto.leadGuestNid),
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          id: newId(),
          bookingId: booking.id,
          houseboatId,
          customerId,
          roomTotal: bill.roomTotal,
          gatewayFee: bill.gatewayFee,
          priceShown: bill.priceShown,
          discountAmount: bill.discountAmount,
          displayTotal: bill.displayTotal,
          commission: bill.commission,
          dueToBoat: ZERO,
          amountPaid: ZERO,
          status: 'customer_due',
          policySnapshot: await this.policySnapshot(tx, houseboatId),
        },
      });

      if (dto.useCredit) {
        const applied = await this.applyCredits(
          tx,
          customerId,
          invoice.id,
          bill.displayTotal,
        );
        if (applied.greaterThan(ZERO)) {
          const status = applied.greaterThanOrEqualTo(bill.displayTotal)
            ? 'paid'
            : 'customer_due';
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { amountPaid: applied, status },
          });
          invoice.amountPaid = applied;
          invoice.status = status;
        }
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: bookedBy,
          action: 'group_booking_create',
          entityType: 'booking',
          entityId: booking.id,
          after: {
            headcount: dto.headcount,
            bandTotal: money(band.totalPrice).toFixed(2),
            displayTotal: bill.displayTotal.toFixed(2),
          },
        },
        tx,
      );

      return { booking, invoice, departureId: dep.id, voidedCabinIds };
    });

    // Realtime (post-commit): the boat is now fully booked out, and any cabins
    // shoppers were holding have been released — push both so their carts clear
    // instead of failing later at checkout conversion.
    this.realtime.emitAvailability(result.departureId, 0);
    for (const cabinId of result.voidedCabinIds) {
      this.realtime.emitCabinState(result.departureId, cabinId, 'released');
    }

    return { booking: result.booking, invoice: result.invoice };
  }

  /** Snapshot the boat's cancellation policy onto the invoice (dispute evidence). */
  private async policySnapshot(
    tx: Prisma.TransactionClient,
    houseboatId: string,
  ) {
    const policy = await tx.cancellationPolicy.findFirst({
      where: { houseboatId },
    });
    return policy
      ? ({
          template: policy.policyTemplate,
          depositPct: policy.depositPct,
          tiers: policy.tiers,
        } as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  /**
   * Cancel a booking (plan §4 Path B — customer cancels). Frees the cabins back
   * to the departure, moves the invoice to `cancelled`, and computes the refund
   * from the invoice's policy SNAPSHOT (blackout → 0%, % of amount_paid). The
   * platform keeps its commission. Any refund owed is recorded as a customer
   * credit; the invoice then follows settlement (cancelled → payment_verified …).
   * Finally, all waitlisted customers for that departure are notified.
   *
   * A customer cancels their own booking; a boat member with bookings:edit may
   * cancel on their behalf.
   */
  async cancel(bookingId: string, actorId: string, isPlatform: boolean) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        invoice: true,
        cabins: true,
        departure: {
          include: { package: { include: { houseboat: { select: { name: true } } } } },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!booking.invoice) throw new BadRequestException('Booking has no invoice');
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }
    // A trip that already sailed can't be cancelled — the departure-completion
    // job flips confirmed bookings to 'completed', and cancelling one would free
    // cabins on a past departure and run refund math against a negative
    // daysUntil. The customer UI never offers cancel on completed trips; this is
    // the server-side backstop.
    if (booking.status === 'completed') {
      throw new BadRequestException('Completed trips cannot be cancelled');
    }
    // Host-cancelled trips must go through the refund-request flow (bkash/bank),
    // not this self-cancel path (which would route the refund to the wallet).
    // Backstops the hidden UI button against a stale client / direct API call.
    if (booking.departure.status === 'cancelled') {
      throw new BadRequestException(
        'This trip was cancelled by the host — request a refund instead',
      );
    }

    const houseboatId = booking.invoice.houseboatId;
    // Authorization: the booking's own customer, or a member with bookings:edit.
    if (booking.customerId !== actorId) {
      await this.rbac.assert(actorId, isPlatform, houseboatId, 'bookings', 'edit');
    }

    // Refund from the snapshot agreed at checkout, not the current policy.
    const snapshot = booking.invoice.policySnapshot as PolicySnapshot | null;
    const days = daysUntil(booking.departure.startDate);
    const pct = refundPercent(snapshot, days);
    const paid = money(booking.invoice.amountPaid);
    const refund = refundAmount(paid, pct);

    // Only legal from pre-payout states (in_payout is a lock).
    assertTransition(booking.invoice.status as InvoiceStatus, 'cancelled');

    const freedCabins = booking.cabins.length;

    const result = await this.prisma.$transaction(async (tx) => {
      // Lock the booking row and re-check its status INSIDE the tx. The status
      // read above happens outside any lock, so two concurrent cancels would both
      // pass it and then both refund + both increment availableCount (double
      // refund credit + oversell). Serialize on the row: the loser blocks here,
      // re-reads 'cancelled', and returns the idempotent already-cancelled result
      // without issuing a second refund or bumping the count again.
      await tx.$queryRaw`
        SELECT id FROM booking WHERE id = ${bookingId}::uuid FOR UPDATE`;
      const locked = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { status: true },
      });
      if (!locked) throw new NotFoundException('Booking not found');
      if (locked.status === 'cancelled' || locked.status === 'completed') {
        // Already terminal — a concurrent cancel (or completion) won. No refund,
        // no availability change; report the current availability for the caller.
        const cur = await tx.tripDeparture.findUnique({
          where: { id: booking.departureId },
          select: { availableCount: true },
        });
        return { availableCount: cur?.availableCount ?? 0, alreadyDone: true };
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'cancelled' },
      });
      await tx.invoice.update({
        where: { id: booking.invoice!.id },
        data: { status: 'cancelled' },
      });
      // Return the cabins to availability.
      const dep = await tx.tripDeparture.update({
        where: { id: booking.departureId },
        data: { availableCount: { increment: freedCabins } },
        select: { availableCount: true },
      });

      // Refund owed → customer credit (platform keeps commission regardless).
      if (refund.greaterThan(ZERO)) {
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId: booking.customerId,
            sourceInvoiceId: booking.invoice!.id,
            amount: refund,
            status: 'open',
            kind: 'refund', // cancellation refund → reduces boat payout even if spent (M-M1)
          },
        });
      }

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: actorId,
          action: 'booking_cancel',
          entityType: 'booking',
          entityId: bookingId,
          after: {
            refundPct: pct,
            refundAmount: refund.toFixed(2),
            freedCabins,
          },
        },
        tx,
      );
      return { availableCount: dep.availableCount, alreadyDone: false };
    });

    // A concurrent cancel already handled this booking — don't double-fire the
    // realtime/waitlist side effects or report a second refund. Surface the
    // already-cancelled state so a double click is a no-op, not an error.
    if (result.alreadyDone) {
      throw new BadRequestException('Booking is already cancelled');
    }

    // Post-commit side effects: realtime availability + waitlist fan-out.
    this.realtime.emitAvailability(booking.departureId, result.availableCount);
    await this.notifyWaitlist(
      booking.departureId,
      booking.departure.package.houseboat.name,
      booking.cabins.map((c) => c.cabinId),
    ).catch(() => undefined);

    return {
      cancelled: true,
      refundPct: pct,
      refundAmount: refund.toFixed(2),
    };
  }

  /**
   * Someone joins an open seat (plan §3). A booking_cabin left with a spare
   * place (is_open_seat) is filled by another party at their own headcount price.
   * The FIRST booker's invoice drops by the joiner's contribution; commission
   * recalculates on the new total; if they already paid more than the new total,
   * the surplus becomes a customer credit. The invoice only ever moves DOWN.
   *
   * Returns the joiner's own (new) booking + invoice for the spare place.
   */
  async joinOpenSeat(
    openSeatCabinId: string,
    joinerId: string,
    adults: number,
    children = 0,
    childAges?: number[],
  ) {
    const seat = await this.prisma.bookingCabin.findUnique({
      where: { id: openSeatCabinId },
      include: {
        cabin: { include: { category: true } },
        booking: {
          include: {
            invoice: true,
            departure: {
              include: {
                package: {
                  select: {
                    houseboatId: true,
                    routeId: true,
                    houseboat: { select: { childPolicy: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!seat) throw new NotFoundException('Open seat not found');
    if (!seat.isOpenSeat) throw new BadRequestException('That cabin is not an open seat');
    const firstInvoice = seat.booking.invoice;
    if (!firstInvoice) throw new BadRequestException('Original booking has no invoice');

    const houseboatId = seat.booking.departure.package.houseboatId;
    const occupancy = adults + children;
    const cap =
      seat.cabin.category.extendedCapacity ?? seat.cabin.category.baseCapacity;
    // The joiner's headcount plus the existing occupancy must fit the room.
    if (seat.occupancy + occupancy > cap) {
      throw new BadRequestException('Not enough spare places for that headcount');
    }

    // Price by the joiner's ADULT count, not total occupancy. The owner's rate
    // rows are per adult party size; children are discounted off that row by the
    // child policy and never select the row (mirrors checkout — counting children
    // here jumped to a wrong/non-existent rate row, the reschedule/open-seat bug).
    if (adults === 0 && children > 0) {
      throw new BadRequestException(
        'Add at least one adult — children cannot take a place alone',
      );
    }
    const joinerPerPerson = await this.pricing.pricePerPersonFor(
      houseboatId,
      seat.cabin.cabinCategoryId,
      adults,
      seat.booking.departure.startDate,
      seat.booking.departure.package.routeId,
    );
    const joinerPrice = priceForParty({
      pricePerPerson: joinerPerPerson,
      adults,
      children,
      // Age-band the joiner's children like checkout does (audit M-M2); omitted
      // ages fall back to full charge inside priceForParty.
      childAges,
      childPolicy: seat.booking.departure.package.houseboat.childPolicy as
        | ChildBand[]
        | null,
    });

    const billing = await this.prisma.houseboatBillingConfig.findFirst({
      where: { houseboatId },
    });
    const boatCommissionPct = billing?.commissionPct
      ? money(billing.commissionPct)
      : null;
    // First booker keeps their own channel's commission treatment (a POS
    // original stays commission-free). The joiner arrives via the platform, so
    // their new booking is 'web' and earns commission normally.
    const firstCommissionPct =
      seat.booking.channel === 'pos' ? null : boatCommissionPct;
    const joinerCommissionPct = boatCommissionPct;

    // First booker's new room_total = old − joiner's contribution (never below 0).
    const oldRoomTotal = money(firstInvoice.roomTotal);
    const newRoomTotal = sub(oldRoomTotal, joinerPrice);
    const firstBill = buildBill({
      roomTotal: newRoomTotal.isNegative() ? ZERO : newRoomTotal,
      commissionPct: firstCommissionPct,
    });

    const paid = money(firstInvoice.amountPaid);
    const surplus = paid.greaterThan(firstBill.displayTotal)
      ? sub(paid, firstBill.displayTotal)
      : ZERO;

    return this.prisma.$transaction(async (tx) => {
      // 1. Drop the first booker's invoice to the new (lower) total.
      await tx.invoice.update({
        where: { id: firstInvoice.id },
        data: {
          roomTotal: firstBill.roomTotal,
          gatewayFee: firstBill.gatewayFee,
          priceShown: firstBill.priceShown,
          discountAmount: firstBill.discountAmount,
          displayTotal: firstBill.displayTotal,
          commission: firstBill.commission,
          amountPaid: surplus.greaterThan(ZERO) ? firstBill.displayTotal : paid,
        },
      });
      if (surplus.greaterThan(ZERO)) {
        await tx.customerCredit.create({
          data: {
            id: newId(),
            accountId: seat.booking.customerId,
            sourceInvoiceId: firstInvoice.id,
            amount: surplus,
            status: 'open',
            kind: 'rebate', // open-seat surplus; displayTotal already cut → never re-subtracted (M-M1)
          },
        });
      }

      // 2. Create the joiner's own booking + cabin + invoice for the spare place.
      //
      // ORDER MATTERS: insert the joiner's booking_cabin BEFORE flipping the
      // seat's own row to is_open_seat=false (step 3). The one-active-cabin
      // trigger exempts an EXISTING open-seat row from the clash count, so while
      // the original is still is_open_seat=true the joiner INSERT passes; if we
      // flipped first, the original would be counted and the INSERT would throw.
      // The later seat flip is an in-place UPDATE (cabin unchanged), which the
      // trigger skips. (Audit #5 / F10.)
      const joinerBill = buildBill({
        roomTotal: joinerPrice,
        commissionPct: joinerCommissionPct,
      });
      const joinerBooking = await tx.booking.create({
        data: {
          id: newId(),
          departureId: seat.booking.departureId,
          customerId: joinerId,
          bookedBy: joinerId,
          type: 'open_seat',
          channel: 'web',
          headcount: occupancy,
          status: 'confirmed',
        },
      });
      await tx.bookingCabin.create({
        data: {
          id: newId(),
          bookingId: joinerBooking.id,
          cabinId: seat.cabinId,
          adults,
          children,
          occupancy,
          roomPrice: joinerPrice,
          isOpenSeat: false,
        },
      });

      // 3. The seat is now filled — no longer offered to others. In-place UPDATE
      // (cabin unchanged) so the trigger's UPDATE-skip applies.
      await tx.bookingCabin.update({
        where: { id: openSeatCabinId },
        data: { isOpenSeat: false, occupancy: seat.occupancy + occupancy },
      });
      const joinerInvoice = await tx.invoice.create({
        data: {
          id: newId(),
          bookingId: joinerBooking.id,
          houseboatId,
          customerId: joinerId,
          roomTotal: joinerBill.roomTotal,
          gatewayFee: joinerBill.gatewayFee,
          priceShown: joinerBill.priceShown,
          discountAmount: joinerBill.discountAmount,
          displayTotal: joinerBill.displayTotal,
          commission: joinerBill.commission,
          dueToBoat: ZERO,
          amountPaid: ZERO,
          status: 'customer_due',
          policySnapshot: await this.policySnapshot(tx, houseboatId),
        },
      });

      await this.audit.log(
        {
          houseboatId,
          actorAccountId: joinerId,
          action: 'open_seat_join',
          entityType: 'booking',
          entityId: joinerBooking.id,
          after: {
            filledSeatCabin: openSeatCabinId,
            firstInvoiceNewTotal: firstBill.displayTotal.toFixed(2),
            surplusCredit: surplus.toFixed(2),
          },
        },
        tx,
      );

      return { booking: joinerBooking, invoice: joinerInvoice };
    });
  }

  async get(bookingId: string, actorId: string, isPlatform: boolean) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        // Deck + category feed the confirmation invoice's line-item rows.
        cabins: {
          include: {
            cabin: {
              include: {
                deck: { select: { name: true } },
                category: { select: { name: true, isAc: true } },
              },
            },
          },
        },
        // Never surface nidEncrypted — ciphertext is useless to clients and
        // shouldn't ride in API responses.
        guests: { select: { id: true, name: true, phone: true } },
        // The buyer's own contact details — "billed to" on the invoice.
        customer: { select: { name: true, email: true, phone: true } },
        coupon: { select: { code: true } },
        // The guest's own review, if left — drives the review card on the
        // booking detail page (form when null on a completed trip, else the
        // submitted rating + any owner reply, read-only).
        review: {
          select: { id: true, rating: true, text: true, ownerReply: true },
        },
        // payments carry the method + date behind "via bKash · 21 Jul 2026".
        invoice: {
          include: {
            payments: {
              select: { amount: true, method: true, paidAt: true },
              orderBy: { paidAt: 'asc' },
            },
            // Latest refund drives the detail page's "Request refund" vs status.
            refunds: { orderBy: { id: 'desc' }, take: 1, select: { status: true } },
          },
        },
        departure: {
          include: {
            package: {
              include: {
                route: true,
                houseboat: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoStorageKey: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    // Authorization: the booking's own customer, or a member with bookings:view.
    // Without this any authenticated account could read any booking's guest PII
    // and invoice by id (IDOR). Mirrors cancel()'s ownership check.
    if (booking.customerId !== actorId) {
      const houseboatId = booking.invoice?.houseboatId;
      if (!houseboatId) throw new NotFoundException('Booking not found');
      await this.rbac.assert(actorId, isPlatform, houseboatId, 'bookings', 'view');
    }
    // Boat logo: swap the storage key for a public URL (root-relative under the
    // local driver, so it stays same-origin and passes CSP img-src 'self').
    // Mutated in place rather than reshaped — get() returns the Prisma object by
    // identity and callers rely on that. Both the path and the service are
    // guarded: unit tests construct this service positionally without a storage
    // dep and with fixtures that carry no departure.
    const hb = booking.departure?.package?.houseboat as
      | { logoStorageKey?: string | null; logoUrl?: string | null }
      | undefined;
    if (hb) {
      const key = hb.logoStorageKey;
      hb.logoUrl = key ? (this.storage?.publicUrl(key) ?? null) : null;
      delete hb.logoStorageKey;
    }
    // Flatten latest refund status onto the booking (in place — the return is
    // by identity, like logoUrl above). Then drop the nested array.
    const inv = booking.invoice as
      | { refunds?: { status: string }[] }
      | null
      | undefined;
    const refundStatus = inv?.refunds?.[0]?.status ?? null;
    if (inv && 'refunds' in inv) delete inv.refunds;
    (booking as { refundStatus?: string | null }).refundStatus = refundStatus;
    return booking;
  }

  async listForCustomer(customerId: string) {
    const rows = await this.prisma.booking.findMany({
      where: { customerId },
      include: {
        invoice: {
          include: {
            // Latest refund (if any) so the trips list can show refund progress
            // and hide the "Request refund" button once one exists.
            refunds: { orderBy: { id: 'desc' }, take: 1, select: { status: true } },
          },
        },
        // Narrow select: the list needs the host-cancel signal + the 6-day
        // window anchor, on top of the dates the card already renders.
        departure: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            status: true,
            cancelReason: true,
            cancelledAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    // Surface the latest refund status as a flat field; drop the nested array.
    return rows.map(({ invoice, ...b }) => {
      const refundStatus = invoice?.refunds[0]?.status ?? null;
      const invoiceOut = invoice
        ? (() => {
            const { refunds: _refunds, ...rest } = invoice;
            return rest;
          })()
        : null;
      return { ...b, invoice: invoiceOut, refundStatus };
    });
  }

  /**
   * Public, hold-free price preview for a hypothetical cabin selection. This is
   * the single source of truth for every price the customer UI shows — the
   * client never computes totals itself (no NIGHTS multiplier, no service fee,
   * child pricing follows the boat's policy). No holds are taken and nothing is
   * written; the customer commits later via checkout.
   *
   * `throwOnUnpriced:false` so a cabin with no configured rate comes back marked
   * `priced:false` instead of failing the whole quote; no owner overrides or
   * discounts (those are POS-only). Coupon is validated + applied server-side.
   */
  async quote(dto: {
    departureId: string;
    cabins: PriceableCabin[];
    couponCode?: string;
  }) {
    const { cabinRows, coupon, bill } = await this.priceSelection(dto, {
      throwOnUnpriced: false,
    });
    // A coupon "applied" when it resolved AND actually reduced the total. The
    // client shows discountAmount; couponApplied just drives the ✓/✗ chip so it
    // never has to guess validity from client state.
    const discounted = bill.discountAmount.greaterThan(ZERO);
    return {
      perCabin: cabinRows.map((r) => ({
        cabinId: r.cabinId,
        adults: r.adults,
        children: r.children,
        occupancy: r.occupancy,
        isOpenSeat: r.isOpenSeat,
        roomPrice: r.roomPrice.toFixed(2),
        priced: r.priced,
      })),
      couponApplied: !!coupon && discounted,
      roomTotal: bill.roomTotal.toFixed(2),
      discountAmount: bill.discountAmount.toFixed(2),
      displayTotal: bill.displayTotal.toFixed(2),
    };
  }
}
