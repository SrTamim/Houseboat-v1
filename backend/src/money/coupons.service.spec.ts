import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CouponsService } from './coupons.service';

describe('CouponsService.createCoupon — hardening', () => {
  function makeService(opts: {
    boatExists?: boolean;
    duplicate?: boolean;
  }) {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const created = {
      id: 'coupon-1',
      code: 'EID10',
      kind: 'percent',
      value: { toString: () => '10' },
    };
    const prisma = {
      houseboat: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.boatExists === false ? null : { id: 'boat' }),
      },
      coupon: {
        findFirst: jest
          .fn()
          .mockResolvedValue(opts.duplicate ? { id: 'dupe' } : null),
        create: jest.fn().mockResolvedValue(created),
      },
    };
    const svc = new CouponsService(prisma as never, audit as never);
    return { svc, prisma, audit };
  }

  const valid = {
    code: 'EID10',
    kind: 'percent' as const,
    value: 10,
  };

  it('404s when the boat does not exist (platform bypass safety)', async () => {
    const { svc } = makeService({ boatExists: false });
    await expect(svc.createCoupon('nope', valid, 'actor')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects percent coupons over 100', async () => {
    const { svc } = makeService({});
    await expect(
      svc.createCoupon('boat', { ...valid, value: 150 }, 'actor'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows flat coupons over 100 (that is an amount, not a percent)', async () => {
    const { svc } = makeService({});
    await expect(
      svc.createCoupon('boat', { ...valid, kind: 'flat', value: 500 }, 'actor'),
    ).resolves.toBeDefined();
  });

  it('rejects validFrom after validTo', async () => {
    const { svc } = makeService({});
    await expect(
      svc.createCoupon(
        'boat',
        { ...valid, validFrom: '2026-08-10', validTo: '2026-08-01' },
        'actor',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('409s on a duplicate code for the same boat', async () => {
    const { svc } = makeService({ duplicate: true });
    await expect(svc.createCoupon('boat', valid, 'actor')).rejects.toThrow(
      ConflictException,
    );
  });

  it('creates and audits with the acting account', async () => {
    const { svc, audit } = makeService({});
    await svc.createCoupon('boat', valid, 'actor-9');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'coupon_create',
        actorAccountId: 'actor-9',
        houseboatId: 'boat',
      }),
    );
  });
});
