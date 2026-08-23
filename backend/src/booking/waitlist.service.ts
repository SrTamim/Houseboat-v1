import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../common/uuid';

/**
 * Waitlist. When a cabin frees, the customers waiting on it are notified at once;
 * the notification link routes through a normal hold attempt so first-to-hold
 * wins (plan §2). No queue positions are stored.
 *
 * A row may name a specific cabin, or leave `cabinId` NULL meaning "any cabin on
 * this trip" — the shape every row had before per-cabin waitlisting existed.
 */
@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Join the waitlist, optionally for one specific cabin.
   *
   * Idempotent per (departure, customer, cabin): tapping the same cabin twice
   * updates the party size, while tapping a *different* cabin adds a second row.
   * The cabin is part of the key on purpose — matching on (departure, customer)
   * alone meant a second cabin overwrote the first, so a customer could only ever
   * wait on one thing per trip.
   */
  async join(
    departureId: string,
    customerId: string,
    partySize: number,
    cabinId?: string | null,
  ) {
    const cabin = cabinId ?? null;
    if (cabin) {
      // The cabin must belong to the boat this departure sails on: the id comes
      // from the client, and nothing else here would stop a hand-crafted request
      // attaching an unrelated boat's cabin to the row.
      const ok = await this.prisma.houseboatCabin.findFirst({
        where: {
          id: cabin,
          deck: {
            houseboat: {
              tripPackages: { some: { departures: { some: { id: departureId } } } },
            },
          },
        },
        select: { id: true },
      });
      if (!ok) {
        throw new NotFoundException('That cabin is not on this trip');
      }
    }

    const existing = await this.prisma.bookingWaitlist.findFirst({
      where: { departureId, customerId, cabinId: cabin },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.bookingWaitlist.update({
        where: { id: existing.id },
        data: { partySize },
      });
    }
    return this.prisma.bookingWaitlist.create({
      data: { id: newId(), departureId, customerId, partySize, cabinId: cabin },
    });
  }

  /** Leave a waitlist entry (must be the caller's own). */
  async leave(id: string, customerId: string) {
    const res = await this.prisma.bookingWaitlist.deleteMany({
      where: { id, customerId },
    });
    if (res.count === 0) throw new NotFoundException('Waitlist entry not found');
    return { ok: true };
  }

  /**
   * The caller's own waitlist entries, with the departure they're waiting on.
   *
   * `availableCount` is recomputed here from the LIVE cabin state (confirmed
   * bookings + unexpired holds), not read off the denormalised
   * `TripDeparture.availableCount`. That denormalised counter can drift — an
   * open-seat cabin is "booked" yet the counter may still show it, or a lapsed
   * hold hasn't been swept — which made a fully-booked trip wrongly advertise
   * "a cabin just opened" on the waitlist. The truth is: a cabin is free only if
   * it has no live booking AND no unexpired hold (open-seat cabins with spare
   * places still count as bookable, matching the boat page's snapshot).
   */
  async listForCustomer(customerId: string) {
    const entries = await this.prisma.bookingWaitlist.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        // The specific cabin, when the row names one, so the page can label it.
        cabin: { select: { id: true, name: true, deck: { select: { name: true } } } },
        departure: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            departureTime: true,
            availableCount: true,
            package: {
              select: {
                durationLabel: true,
                houseboat: {
                  select: {
                    name: true,
                    slug: true,
                    decks: {
                      select: {
                        cabins: {
                          select: {
                            id: true,
                            category: {
                              select: {
                                baseCapacity: true,
                                extendedCapacity: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                route: { select: { name: true, region: true } },
              },
            },
          },
        },
      },
    });

    const departureIds = entries
      .map((e) => e.departure?.id)
      .filter((id): id is string => !!id);
    // No departures to inspect — still hand back the same shape, so the client
    // never sees `cabinFree` present on some rows and missing on others.
    if (departureIds.length === 0) {
      return entries.map((e) => ({ ...e, cabinFree: false }));
    }

    const now = new Date();
    const [bookingCabins, holds] = await Promise.all([
      this.prisma.bookingCabin.findMany({
        where: { booking: { departureId: { in: departureIds }, status: { not: 'cancelled' } } },
        select: {
          cabinId: true,
          occupancy: true,
          isOpenSeat: true,
          booking: { select: { departureId: true } },
        },
      }),
      this.prisma.cabinHold.findMany({
        where: { departureId: { in: departureIds }, state: 'held', expiresAt: { gt: now } },
        select: { cabinId: true, departureId: true },
      }),
    ]);

    // Per-departure sets of cabins that are unavailable (held or fully booked)
    // and a per-cabin capacity lookup for the open-seat spare check.
    const heldByDep = new Map<string, Set<string>>();
    for (const h of holds) {
      (heldByDep.get(h.departureId) ?? heldByDep.set(h.departureId, new Set()).get(h.departureId)!).add(h.cabinId);
    }
    const bookedByDep = new Map<string, Map<string, { occupancy: number; isOpenSeat: boolean }>>();
    for (const bc of bookingCabins) {
      const depId = bc.booking.departureId;
      if (!depId) continue;
      const m = bookedByDep.get(depId) ?? bookedByDep.set(depId, new Map()).get(depId)!;
      m.set(bc.cabinId, { occupancy: bc.occupancy, isOpenSeat: bc.isOpenSeat });
    }

    return entries.map((e) => {
      const dep = e.departure;
      if (!dep) return { ...e, cabinFree: false };
      const held = heldByDep.get(dep.id) ?? new Set<string>();
      const booked = bookedByDep.get(dep.id) ?? new Map();
      const allCabins = dep.package?.houseboat?.decks.flatMap((d) => d.cabins) ?? [];
      /** Is one cabin bookable right now? Same rule the boat page's snapshot uses. */
      const isFree = (cabin: (typeof allCabins)[number]) => {
        if (held.has(cabin.id)) return false;
        const bc = booked.get(cabin.id);
        if (!bc) return true;
        // Open-seat cabin with spare places still counts as bookable.
        if (bc.isOpenSeat) {
          const cap = cabin.category.extendedCapacity ?? cabin.category.baseCapacity;
          return cap - bc.occupancy > 0;
        }
        return false;
      };
      let free = 0;
      for (const cabin of allCabins) {
        if (isFree(cabin)) free += 1;
      }
      // For a cabin-specific row, "has my cabin freed?" is the question that
      // matters — the trip-wide count would claim good news about a cabin the
      // customer never asked for. Reuses the sets already built above, so this
      // costs no extra query. NULL-cabin (legacy) rows fall back to the trip.
      const waitedCabin = e.cabinId
        ? allCabins.find((c) => c.id === e.cabinId)
        : undefined;
      const cabinFree = waitedCabin ? isFree(waitedCabin) : free > 0;
      // Strip the cabin structure we only needed for counting; hand back the same
      // shape the frontend already consumes, with a truthful availableCount.
      const { houseboat, ...pkgRest } = dep.package ?? ({} as NonNullable<typeof dep.package>);
      const houseboatSlim = houseboat
        ? { name: houseboat.name, slug: houseboat.slug }
        : houseboat;
      return {
        ...e,
        cabinFree,
        departure: {
          ...dep,
          availableCount: free,
          package: dep.package ? { ...pkgRest, houseboat: houseboatSlim } : dep.package,
        },
      };
    });
  }

  /** Accounts to notify when a cabin frees on this departure. */
  listForDeparture(departureId: string) {
    return this.prisma.bookingWaitlist.findMany({
      where: { departureId },
      include: { customer: { select: { id: true, phone: true, email: true } } },
    });
  }
}
