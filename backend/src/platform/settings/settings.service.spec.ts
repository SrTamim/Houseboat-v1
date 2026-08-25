import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SETTING_DEF_BY_KEY } from './setting-defs';

/**
 * SettingsService: defaults when the table is empty, stored values when present,
 * bounds enforcement on write, and an audit row per change. The consuming
 * services (holds, auth, billing) rely on getNumber never throwing for a known
 * key — an empty table must reproduce the compiled-in constant.
 */

function makeService(rows: { key: string; value: string }[] = []) {
  const store = new Map(rows.map((r) => [r.key, r.value]));
  const prisma = {
    appSetting: {
      findMany: jest.fn(() =>
        Promise.resolve([...store.entries()].map(([key, value]) => ({ key, value }))),
      ),
      upsert: jest.fn(({ where, create, update }: any) => {
        store.set(where.key, (update?.value ?? create.value) as string);
        return Promise.resolve({ key: where.key, value: store.get(where.key) });
      }),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const svc = new SettingsService(prisma as never, audit as never);
  return { svc, prisma, audit, store };
}

describe('SettingsService', () => {
  it('returns the compiled-in default when no row exists', async () => {
    const { svc } = makeService();
    expect(await svc.getNumber('hold.ttlMin')).toBe(
      SETTING_DEF_BY_KEY['hold.ttlMin'].default,
    );
  });

  it('returns the stored value when a row exists', async () => {
    const { svc } = makeService([{ key: 'hold.ttlMin', value: '25' }]);
    expect(await svc.getNumber('hold.ttlMin')).toBe(25);
  });

  it('writes, audits, and reads back the new value', async () => {
    const { svc, audit } = makeService();
    await svc.set('hold.ttlMin', 15, 'admin-1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'setting_update',
        entityId: 'hold.ttlMin',
        actorAccountId: 'admin-1',
        before: { value: 10 },
        after: { value: 15 },
      }),
    );
    expect(await svc.getNumber('hold.ttlMin')).toBe(15);
  });

  it('rejects a value below the setting minimum', async () => {
    const { svc } = makeService();
    await expect(svc.set('hold.ttlMin', 1, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a value above the setting maximum (the ceiling)', async () => {
    const { svc } = makeService();
    // booking.maxCabins ceiling is 4 — cannot be raised above it.
    await expect(
      svc.set('booking.maxCabins', 5, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown setting key', async () => {
    const { svc } = makeService();
    await expect(svc.set('nope.nope', 1, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('lists every setting with value + isDefault', async () => {
    const { svc } = makeService([{ key: 'hold.ttlMin', value: '20' }]);
    const list = await svc.list();
    const ttl = list.find((s) => s.key === 'hold.ttlMin');
    const grace = list.find((s) => s.key === 'hold.graceMin');
    expect(ttl).toMatchObject({ value: 20, isDefault: false });
    expect(grace).toMatchObject({ isDefault: true });
  });
});
