import { NotFoundException } from '@nestjs/common';
import { PlatformFinanceService } from './platform-finance.service';

describe('PlatformFinanceService.upsertBillingConfig', () => {
  const existingRow = {
    id: 'cfg-1',
    houseboatId: 'boat',
    commissionPct: { toString: () => '5' },
    monthlyFee: { toString: () => '5000' },
    platformBalance: { toString: () => '-1200' },
    trialEnds: null,
  };

  function makeService(opts: { boatExists?: boolean; existing?: boolean }) {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const create = jest.fn((args: { data: object }) =>
      Promise.resolve({ ...existingRow, ...args.data }),
    );
    const update = jest.fn((args: { data: object }) =>
      Promise.resolve({ ...existingRow, ...args.data }),
    );
    const prisma = {
      houseboat: {
        findUnique: jest
          .fn()
          .mockResolvedValue(opts.boatExists === false ? null : { id: 'boat' }),
      },
      houseboatBillingConfig: {
        findFirst: jest
          .fn()
          .mockResolvedValue(opts.existing ? existingRow : null),
        create,
        update,
      },
    };
    const svc = new PlatformFinanceService(prisma as never, audit as never);
    return { svc, create, update, audit };
  }

  const dto = { commissionPct: 7.5, monthlyFee: 4000 };

  it('404s for a missing boat', async () => {
    const { svc } = makeService({ boatExists: false });
    await expect(
      svc.upsertBillingConfig('nope', dto, 'actor'),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates when no config exists', async () => {
    const { svc, create, update } = makeService({ existing: false });
    await svc.upsertBillingConfig('boat', dto, 'actor');
    expect(create).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('updates when a config exists', async () => {
    const { svc, create, update } = makeService({ existing: true });
    await svc.upsertBillingConfig('boat', dto, 'actor');
    expect(update).toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('NEVER writes platformBalance — it is ledger-owned', async () => {
    const { svc, update } = makeService({ existing: true });
    await svc.upsertBillingConfig('boat', dto, 'actor');
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(Object.keys(data)).not.toContain('platformBalance');
    expect(Object.keys(data).sort()).toEqual([
      'commissionPct',
      'monthlyFee',
      'trialEnds',
    ]);
  });

  it('absent fields clear to NULL (PUT semantics)', async () => {
    const { svc, update } = makeService({ existing: true });
    await svc.upsertBillingConfig('boat', { commissionPct: 5 }, 'actor');
    const data = update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.monthlyFee).toBeNull();
    expect(data.trialEnds).toBeNull();
  });

  it('audits with before/after limited to the editable fields', async () => {
    const { svc, audit } = makeService({ existing: true });
    await svc.upsertBillingConfig('boat', dto, 'actor-2');
    const entry = audit.log.mock.calls[0][0];
    expect(entry.action).toBe('billing_config_upsert');
    expect(entry.actorAccountId).toBe('actor-2');
    expect(Object.keys(entry.before as object)).not.toContain('platformBalance');
    expect(Object.keys(entry.after as object)).not.toContain('platformBalance');
  });
});
