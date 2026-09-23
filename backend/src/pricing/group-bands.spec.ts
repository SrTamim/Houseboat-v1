import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';

/**
 * Group price bands must not overlap (audit P3): bandForHeadcount uses findFirst,
 * so two bands covering the same headcount resolve nondeterministically to a
 * different buyout price on different requests.
 */
describe('PricingService.addGroupBand — overlap guard', () => {
  function makeService(existing: unknown) {
    const prisma = {
      groupPriceBand: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(({ data }: any) => Promise.resolve({ ...data })),
      },
    };
    return {
      svc: new PricingService(prisma as never, { log: jest.fn() } as never),
      prisma,
    };
  }

  const dto = { minPeople: 10, maxPeople: 20, totalPrice: 50000 } as never;

  it('rejects maxPeople < minPeople', async () => {
    const { svc } = makeService(null);
    await expect(
      svc.addGroupBand('boat-1', { minPeople: 20, maxPeople: 10, totalPrice: 1 } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a band overlapping an existing one', async () => {
    const { svc, prisma } = makeService({ minPeople: 15, maxPeople: 25 });
    await expect(svc.addGroupBand('boat-1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.groupPriceBand.create).not.toHaveBeenCalled();
  });

  it('creates a non-overlapping band', async () => {
    const { svc, prisma } = makeService(null);
    await expect(svc.addGroupBand('boat-1', dto)).resolves.toMatchObject({
      minPeople: 10,
      maxPeople: 20,
    });
    expect(prisma.groupPriceBand.create).toHaveBeenCalled();
  });
});
