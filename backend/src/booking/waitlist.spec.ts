import { NotFoundException } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';

/**
 * Per-cabin waitlisting.
 *
 * A row used to key on (departure, customer) alone, so tapping a second cabin on
 * the same trip UPDATED the first row instead of adding one — a customer could
 * only ever wait on one thing per trip, and the account page could only list
 * trips. The cabin is now part of the identity of a row.
 *
 * `cabinId: null` still means "any cabin on this trip", which is what every row
 * created before this existed means. Those must keep working untouched.
 */

const DEP = 'dep-1';
const CUST = 'cust-1';

function makeService(rows: Array<Record<string, unknown>> = [], cabinOnTrip = true) {
  const prisma = {
    houseboatCabin: {
      // The validation query: does this cabin belong to the trip's boat?
      findFirst: jest.fn(({ where }: any) =>
        Promise.resolve(cabinOnTrip ? { id: where.id } : null),
      ),
    },
    bookingWaitlist: {
      findFirst: jest.fn(({ where }: any) =>
        Promise.resolve(
          rows.find(
            (r) =>
              r.departureId === where.departureId &&
              r.customerId === where.customerId &&
              (r.cabinId ?? null) === (where.cabinId ?? null),
          ) ?? null,
        ),
      ),
      update: jest.fn(({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
      create: jest.fn(({ data }: any) => {
        rows.push({ ...data });
        return Promise.resolve(data);
      }),
    },
  };
  const svc = new WaitlistService(prisma as never);
  return { svc, rows, prisma };
}

describe('WaitlistService.join — per cabin', () => {
  it('creates a separate row for each cabin on the same trip', async () => {
    const { svc, rows } = makeService();
    await svc.join(DEP, CUST, 2, 'cab-A');
    await svc.join(DEP, CUST, 2, 'cab-B');
    // The regression: the second call used to overwrite the first.
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.cabinId).sort()).toEqual(['cab-A', 'cab-B']);
  });

  it('is idempotent for the same cabin — updates, never stacks', async () => {
    const { svc, rows, prisma } = makeService();
    await svc.join(DEP, CUST, 2, 'cab-A');
    await svc.join(DEP, CUST, 4, 'cab-A');
    expect(rows).toHaveLength(1);
    expect(rows[0].partySize).toBe(4);
    expect(prisma.bookingWaitlist.update).toHaveBeenCalledTimes(1);
  });

  it('keeps a trip-level (no cabin) row distinct from a cabin row', async () => {
    const { svc, rows } = makeService();
    await svc.join(DEP, CUST, 2); // "any cabin"
    await svc.join(DEP, CUST, 2, 'cab-A');
    expect(rows).toHaveLength(2);
    expect(rows[0].cabinId).toBeNull();
    expect(rows[1].cabinId).toBe('cab-A');
  });

  it('still de-dupes trip-level joins (legacy behaviour)', async () => {
    const { svc, rows } = makeService();
    await svc.join(DEP, CUST, 2);
    await svc.join(DEP, CUST, 3);
    expect(rows).toHaveLength(1);
    expect(rows[0].partySize).toBe(3);
  });

  it('rejects a cabin that is not on this trip', async () => {
    // The cabin id comes from the client; nothing else would stop a hand-crafted
    // request attaching another boat's cabin to the row.
    const { svc, rows } = makeService([], false);
    await expect(svc.join(DEP, CUST, 2, 'cab-OTHER')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(rows).toHaveLength(0);
  });

  it('does not run the cabin check for a trip-level join', async () => {
    const { svc, prisma } = makeService();
    await svc.join(DEP, CUST, 2);
    expect(prisma.houseboatCabin.findFirst).not.toHaveBeenCalled();
  });

  it('separates customers waiting on the same cabin', async () => {
    const { svc, rows } = makeService();
    await svc.join(DEP, CUST, 2, 'cab-A');
    await svc.join(DEP, 'cust-2', 2, 'cab-A');
    expect(rows).toHaveLength(2);
  });
});
