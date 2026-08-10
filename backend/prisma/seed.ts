import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import * as bcrypt from 'bcryptjs';
import { FULL_PERMISSIONS } from '../src/rbac/permission.types';

const prisma = new PrismaClient();
const id = () => uuidv7();

/** Same cost factor as AuthService.register — keep in sync. */
const BCRYPT_ROUNDS = 12;

/**
 * Read a required env var. Seeding an account with a default password would
 * put a known credential on every environment that ever ran the seed, so this
 * refuses rather than falling back.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required to seed accounts. Set it in backend/.env (see .env.example).`,
    );
  }
  return value;
}

/**
 * Platform staff are seeded in pairs on purpose. Refunds and payouts enforce
 * separation of duties — refunds.service.ts:115,167 and payouts.service.ts:117
 * reject the same account performing both steps, and refund completion is also
 * a DB CHECK constraint. With a single admin those flows cannot be completed
 * at all, so the seed always provisions a maker and a checker.
 */
async function seedAccount(opts: {
  phone: string;
  password: string;
  name: string;
  email?: string;
  isPlatform: boolean;
}) {
  const passwordHash = await bcrypt.hash(opts.password, BCRYPT_ROUNDS);
  return prisma.account.upsert({
    where: { phone: opts.phone },
    // Re-seeding resets the password so a rotated env var actually takes
    // effect; without this the upsert is a no-op on an existing row.
    update: { passwordHash, isPlatform: opts.isPlatform },
    create: {
      id: id(),
      name: opts.name,
      email: opts.email,
      phone: opts.phone,
      passwordHash,
      isPlatform: opts.isPlatform,
      phoneVerified: true,
    },
  });
}

/** Route has no unique key, so match on name to stay idempotent. */
async function findOrCreateRoute(name: string, region: string) {
  const existing = await prisma.route.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.route.create({
    data: { id: id(), name, region, active: true },
  });
}

/** Next `days` dates starting today, as midnight UTC Dates (for @db.Date). */
function upcomingDates(days: number): Date[] {
  const out: Date[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    out.push(new Date(today.getTime() + i * 86_400_000));
  }
  return out;
}

/** Midnight-UTC Date `offset` days from today (negative = past). For @db.Date. */
function dayOffset(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() + offset * 86_400_000);
}

/**
 * Full teardown of one boat and every row that hangs off it, deepest child
 * first so no FK ever blocks. Used by the Jol Kolol reseed: the demo boat is
 * rebuilt from scratch on every seed so its rich showcase data is deterministic
 * and never fights the idempotency guards elsewhere. No-op if the boat is gone.
 *
 * Deliberately does NOT touch shared Route rows or owner/admin/crew/customer
 * Accounts — those are re-linked on recreate (accounts are upserted by phone).
 */
async function deleteBoatCascade(slug: string) {
  const boat = await prisma.houseboat.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!boat) return;
  const houseboatId = boat.id;

  // audit_log is append-only (a BEFORE UPDATE/DELETE trigger raises). The boat's
  // audit rows reference it via an ON DELETE SET NULL FK, so deleting the boat
  // would fire an UPDATE on audit_log and be rejected. Detach those rows first
  // by briefly disabling the guard trigger, nulling the FK, then restoring it.
  // Demo audit rows carry no value; this only runs for the reseeded demo boat.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      'ALTER TABLE audit_log DISABLE TRIGGER trg_audit_no_update',
    ),
    prisma.$executeRawUnsafe(
      'UPDATE audit_log SET houseboat_id = NULL WHERE houseboat_id = $1::uuid',
      houseboatId,
    ),
    prisma.$executeRawUnsafe(
      'ALTER TABLE audit_log ENABLE TRIGGER trg_audit_no_update',
    ),
  ]);

  // Booking-side rows key off the boat through departure → package.
  const bookingWhere = {
    booking: { departure: { package: { houseboatId } } },
  } as const;
  const invoiceWhere = { invoice: { houseboatId } } as const;

  // Money leaves first (payments/refunds/credits) → invoices.
  await prisma.invoicePayment.deleteMany({ where: invoiceWhere });
  await prisma.invoiceRefund.deleteMany({ where: invoiceWhere });
  await prisma.customerCredit.deleteMany({
    where: { sourceInvoice: { houseboatId } },
  });
  await prisma.invoice.deleteMany({ where: { houseboatId } });

  // Booking children → bookings.
  await prisma.bookingCabin.deleteMany({ where: bookingWhere });
  await prisma.bookingGuest.deleteMany({ where: bookingWhere });
  await prisma.bookingRescheduleHistory.deleteMany({ where: bookingWhere });
  await prisma.review.deleteMany({ where: { houseboatId } });
  await prisma.booking.deleteMany({
    where: { departure: { package: { houseboatId } } },
  });

  // Departure children → departures.
  const depWhere = { departure: { package: { houseboatId } } } as const;
  await prisma.cabinHold.deleteMany({ where: depWhere });
  await prisma.bookingWaitlist.deleteMany({ where: depWhere });
  await prisma.tripCrew.deleteMany({ where: depWhere });
  await prisma.stockMovement.deleteMany({
    where: { trip: { package: { houseboatId } } },
  });
  await prisma.tripDeparture.deleteMany({
    where: { package: { houseboatId } },
  });

  // Weekly-schedule engine references packages via boat_schedule.package_id, so
  // it must go before tripPackage. Slots cascade off boat_schedule; departures
  // (which reference slots) were already dropped above.
  await prisma.boatSchedule.deleteMany({ where: { houseboatId } });

  // Pricing + packages. Null the package→policy FK before dropping policies.
  await prisma.pricingRule.deleteMany({
    where: { profile: { houseboatId } },
  });
  await prisma.pricingProfile.deleteMany({ where: { houseboatId } });
  await prisma.tripPackage.deleteMany({ where: { houseboatId } });
  await prisma.groupPriceBand.deleteMany({ where: { houseboatId } });
  await prisma.quoteRequest.deleteMany({ where: { houseboatId } });
  // Coupons key off the boat AND booking.couponId (SET NULL). Bookings are
  // already gone above, so nothing blocks dropping them before the boat.
  await prisma.coupon.deleteMany({ where: { houseboatId } });
  await prisma.cancellationPolicy.deleteMany({ where: { houseboatId } });

  // Staff tree.
  await prisma.staffPayroll.deleteMany({
    where: { staff: { houseboatId } },
  });
  await prisma.staffLeave.deleteMany({
    where: { staff: { houseboatId } },
  });
  await prisma.houseboatStaff.deleteMany({ where: { houseboatId } });

  // Media before cabins — houseboat_media.cabin_id FK is RESTRICT.
  await prisma.houseboatMedia.deleteMany({ where: { houseboatId } });

  // Cabins → decks / categories.
  await prisma.houseboatCabin.deleteMany({
    where: { deck: { houseboatId } },
  });
  await prisma.houseboatDeck.deleteMany({ where: { houseboatId } });
  await prisma.houseboatCabinCategory.deleteMany({ where: { houseboatId } });

  // Maintenance + inventory + costs. Request comments cascade on delete.
  await prisma.maintenanceRequest.deleteMany({ where: { houseboatId } });
  await prisma.inventoryItem.deleteMany({ where: { houseboatId } });
  await prisma.cost.deleteMany({ where: { houseboatId } });

  // Platform-side billing artifacts (not created by the base seed, but drop
  // them defensively so a re-run over any prior state stays FK-safe).
  await prisma.houseboatSubscriptionInvoice.deleteMany({
    where: { houseboatId },
  });
  await prisma.houseboatPayoutBatch.deleteMany({ where: { houseboatId } });
  await prisma.ownerDistribution.deleteMany({ where: { houseboatId } });

  // Ownership + billing + the boat itself. Detach billingConfigId first so the
  // self-referential FK doesn't block deleting the config rows.
  await prisma.houseboatRoute.deleteMany({ where: { houseboatId } });
  await prisma.houseboatMember.deleteMany({ where: { houseboatId } });
  await prisma.role.deleteMany({ where: { houseboatId } });
  await prisma.houseboat.update({
    where: { id: houseboatId },
    data: { billingConfigId: null },
  });
  await prisma.houseboatBillingConfig.deleteMany({ where: { houseboatId } });
  await prisma.houseboat.delete({ where: { id: houseboatId } });
}

/**
 * Ensure the demo houseboat exists and return its id. Creation happens once;
 * re-running the seed leaves an existing boat (and any bookings against it)
 * untouched — but owner/demo enrichment below still runs, so environments
 * seeded before the owner console existed get the owner artifacts on re-run.
 */
async function ensureBoat(b: { name: string; slug: string; route: string }) {
  const existing = await prisma.houseboat.findUnique({
    where: { slug: b.slug },
    select: { id: true },
  });
  if (existing) return existing.id;

  const boat = await prisma.houseboat.create({
    data: {
      id: id(),
      name: b.name,
      slug: b.slug,
      description: `${b.name} — a comfortable houseboat cruising the haor.`,
      safetyFeatures: 'Life jackets for all guests, trained crew, first-aid kit.',
      foodMenu: {
        breakfast: 'Paratha, egg and tea.',
        brunch: '',
        lunch: 'Rice, dal, fresh fish and vegetables.',
        snacks: 'Tea and light snacks.',
        dinner: 'Rice, chicken and seasonal curry.',
      },
      status: 'live',
      profileCompletePct: 100,
      operatingDates: [],
      defaultCrew: [],
    },
  });

  await prisma.houseboatRoute.create({
    data: { id: id(), houseboatId: boat.id, routeId: b.route },
  });

  const deck = await prisma.houseboatDeck.create({
    data: { id: id(), houseboatId: boat.id, name: 'Upper Deck', position: 1 },
  });

  const category = await prisma.houseboatCabinCategory.create({
    data: {
      id: id(),
      houseboatId: boat.id,
      name: 'Luxury AC',
      isAc: true,
      baseCapacity: 2,
      extendedCapacity: 3,
      facilities: 'AC, attached bath, balcony view.',
    },
  });

  for (const name of ['101', '102']) {
    await prisma.houseboatCabin.create({
      data: {
        id: id(),
        deckId: deck.id,
        cabinCategoryId: category.id,
        name,
      },
    });
  }

  return boat.id;
}

/**
 * Owner artifacts — role + membership — matching what the app itself creates
 * on POST /houseboats (HouseboatAdminService / RolesService.createOwnerRole).
 * Idempotent: matched before create, runs even for pre-existing boats.
 */
async function ensureOwnerMembership(houseboatId: string, accountId: string) {
  let role = await prisma.role.findFirst({
    where: { houseboatId, name: 'Owner' },
  });
  if (!role) {
    role = await prisma.role.create({
      data: {
        id: id(),
        houseboatId,
        name: 'Owner',
        isTemplate: false,
        permissions: FULL_PERMISSIONS as object,
      },
    });
  }

  const membership = await prisma.houseboatMember.findFirst({
    where: { accountId, houseboatId },
  });
  if (!membership) {
    await prisma.houseboatMember.create({
      data: {
        id: id(),
        accountId,
        houseboatId,
        roleId: role.id,
        status: 'active',
        shareholderPct: 100,
        startDate: new Date(),
      },
    });
  }
}

/** Platform billing config so billing-status / subscription pages have data. */
async function ensureBillingConfig(houseboatId: string) {
  const existing = await prisma.houseboatBillingConfig.findFirst({
    where: { houseboatId },
  });
  if (existing) return;
  const trialEnds = new Date();
  trialEnds.setUTCDate(trialEnds.getUTCDate() + 30);
  const cfg = await prisma.houseboatBillingConfig.create({
    data: {
      id: id(),
      houseboatId,
      commissionPct: 5,
      monthlyFee: 2000,
      platformBalance: 0,
      trialEnds,
    },
  });
  await prisma.houseboat.update({
    where: { id: houseboatId },
    data: { billingConfigId: cfg.id },
  });
}

/**
 * Demo operating data so the owner console isn't empty: package, pricing,
 * departures, maintenance, inventory, staff, costs, one cash booking.
 * Every block is guarded find-first so re-runs are no-ops.
 */
async function ensureDemoData(
  houseboatId: string,
  ownerAccountId: string,
  boatIndex: number,
) {
  const routeLink = await prisma.houseboatRoute.findFirst({
    where: { houseboatId },
  });
  const category = await prisma.houseboatCabinCategory.findFirst({
    where: { houseboatId },
  });
  const cabins = await prisma.houseboatCabin.findMany({
    where: { deck: { houseboatId } },
    orderBy: { name: 'asc' },
  });
  if (!routeLink || !category || cabins.length === 0) return;

  // Operating dates: next 30 days, only when currently empty.
  const boat = await prisma.houseboat.findUniqueOrThrow({
    where: { id: houseboatId },
    select: { operatingDates: true },
  });
  if (boat.operatingDates.length === 0) {
    await prisma.houseboat.update({
      where: { id: houseboatId },
      data: { operatingDates: upcomingDates(30) },
    });
  }

  // Trip package + default pricing profile + rules + group band.
  let pkg = await prisma.tripPackage.findFirst({ where: { houseboatId } });
  if (!pkg) {
    pkg = await prisma.tripPackage.create({
      data: {
        id: id(),
        houseboatId,
        routeId: routeLink.routeId,
        durationDays: 2,
        durationLabel: '2 days 1 night',
        departureGhat: 'Tahirpur ghat',
        returnGhat: 'Tahirpur ghat',
        meals: 'Breakfast, lunch, dinner, evening snacks',
        included: 'Guide, life jackets, generator, BBQ night',
        excluded: 'Transport to ghat, entry fees',
      },
    });
  }

  let profile = await prisma.pricingProfile.findFirst({
    where: { houseboatId, isDefault: true },
  });
  if (!profile) {
    profile = await prisma.pricingProfile.create({
      data: {
        id: id(),
        houseboatId,
        name: 'General Day',
        isDefault: true,
        dates: [],
      },
    });
    for (const [occupancy, price] of [
      [1, 6000],
      [2, 5000],
      [3, 4500],
    ] as const) {
      await prisma.pricingRule.create({
        data: {
          id: id(),
          pricingProfileId: profile.id,
          cabinCategoryId: category.id,
          occupancy,
          pricePerPerson: price,
        },
      });
    }
  }

  const band = await prisma.groupPriceBand.findFirst({ where: { houseboatId } });
  if (!band) {
    await prisma.groupPriceBand.create({
      data: {
        id: id(),
        houseboatId,
        minPeople: 10,
        maxPeople: 16,
        totalPrice: 60000,
      },
    });
  }

  // Departures over the next week.
  let firstDeparture = await prisma.tripDeparture.findFirst({
    where: { packageId: pkg.id },
    orderBy: { startDate: 'asc' },
  });
  if (!firstDeparture) {
    const dates = upcomingDates(8);
    for (const offset of [1, 3, 6]) {
      const startDate = dates[offset];
      const endDate = new Date(startDate.getTime() + 86_400_000);
      const dep = await prisma.tripDeparture.create({
        data: {
          id: id(),
          packageId: pkg.id,
          startDate,
          endDate,
          pricingProfileId: profile.id,
          availableCount: cabins.length,
          status: 'scheduled',
        },
      });
      firstDeparture ??= dep;
    }
  }

  // Maintenance requests: a spread of statuses and urgencies, one with a
  // comment thread so the request detail view has something to show.
  const existingRequest = await prisma.maintenanceRequest.findFirst({
    where: { houseboatId },
  });
  if (!existingRequest) {
    const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);
    const agoDays = (d: number) => new Date(Date.now() - d * 86_400_000);

    const railing = await prisma.maintenanceRequest.create({
      data: {
        id: id(),
        houseboatId,
        topic: 'Railing loose on upper deck',
        urgency: 'high',
        status: 'in_progress',
        requestedAt: inHours(6),
        createdBy: ownerAccountId,
        comments: {
          create: [
            {
              id: id(),
              body: 'Port-side railing bracket needs re-bolting before next trip.',
              authorId: ownerAccountId,
            },
            {
              id: id(),
              body: 'Workshop coming tomorrow morning.',
              statusChange: 'in_progress',
              authorId: ownerAccountId,
            },
          ],
        },
      },
    });
    void railing;

    await prisma.maintenanceRequest.create({
      data: {
        id: id(),
        houseboatId,
        topic: 'Generator oil top-up',
        urgency: 'medium',
        status: 'pending',
        requestedAt: inHours(48),
        createdBy: ownerAccountId,
      },
    });

    await prisma.maintenanceRequest.create({
      data: {
        id: id(),
        houseboatId,
        topic: 'Repaint life-jacket locker',
        urgency: 'low',
        status: 'pending',
        requestedAt: inHours(120),
        createdBy: ownerAccountId,
      },
    });

    await prisma.maintenanceRequest.create({
      data: {
        id: id(),
        houseboatId,
        topic: 'Cabin 102 door latch',
        urgency: 'medium',
        status: 'complete',
        requestedAt: agoDays(6),
        closedAt: agoDays(5),
        createdBy: ownerAccountId,
        comments: {
          create: {
            id: id(),
            body: 'Latch replaced, cost ৳800.',
            statusChange: 'complete',
            authorId: ownerAccountId,
          },
        },
      },
    });

    await prisma.maintenanceRequest.create({
      data: {
        id: id(),
        houseboatId,
        topic: 'Deck-light replacement (duplicate)',
        urgency: 'low',
        status: 'canceled',
        requestedAt: agoDays(3),
        closedAt: agoDays(3),
        createdBy: ownerAccountId,
      },
    });
  }

  // Inventory: one consumable below threshold, one durable.
  const item = await prisma.inventoryItem.findFirst({ where: { houseboatId } });
  if (!item) {
    await prisma.inventoryItem.create({
      data: {
        id: id(),
        houseboatId,
        name: 'Rice',
        kind: 'consumable',
        unit: 'kg',
        reorderThreshold: 10,
        currentQty: 5,
      },
    });
    await prisma.inventoryItem.create({
      data: {
        id: id(),
        houseboatId,
        name: 'Life jackets',
        kind: 'durable',
        unit: 'pcs',
        currentQty: 20,
      },
    });
  }

  // Crew: two staff with their own login accounts (deterministic phones).
  const staff = await prisma.houseboatStaff.findFirst({ where: { houseboatId } });
  if (!staff) {
    const crew = [
      { name: 'Rahim Mia', role: 'Sukani', suffix: '0', perTrip: 1500 },
      { name: 'Karim Sheikh', role: 'Cook', suffix: '1', salary: 18000 },
    ];
    for (const c of crew) {
      const phone = `+88017200000${boatIndex}${c.suffix}`;
      // Crew logins get a random password — reset via admin flow when needed.
      const account = await prisma.account.upsert({
        where: { phone },
        update: {},
        create: {
          id: id(),
          name: c.name,
          phone,
          passwordHash: await bcrypt.hash(uuidv7(), BCRYPT_ROUNDS),
          phoneVerified: true,
        },
      });
      await prisma.houseboatStaff.create({
        data: {
          id: id(),
          accountId: account.id,
          houseboatId,
          perTripRate: c.perTrip,
          monthlySalary: c.salary,
          emergencyContact: '+8801799999999',
        },
      });
    }
  }

  // A couple of costs.
  const cost = await prisma.cost.findFirst({ where: { houseboatId } });
  if (!cost) {
    await prisma.cost.create({
      data: {
        id: id(),
        houseboatId,
        date: new Date(),
        description: 'Bazar — fish, vegetables',
        amount: 3500,
        paidBy: ownerAccountId,
      },
    });
    await prisma.cost.create({
      data: {
        id: id(),
        houseboatId,
        date: new Date(Date.now() - 86_400_000),
        description: 'Diesel',
        amount: 8000,
        paidBy: ownerAccountId,
      },
    });
  }

  // One confirmed cash booking with an unverified payment — lights up the
  // dashboard "cash to verify" KPI and the Payments page.
  if (firstDeparture) {
    const existingBooking = await prisma.booking.findFirst({
      where: { departure: { package: { houseboatId } } },
    });
    if (!existingBooking) {
      const customer = await prisma.account.upsert({
        where: { phone: '+8801755555555' },
        update: {},
        create: {
          id: id(),
          name: 'Demo Customer',
          phone: '+8801755555555',
          passwordHash: await bcrypt.hash(uuidv7(), BCRYPT_ROUNDS),
          phoneVerified: true,
        },
      });
      const booking = await prisma.booking.create({
        data: {
          id: id(),
          departureId: firstDeparture.id,
          customerId: customer.id,
          bookedBy: ownerAccountId, // POS-style: owner booked at the counter
          type: 'cabin',
          status: 'confirmed',
        },
      });
      await prisma.bookingCabin.create({
        data: {
          id: id(),
          bookingId: booking.id,
          cabinId: cabins[0].id,
          adults: 2,
          children: 0,
          occupancy: 2,
          roomPrice: 10000,
        },
      });
      await prisma.bookingGuest.create({
        data: {
          id: id(),
          bookingId: booking.id,
          name: 'Demo Customer',
          phone: '+8801755555555',
        },
      });
      await prisma.tripDeparture.update({
        where: { id: firstDeparture.id },
        data: { availableCount: { decrement: 1 } },
      });
      // Bill order per plan §1: room 10,000 = 10,000 shown (no gateway fee);
      // commission 5% of room = 500; cash taken in full, not yet verified.
      const invoice = await prisma.invoice.create({
        data: {
          id: id(),
          bookingId: booking.id,
          houseboatId,
          customerId: customer.id,
          roomTotal: 10000,
          gatewayFee: 0,
          priceShown: 10000,
          discountAmount: 0,
          displayTotal: 10000,
          commission: 500,
          dueToBoat: 9500,
          amountPaid: 10000,
          status: 'paid',
        },
      });
      await prisma.invoicePayment.create({
        data: {
          id: id(),
          invoiceId: invoice.id,
          amount: 10000,
          method: 'cash',
          receivedBy: ownerAccountId,
          verifiedBy: null,
          paidAt: new Date(),
        },
      });
    }
  }
}

/**
 * Ensure a passwordless-ish demo Account exists by phone (upsert), for crew
 * and customers. Random password — reset via admin flow when needed.
 */
async function ensureDemoAccount(phone: string, name: string) {
  return prisma.account.upsert({
    where: { phone },
    update: {},
    create: {
      id: id(),
      name,
      phone,
      passwordHash: await bcrypt.hash(uuidv7(), BCRYPT_ROUNDS),
      phoneVerified: true,
    },
  });
}

/**
 * The showcase boat. Fully rebuilt from scratch on every seed (see
 * deleteBoatCascade) so its data is deterministic and demonstrates a 100%
 * complete profile plus the full booking/status matrix. Distinct from the
 * generic Haor Bilash boat.
 *
 * ids passed in: the owner (console login) and the two platform admins, used as
 * maker/checker for verified payments and refunds (separation of duties).
 */
async function reseedJolKolol(opts: {
  routeId: string;
  ownerAccountId: string;
  makerAdminId: string; // ADMIN_PHONE  — receives/verifies, refund checker
  checkerAdminId: string; // ADMIN2_PHONE — verifies/completes (must differ)
}) {
  const { routeId, ownerAccountId, makerAdminId, checkerAdminId } = opts;

  // ---- Boat: all completeness checks genuinely pass, rich detail prose. ----
  const boat = await prisma.houseboat.create({
    data: {
      id: id(),
      name: 'Jol Kolol',
      slug: 'jol-kolol',
      description:
        'Jol Kolol is a premium two-deck houseboat cruising the wetlands of ' +
        'Tanguar Haor. Spacious sun deck, air-conditioned cabins, on-board ' +
        'kitchen and a trained local crew make it ideal for families and ' +
        'group getaways across the monsoon season.',
      safetyFeatures:
        'Coast-guard approved life jackets for every guest (adult & child ' +
        'sizes), two lifebuoys, fire extinguisher, first-aid kit, trained ' +
        'sukani and swimmer crew, GPS and mobile network coverage on route.',
      foodMenu: {
        breakfast: 'Paratha, egg, seasonal bhaji and tea.',
        brunch: 'Fresh fruit and light snacks.',
        lunch: 'Rice, dal, fresh haor fish, seasonal vegetables and bhorta.',
        snacks: 'Evening pakora, muri and tea; unlimited filtered water.',
        dinner: 'BBQ night — chicken, fish, rice, salad and dessert.',
      },
      bankAccount: {
        bankName: 'Dutch-Bangla Bank Ltd',
        accountHolder: 'Jol Kolol Houseboat',
        accountNo: '1011200456789',
        branch: 'Sunamganj Branch',
        routingNumber: '090900123',
      },
      childPolicy: [
        { min: 0, max: 4, chargePct: 0 },
        { min: 5, max: 11, chargePct: 50 },
        { min: 12, max: 120, chargePct: 100 },
      ],
      status: 'live',
      profileCompletePct: 100,
      operatingDates: upcomingDates(45),
      defaultCrew: [], // filled after staff are created
    },
  });
  const houseboatId = boat.id;

  await prisma.houseboatRoute.create({
    data: { id: id(), houseboatId, routeId },
  });

  // ---- Decks, cabin categories, cabins. ----
  const lowerDeck = await prisma.houseboatDeck.create({
    data: { id: id(), houseboatId, name: 'Lower Deck', position: 1 },
  });
  const upperDeck = await prisma.houseboatDeck.create({
    data: { id: id(), houseboatId, name: 'Upper Deck', position: 2 },
  });

  const luxuryAc = await prisma.houseboatCabinCategory.create({
    data: {
      id: id(),
      houseboatId,
      name: 'Luxury AC',
      isAc: true,
      baseCapacity: 2,
      extendedCapacity: 3,
      facilities: 'AC, attached bath, private balcony, haor view, king bed.',
    },
  });
  const familyNonAc = await prisma.houseboatCabinCategory.create({
    data: {
      id: id(),
      houseboatId,
      name: 'Family Non-AC',
      isAc: false,
      baseCapacity: 4,
      extendedCapacity: 6,
      facilities: 'Ceiling fan, shared bath, two double beds, window view.',
    },
  });

  // 5 cabins: L1/L2 family on lower deck, U1/U2/U3 luxury on upper deck.
  const cabinSpecs = [
    { name: 'L1', deckId: lowerDeck.id, categoryId: familyNonAc.id },
    { name: 'L2', deckId: lowerDeck.id, categoryId: familyNonAc.id },
    { name: 'U1', deckId: upperDeck.id, categoryId: luxuryAc.id },
    { name: 'U2', deckId: upperDeck.id, categoryId: luxuryAc.id },
    { name: 'U3', deckId: upperDeck.id, categoryId: luxuryAc.id },
  ];
  const cabins: { id: string; name: string; categoryId: string }[] = [];
  for (const c of cabinSpecs) {
    const cabin = await prisma.houseboatCabin.create({
      data: {
        id: id(),
        deckId: c.deckId,
        cabinCategoryId: c.categoryId,
        name: c.name,
      },
    });
    cabins.push({ id: cabin.id, name: c.name, categoryId: c.categoryId });
  }
  const cabinCount = cabins.length;

  // ---- Cancellation policy (cited by cancel scenarios) + trip package. ----
  const cancelPolicy = await prisma.cancellationPolicy.create({
    data: {
      id: id(),
      houseboatId,
      policyTemplate: 'moderate',
      depositPct: 30,
      shownAtCheckout: true,
      tiers: [
        { days_before: 7, refund_pct: 100, is_blackout: false },
        { days_before: 3, refund_pct: 50, is_blackout: false },
        { days_before: 0, refund_pct: 0, is_blackout: false },
      ],
    },
  });

  const pkg = await prisma.tripPackage.create({
    data: {
      id: id(),
      houseboatId,
      routeId,
      durationDays: 2,
      durationLabel: '2 days 1 night',
      departureGhat: 'Tahirpur ghat, Sunamganj',
      returnGhat: 'Tahirpur ghat, Sunamganj',
      meals: 'Breakfast, lunch, dinner, evening snacks (full board)',
      included:
        'Guide, life jackets, generator, BBQ night, drinking water, cabin stay',
      excluded: 'Transport to ghat, entry/permit fees, personal expenses',
      cancellationPolicyId: cancelPolicy.id,
    },
  });

  // ---- Pricing: route-scoped general/weekend/holiday, full rule table each. ----
  const generalProfile = await prisma.pricingProfile.create({
    data: {
      id: id(),
      houseboatId,
      routeId,
      priceType: 'general',
      name: 'General Day',
      isDefault: true,
      dates: [],
    },
  });
  const weekendProfile = await prisma.pricingProfile.create({
    data: {
      id: id(),
      houseboatId,
      routeId,
      priceType: 'weekend',
      name: 'Weekend',
      isDefault: false,
      // Weekend is weekday-driven (auto Fri/Sat) — no date list.
      dates: [],
    },
  });
  const holidayProfile = await prisma.pricingProfile.create({
    data: {
      id: id(),
      houseboatId,
      routeId,
      priceType: 'holiday',
      name: 'Holiday',
      isDefault: false,
      // A 3-day holiday range (e.g. Eid) — stored as individual days.
      dates: [dayOffset(20), dayOffset(21), dayOffset(22)],
    },
  });

  // Full independent price table per profile × category × occupancy.
  const priceTable: {
    profileId: string;
    categoryId: string;
    occupancy: number;
    price: number;
  }[] = [
    // General Day — Luxury AC
    { profileId: generalProfile.id, categoryId: luxuryAc.id, occupancy: 1, price: 6000 },
    { profileId: generalProfile.id, categoryId: luxuryAc.id, occupancy: 2, price: 5000 },
    { profileId: generalProfile.id, categoryId: luxuryAc.id, occupancy: 3, price: 4500 },
    // General Day — Family Non-AC
    { profileId: generalProfile.id, categoryId: familyNonAc.id, occupancy: 2, price: 4000 },
    { profileId: generalProfile.id, categoryId: familyNonAc.id, occupancy: 4, price: 3200 },
    { profileId: generalProfile.id, categoryId: familyNonAc.id, occupancy: 6, price: 2800 },
    // Weekend — Luxury AC (higher)
    { profileId: weekendProfile.id, categoryId: luxuryAc.id, occupancy: 1, price: 7500 },
    { profileId: weekendProfile.id, categoryId: luxuryAc.id, occupancy: 2, price: 6500 },
    { profileId: weekendProfile.id, categoryId: luxuryAc.id, occupancy: 3, price: 6000 },
    // Weekend — Family Non-AC (higher)
    { profileId: weekendProfile.id, categoryId: familyNonAc.id, occupancy: 2, price: 5000 },
    { profileId: weekendProfile.id, categoryId: familyNonAc.id, occupancy: 4, price: 4200 },
    { profileId: weekendProfile.id, categoryId: familyNonAc.id, occupancy: 6, price: 3800 },
    // Holiday — Luxury AC (highest)
    { profileId: holidayProfile.id, categoryId: luxuryAc.id, occupancy: 1, price: 8500 },
    { profileId: holidayProfile.id, categoryId: luxuryAc.id, occupancy: 2, price: 7500 },
    { profileId: holidayProfile.id, categoryId: luxuryAc.id, occupancy: 3, price: 7000 },
    // Holiday — Family Non-AC (highest)
    { profileId: holidayProfile.id, categoryId: familyNonAc.id, occupancy: 2, price: 6000 },
    { profileId: holidayProfile.id, categoryId: familyNonAc.id, occupancy: 4, price: 5200 },
    { profileId: holidayProfile.id, categoryId: familyNonAc.id, occupancy: 6, price: 4800 },
  ];
  for (const r of priceTable) {
    await prisma.pricingRule.create({
      data: {
        id: id(),
        pricingProfileId: r.profileId,
        cabinCategoryId: r.categoryId,
        occupancy: r.occupancy,
        pricePerPerson: r.price,
      },
    });
  }

  // Group buyout bands.
  for (const b of [
    { minPeople: 10, maxPeople: 16, totalPrice: 60000 },
    { minPeople: 17, maxPeople: 24, totalPrice: 88000 },
  ]) {
    await prisma.groupPriceBand.create({
      data: { id: id(), houseboatId, ...b },
    });
  }

  // ---- Crew: named roles, staff with roleId, leave, payroll. ----
  const crewSpecs = [
    { name: 'Rahim Mia', role: 'Sukani', phone: '+8801720001001', nid: '1990123456789', perTrip: 1500 },
    { name: 'Karim Sheikh', role: 'Cook', phone: '+8801720001002', nid: '1988123456789', salary: 18000 },
    { name: 'Jamal Hossain', role: 'Cleaner', phone: '+8801720001003', nid: '1995123456789', salary: 12000 },
    { name: 'Sohel Rana', role: 'Guide', phone: '+8801720001004', nid: '1992123456789', perTrip: 1200 },
  ];
  const staffIds: string[] = [];
  for (const c of crewSpecs) {
    const role = await prisma.role.create({
      data: {
        id: id(),
        houseboatId,
        name: c.role,
        isTemplate: false,
        permissions: { bookings: { view: true }, trips: { view: true } },
      },
    });
    const account = await ensureDemoAccount(c.phone, c.name);
    const staff = await prisma.houseboatStaff.create({
      data: {
        id: id(),
        accountId: account.id,
        houseboatId,
        roleId: role.id,
        nid: c.nid,
        emergencyContact: '+8801799999999',
        perTripRate: c.perTrip,
        monthlySalary: c.salary,
      },
    });
    staffIds.push(staff.id);
  }

  // Assign all crew as the boat's default crew.
  await prisma.houseboat.update({
    where: { id: houseboatId },
    data: { defaultCrew: staffIds },
  });

  // Cleaner (index 2) on leave next week.
  await prisma.staffLeave.create({
    data: {
      id: id(),
      staffId: staffIds[2],
      state: 'on_leave',
      fromDate: dayOffset(5),
      toDate: dayOffset(9),
      note: 'Family emergency — back next week.',
    },
  });

  // Payroll: sukani paid last month, cook unpaid this month.
  await prisma.staffPayroll.create({
    data: {
      id: id(),
      staffId: staffIds[0],
      period: '2026-07',
      tripsWorked: 6,
      baseAmount: 9000,
      bonus: 1000,
      deduction: 0,
      totalAmount: 10000,
      paid: true,
      paidAt: dayOffset(-10),
      paidBy: ownerAccountId,
    },
  });
  await prisma.staffPayroll.create({
    data: {
      id: id(),
      staffId: staffIds[1],
      period: '2026-08',
      baseAmount: 18000,
      bonus: 0,
      deduction: 500,
      totalAmount: 17500,
      paid: false,
    },
  });

  // ---- Departure schedule. ----
  const mkDeparture = async (
    startOffset: number,
    status: string,
    profileId: string,
  ) => {
    const startDate = dayOffset(startOffset);
    const dep = await prisma.tripDeparture.create({
      data: {
        id: id(),
        packageId: pkg.id,
        startDate,
        endDate: dayOffset(startOffset + 1),
        pricingProfileId: profileId,
        availableCount: cabinCount,
        status,
      },
    });
    // Attendance: default crew on every departure.
    for (const staffId of staffIds) {
      await prisma.tripCrew.create({
        data: { id: id(), departureId: dep.id, staffId, present: true },
      });
    }
    return dep;
  };

  const futureA = await mkDeparture(2, 'scheduled', generalProfile.id);
  const futureB = await mkDeparture(5, 'scheduled', generalProfile.id);
  const futureC = await mkDeparture(9, 'scheduled', generalProfile.id);
  const weekendDep = await mkDeparture(4, 'scheduled', weekendProfile.id);
  const groupDep = await mkDeparture(14, 'scheduled', generalProfile.id);
  const rescheduleDst = await mkDeparture(20, 'scheduled', generalProfile.id);
  const rescheduleSrc = await mkDeparture(6, 'scheduled', generalProfile.id);
  const pastCompleted = await mkDeparture(-14, 'completed', generalProfile.id);
  const pastNoShowDep = await mkDeparture(-7, 'completed', generalProfile.id);
  const cancelledDep = await mkDeparture(-3, 'cancelled', generalProfile.id);

  // ---- Booking scenarios (full status matrix). ----
  // Reusable builder: booking + cabin(s) + lead guest + invoice + payment.
  const luxuryCabins = cabins.filter((c) => c.categoryId === luxuryAc.id);
  const familyCabins = cabins.filter((c) => c.categoryId === familyNonAc.id);
  const COMMISSION_PCT = 0.05;

  // Helper that wires one full booking chain. `decrementAvail` controls whether
  // the departure's available_count is reduced (active future holds only).
  const makeBooking = async (b: {
    departureId: string;
    cabinId: string;
    customerName: string;
    customerPhone: string;
    type: string;
    bookingStatus: string;
    adults: number;
    children?: number;
    roomTotal: number;
    headcount?: number;
    invoiceStatus: string;
    payment?: { method: string; verifiedById: string | null; gatewayToken?: string };
    decrementAvail: boolean;
    referenceName?: string;
  }) => {
    const customer = await ensureDemoAccount(b.customerPhone, b.customerName);
    const booking = await prisma.booking.create({
      data: {
        id: id(),
        departureId: b.departureId,
        customerId: customer.id,
        bookedBy: ownerAccountId, // POS-style, owner booked at the counter
        type: b.type,
        headcount: b.headcount,
        status: b.bookingStatus,
        referenceName: b.referenceName,
      },
    });
    const occupancy = b.adults + (b.children ?? 0);
    await prisma.bookingCabin.create({
      data: {
        id: id(),
        bookingId: booking.id,
        cabinId: b.cabinId,
        adults: b.adults,
        children: b.children ?? 0,
        occupancy,
        roomPrice: b.roomTotal,
      },
    });
    await prisma.bookingGuest.create({
      data: {
        id: id(),
        bookingId: booking.id,
        name: b.customerName,
        phone: b.customerPhone,
      },
    });
    if (b.decrementAvail) {
      await prisma.tripDeparture.update({
        where: { id: b.departureId },
        data: { availableCount: { decrement: 1 } },
      });
    }
    const commission = Math.round(b.roomTotal * COMMISSION_PCT);
    const paid = b.payment ? b.roomTotal : 0;
    const invoice = await prisma.invoice.create({
      data: {
        id: id(),
        bookingId: booking.id,
        houseboatId,
        customerId: customer.id,
        roomTotal: b.roomTotal,
        gatewayFee: 0,
        priceShown: b.roomTotal,
        discountAmount: 0,
        displayTotal: b.roomTotal,
        commission,
        dueToBoat: b.roomTotal - commission,
        amountPaid: paid,
        status: b.invoiceStatus,
        policySnapshot: { policyTemplate: 'moderate', depositPct: 30 },
      },
    });
    if (b.payment) {
      await prisma.invoicePayment.create({
        data: {
          id: id(),
          invoiceId: invoice.id,
          amount: b.roomTotal,
          method: b.payment.method,
          gatewayToken: b.payment.gatewayToken,
          receivedBy: ownerAccountId,
          verifiedBy: b.payment.verifiedById,
          paidAt: new Date(),
        },
      });
    }
    return { booking, invoice, customer };
  };

  // 1. Confirmed, paid + verified (cash).
  await makeBooking({
    departureId: futureA.id,
    cabinId: luxuryCabins[0].id,
    customerName: 'Arif Rahman',
    customerPhone: '+8801755550001',
    type: 'cabin',
    bookingStatus: 'confirmed',
    adults: 2,
    roomTotal: 10000,
    invoiceStatus: 'paid',
    payment: { method: 'cash', verifiedById: checkerAdminId },
    decrementAvail: true,
    referenceName: 'Facebook page',
  });

  // 2. Confirmed, cash taken but NOT verified — cash-to-verify KPI.
  await makeBooking({
    departureId: futureB.id,
    cabinId: luxuryCabins[1].id,
    customerName: 'Nusrat Jahan',
    customerPhone: '+8801755550002',
    type: 'cabin',
    bookingStatus: 'confirmed',
    adults: 2,
    roomTotal: 10000,
    invoiceStatus: 'paid',
    payment: { method: 'cash', verifiedById: null },
    decrementAvail: true,
  });

  // 3. Confirmed, unpaid (customer_due) — no payment row.
  await makeBooking({
    departureId: futureC.id,
    cabinId: familyCabins[0].id,
    customerName: 'Tanvir Ahmed',
    customerPhone: '+8801755550003',
    type: 'cabin',
    bookingStatus: 'confirmed',
    adults: 4,
    roomTotal: 12800,
    invoiceStatus: 'customer_due',
    decrementAvail: true,
  });

  // 4. Group buyout, paid via gateway (verified by finance/maker admin).
  await makeBooking({
    departureId: groupDep.id,
    cabinId: luxuryCabins[0].id,
    customerName: 'Corporate Retreat Ltd',
    customerPhone: '+8801755550004',
    type: 'group',
    bookingStatus: 'confirmed',
    adults: 14,
    headcount: 14,
    roomTotal: 60000,
    invoiceStatus: 'paid',
    payment: {
      method: 'gateway',
      verifiedById: makerAdminId,
      gatewayToken: `gw_jolkolol_${id()}`,
    },
    decrementAvail: true,
  });

  // 5. Completed past trip + review.
  const completedWithReview = await makeBooking({
    departureId: pastCompleted.id,
    cabinId: luxuryCabins[2].id,
    customerName: 'Sadia Islam',
    customerPhone: '+8801755550005',
    type: 'cabin',
    bookingStatus: 'completed',
    adults: 2,
    roomTotal: 10000,
    invoiceStatus: 'paid',
    payment: { method: 'cash', verifiedById: checkerAdminId },
    decrementAvail: false,
  });
  await prisma.review.create({
    data: {
      id: id(),
      bookingId: completedWithReview.booking.id,
      houseboatId,
      customerId: completedWithReview.customer.id,
      rating: 5,
      text: 'Amazing trip! Clean cabins, great food and very friendly crew.',
      ownerReply: 'Thank you Sadia! We hope to host you again next season.',
    },
  });

  // 6. Completed past trip, no review.
  await makeBooking({
    departureId: pastCompleted.id,
    cabinId: familyCabins[1].id,
    customerName: 'Mizanur Rahman',
    customerPhone: '+8801755550006',
    type: 'cabin',
    bookingStatus: 'completed',
    adults: 4,
    roomTotal: 12800,
    invoiceStatus: 'paid',
    payment: { method: 'gateway', verifiedById: makerAdminId, gatewayToken: `gw_jolkolol_${id()}` },
    decrementAvail: false,
  });

  // 7. Not arrived (no-show) — paid but forfeited.
  await makeBooking({
    departureId: pastNoShowDep.id,
    cabinId: luxuryCabins[0].id,
    customerName: 'Rakib Hasan',
    customerPhone: '+8801755550007',
    type: 'cabin',
    bookingStatus: 'not_arrived',
    adults: 2,
    roomTotal: 10000,
    invoiceStatus: 'paid',
    payment: { method: 'cash', verifiedById: checkerAdminId },
    decrementAvail: false,
  });

  // 8. Cancelled by customer — refunded per policy, NO owner refund row.
  await makeBooking({
    departureId: futureA.id,
    cabinId: familyCabins[0].id,
    customerName: 'Farhana Akter',
    customerPhone: '+8801755550008',
    type: 'cabin',
    bookingStatus: 'cancelled',
    adults: 4,
    roomTotal: 12800,
    invoiceStatus: 'refunded',
    payment: { method: 'cash', verifiedById: checkerAdminId },
    decrementAvail: false, // cabin freed on cancel, count unchanged
  });

  // 9. Cancelled by boat (owner-cancel) + full InvoiceRefund (separation of duties).
  const ownerCancel = await makeBooking({
    departureId: cancelledDep.id,
    cabinId: luxuryCabins[1].id,
    customerName: 'Imran Kabir',
    customerPhone: '+8801755550009',
    type: 'cabin',
    bookingStatus: 'cancelled',
    adults: 2,
    roomTotal: 10000,
    invoiceStatus: 'refunded',
    payment: { method: 'gateway', verifiedById: makerAdminId, gatewayToken: `gw_jolkolol_${id()}` },
    decrementAvail: false,
  });
  await prisma.invoiceRefund.create({
    data: {
      id: id(),
      invoiceId: ownerCancel.invoice.id,
      amount: 10180, // full displayTotal returned
      reason: 'Owner cancelled the trip (weather).',
      bankDetails: { bankName: 'bKash', accountNumber: '+8801755550009' },
      requestedBy: ownerAccountId,
      verifiedBy: makerAdminId,
      completedBy: checkerAdminId, // must differ from verifiedBy
      status: 'completed',
      claimDeadline: dayOffset(3),
      completedAt: dayOffset(-1),
    },
  });

  // 10. Rescheduled: original marked rescheduled, history row, new confirmed booking.
  const original = await makeBooking({
    departureId: rescheduleSrc.id,
    cabinId: luxuryCabins[2].id,
    customerName: 'Shamima Nasrin',
    customerPhone: '+8801755550010',
    type: 'cabin',
    bookingStatus: 'rescheduled',
    adults: 2,
    roomTotal: 10000,
    invoiceStatus: 'paid',
    payment: { method: 'cash', verifiedById: checkerAdminId },
    decrementAvail: false,
  });
  const rebooked = await makeBooking({
    departureId: rescheduleDst.id,
    cabinId: luxuryCabins[2].id,
    customerName: 'Shamima Nasrin',
    customerPhone: '+8801755550010',
    type: 'cabin',
    bookingStatus: 'confirmed',
    adults: 2,
    roomTotal: 11000, // repriced at the new date
    invoiceStatus: 'paid',
    payment: { method: 'cash', verifiedById: checkerAdminId },
    decrementAvail: true,
  });
  await prisma.bookingRescheduleHistory.create({
    data: {
      id: id(),
      bookingId: rebooked.booking.id,
      prevDepartureId: rescheduleSrc.id,
      changedToDepartureId: rescheduleDst.id,
      oldPrice: 10000,
      newPrice: 11000,
      reason: 'Customer requested a later date.',
      changedBy: ownerAccountId,
    },
  });
  void original;
  void weekendDep;

  // ---- Media gallery: images + one video per allowlisted provider. ----
  // Video URLs are canonical shapes that pass resolveVideoUrl() in
  // src/media/video-providers.ts (youtube/vimeo/google_drive framable inline;
  // facebook/instagram link out). One image is cabin-scoped, rest boat-level.
  const mediaRows: {
    kind: 'image' | 'video';
    storageKey: string | null;
    videoUrl: string | null;
    videoProvider: string | null;
    cabinId: string | null;
    sortOrder: number;
  }[] = [
    { kind: 'image', storageKey: 'demo/jol-kolol/exterior.jpg', videoUrl: null, videoProvider: null, cabinId: null, sortOrder: 0 },
    { kind: 'image', storageKey: 'demo/jol-kolol/deck.jpg', videoUrl: null, videoProvider: null, cabinId: null, sortOrder: 1 },
    { kind: 'image', storageKey: 'demo/jol-kolol/luxury-cabin.jpg', videoUrl: null, videoProvider: null, cabinId: cabins[0].id, sortOrder: 2 },
    { kind: 'video', storageKey: null, videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', videoProvider: 'youtube', cabinId: null, sortOrder: 3 },
    { kind: 'video', storageKey: null, videoUrl: 'https://vimeo.com/76979871', videoProvider: 'vimeo', cabinId: null, sortOrder: 4 },
    { kind: 'video', storageKey: null, videoUrl: 'https://drive.google.com/file/d/1a2B3c4D5e6F7g8H9i0J1k2L3m4N5o6P7/view', videoProvider: 'google_drive', cabinId: null, sortOrder: 5 },
    { kind: 'video', storageKey: null, videoUrl: 'https://www.facebook.com/watch/?v=1234567890', videoProvider: 'facebook', cabinId: null, sortOrder: 6 },
    { kind: 'video', storageKey: null, videoUrl: 'https://www.instagram.com/reel/CabcDEF1234/', videoProvider: 'instagram', cabinId: null, sortOrder: 7 },
  ];
  for (const m of mediaRows) {
    await prisma.houseboatMedia.create({
      data: { id: id(), houseboatId, uploadedBy: ownerAccountId, ...m },
    });
  }

  // ---- Weekly schedule engine: one active schedule, 2 trip slots. ----
  const schedule = await prisma.boatSchedule.create({
    data: { id: id(), houseboatId, packageId: pkg.id, active: true },
  });
  await prisma.tripScheduleSlot.create({
    data: {
      id: id(),
      scheduleId: schedule.id,
      slotNo: 1,
      weekdays: [4, 5], // Thu, Fri
      pricingProfileId: generalProfile.id,
    },
  });
  await prisma.tripScheduleSlot.create({
    data: {
      id: id(),
      scheduleId: schedule.id,
      slotNo: 2,
      weekdays: [6], // Sat
      pricingProfileId: weekendProfile.id,
    },
  });

  // ---- Active cabin hold (10-min TTL) on a future departure. ----
  await prisma.cabinHold.create({
    data: {
      id: id(),
      cabinId: cabins[0].id,
      departureId: futureB.id,
      heldBy: ownerAccountId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      state: 'held',
    },
  });

  // ---- Waitlist entry on a future departure. ----
  const waitlistCustomer = await ensureDemoAccount('+8801755550020', 'Habib Ullah');
  await prisma.bookingWaitlist.create({
    data: {
      id: id(),
      departureId: futureC.id,
      customerId: waitlistCustomer.id,
      partySize: 3,
    },
  });

  // ---- Quote requests: one pending, one priced/sent. ----
  const quoteCustomer = await ensureDemoAccount('+8801755550021', 'Reza Karim');
  await prisma.quoteRequest.create({
    data: {
      id: id(),
      houseboatId,
      customerId: quoteCustomer.id,
      date: dayOffset(12),
      groupSize: 18,
      specialNeeds: 'Vegetarian meals for the whole group.',
      status: 'requested',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  await prisma.quoteRequest.create({
    data: {
      id: id(),
      houseboatId,
      customerId: quoteCustomer.id,
      date: dayOffset(16),
      groupSize: 10,
      specialNeeds: 'Anniversary decoration in one cabin.',
      quotedPrice: 55000,
      status: 'sent',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // ---- Coupon (now covered by deleteBoatCascade). ----
  await prisma.coupon.create({
    data: {
      id: id(),
      houseboatId,
      code: 'MONSOON10',
      kind: 'percent',
      value: 10,
      validFrom: dayOffset(-5),
      validTo: dayOffset(30),
      isActive: true,
    },
  });

  // ---- Notifications. Keyed by accountId (not houseboatId), so the boat
  // teardown doesn't clear them; clear this seed's accounts up front to stay
  // idempotent, then reseed. ----
  await prisma.notification.deleteMany({
    where: { accountId: { in: [ownerAccountId, waitlistCustomer.id] } },
  });
  await prisma.notification.create({
    data: {
      id: id(),
      accountId: ownerAccountId,
      event: 'booking',
      channel: 'sms',
      delivered: true,
      payload: { phone: '+8801755550001', message: 'New booking confirmed for Jol Kolol.' },
    },
  });
  await prisma.notification.create({
    data: {
      id: id(),
      accountId: ownerAccountId,
      event: 'payment_due',
      channel: 'email',
      delivered: false,
      payload: { email: 'owner@houseboat.test', subject: 'Payment due', message: 'A customer payment is outstanding.' },
    },
  });
  await prisma.notification.create({
    data: {
      id: id(),
      accountId: waitlistCustomer.id,
      event: 'offer',
      channel: 'sms',
      delivered: true,
      payload: { phone: '+8801755550020', message: 'A cabin opened up on your waitlisted trip.' },
    },
  });

  return houseboatId;
}

/**
 * Demo data: two platform admins, one boat owner, two routes, two LIVE
 * houseboats with owner membership, pricing, departures, maintenance,
 * inventory, crew, costs and one cash booking each.
 *
 * Safe to re-run: accounts upsert, everything else is matched before create.
 * Owner enrichment runs even for boats created by an older seed.
 */
async function main() {
  // Platform admins — a maker/checker pair (see seedAccount doc).
  const admin1 = await seedAccount({
    phone: requireEnv('ADMIN_PHONE'),
    password: requireEnv('ADMIN_PASSWORD'),
    name: 'Platform Admin',
    email: 'admin@houseboat.test',
    isPlatform: true,
  });
  const admin2 = await seedAccount({
    phone: requireEnv('ADMIN2_PHONE'),
    password: requireEnv('ADMIN2_PASSWORD'),
    name: 'Platform Admin (Checker)',
    email: 'admin2@houseboat.test',
    isPlatform: true,
  });

  // Boat owner for the demo boats (owner console login).
  const owner = await seedAccount({
    phone: requireEnv('OWNER_PHONE'),
    password: requireEnv('OWNER_PASSWORD'),
    name: 'Kamal Uddin',
    email: 'owner@houseboat.test',
    isPlatform: false,
  });

  // Routes (platform-curated). Route has no unique constraint to upsert on,
  // so look up by name to keep the seed re-runnable.
  const tanguar = await findOrCreateRoute('Tanguar Haor', 'Sunamganj');
  const nikli = await findOrCreateRoute('Nikli Haor', 'Kishoreganj');

  // Jol Kolol is the showcase boat: fully torn down and rebuilt from scratch
  // every seed so its rich 100%-complete profile and full booking/status
  // matrix are deterministic. Haor Bilash stays on the generic idempotent path.
  console.log('Reseeding Jol Kolol (full teardown + rebuild)...');
  await deleteBoatCascade('jol-kolol');
  const jolKololId = await reseedJolKolol({
    routeId: tanguar.id,
    ownerAccountId: owner.id,
    makerAdminId: admin1.id,
    checkerAdminId: admin2.id,
  });
  await ensureOwnerMembership(jolKololId, owner.id);
  await ensureBillingConfig(jolKololId);

  // Haor Bilash — generic demo boat via the idempotent helpers.
  const haorBilashId = await ensureBoat({
    name: 'Haor Bilash',
    slug: 'haor-bilash',
    route: nikli.id,
  });
  await ensureOwnerMembership(haorBilashId, owner.id);
  await ensureBillingConfig(haorBilashId);
  await ensureDemoData(haorBilashId, owner.id, 1);

  console.log(
    'Seed complete: 2 live houseboats (owner: Kamal Uddin), Jol Kolol fully populated, 2 routes, 2 platform admins.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
