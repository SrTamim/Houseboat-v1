import { HoldSweeperService } from './hold-sweeper.service';

/**
 * reconcileAvailability recomputes TripDeparture.availableCount from live state
 * (audit backstop): a cabin is free when it has no unexpired hold and no
 * non-cancelled booking (an open-seat cabin with spare places still counts).
 * Only departures whose stored count disagrees are corrected.
 */
describe('HoldSweeperService.reconcileAvailability', () => {
  const future = new Date(Date.now() + 3_600_000);

  // A departure with 3 cabins; the mock returns fixed live state below.
  function makeSweeper(opts: {
    storedCount: number;
    heldCabinIds?: string[];
    bookedCabins?: { cabinId: string; occupancy: number; isOpenSeat: boolean }[];
  }) {
    const cabins = ['c1', 'c2', 'c3'].map((id) => ({
      id,
      category: { baseCapacity: 4, extendedCapacity: 4 },
    }));
    const updates: any[] = [];
    const prisma = {
      tripDeparture: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'dep-1',
            availableCount: opts.storedCount,
            package: { houseboat: { decks: [{ cabins }] } },
          },
        ]),
        update: jest.fn(({ where, data }: any) => {
          updates.push({ id: where.id, ...data });
          return Promise.resolve({});
        }),
      },
      bookingCabin: {
        findMany: jest.fn().mockResolvedValue(
          (opts.bookedCabins ?? []).map((b) => ({
            cabinId: b.cabinId,
            occupancy: b.occupancy,
            isOpenSeat: b.isOpenSeat,
            booking: { departureId: 'dep-1' },
          })),
        ),
      },
      cabinHold: {
        findMany: jest.fn().mockResolvedValue(
          (opts.heldCabinIds ?? []).map((cabinId) => ({
            cabinId,
            departureId: 'dep-1',
          })),
        ),
      },
    };
    const realtime = { emitCabinState: jest.fn(), emitAvailability: jest.fn() };
    const svc = new HoldSweeperService(prisma as never, realtime as never);
    return { svc, updates, realtime };
  }

  it('corrects a drifted (too-high) count', async () => {
    // 1 held + 1 fully booked → only 1 of 3 free, but stored says 3.
    const { svc, updates } = makeSweeper({
      storedCount: 3,
      heldCabinIds: ['c1'],
      bookedCabins: [{ cabinId: 'c2', occupancy: 4, isOpenSeat: false }],
    });
    await svc.reconcileAvailability();
    expect(updates).toEqual([{ id: 'dep-1', availableCount: 1 }]);
  });

  it('counts an open-seat cabin with spare places as free', async () => {
    // c2 is open-seat with 2 of 4 taken → still free. c1 held. → 2 free (c2,c3).
    const { svc, updates } = makeSweeper({
      storedCount: 0,
      heldCabinIds: ['c1'],
      bookedCabins: [{ cabinId: 'c2', occupancy: 2, isOpenSeat: true }],
    });
    await svc.reconcileAvailability();
    expect(updates).toEqual([{ id: 'dep-1', availableCount: 2 }]);
  });

  it('leaves a correct count untouched (no write)', async () => {
    const { svc, updates } = makeSweeper({
      storedCount: 3,
      heldCabinIds: [],
      bookedCabins: [],
    });
    await svc.reconcileAvailability();
    expect(updates).toHaveLength(0);
  });
});
