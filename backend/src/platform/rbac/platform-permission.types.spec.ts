import { BadRequestException } from '@nestjs/common';
import {
  expandLegacyPlatformPermissions,
  validatePlatformPermissionMap,
} from './platform-permission.types';

describe('validatePlatformPermissionMap', () => {
  it('accepts a valid page-keyed map', () => {
    const map = {
      payouts: { view: true, edit: false },
      refunds: { view: true },
    };
    expect(validatePlatformPermissionMap(map)).toEqual(map);
  });

  it('still accepts legacy module keys (un-migrated roles stay editable)', () => {
    const map = { finance: { view: true, edit: false }, ops: { view: true } };
    expect(validatePlatformPermissionMap(map)).toEqual(map);
  });

  it('accepts an empty object (deny-all role)', () => {
    expect(validatePlatformPermissionMap({})).toEqual({});
  });

  it('rejects non-objects', () => {
    for (const bad of [null, 'x', 42, ['finance']]) {
      expect(() => validatePlatformPermissionMap(bad)).toThrow(
        BadRequestException,
      );
    }
  });

  it('rejects unknown pages loudly (typo must fail at write time)', () => {
    expect(() =>
      validatePlatformPermissionMap({ payoutz: { view: true } }),
    ).toThrow(BadRequestException);
  });

  it('rejects unknown actions', () => {
    expect(() =>
      validatePlatformPermissionMap({ payouts: { admin: true } }),
    ).toThrow(BadRequestException);
  });

  it('rejects non-boolean values', () => {
    expect(() =>
      validatePlatformPermissionMap({ payouts: { view: 'yes' } }),
    ).toThrow(BadRequestException);
  });
});

describe('expandLegacyPlatformPermissions', () => {
  it('passes page keys through unchanged (idempotent)', () => {
    const map = { payouts: { view: true, edit: true } };
    expect(expandLegacyPlatformPermissions(map)).toEqual({
      payouts: { view: true, edit: true },
    });
  });

  it('expands a legacy module to every page it authorized', () => {
    const out = expandLegacyPlatformPermissions({ ops: { view: true } });
    expect(out.bookings).toEqual({ view: true, edit: false });
    expect(out.reviews).toEqual({ view: true, edit: false });
    expect(out.waitlist).toEqual({ view: true, edit: false });
    expect(out.notifications).toEqual({ view: true, edit: false });
    expect(out.audit).toEqual({ view: true, edit: false });
    // finance pages must NOT be granted by an ops grant
    expect(out.payouts).toBeUndefined();
  });

  it('carries edit through the expansion (edit implies view)', () => {
    const out = expandLegacyPlatformPermissions({ finance: { edit: true } });
    expect(out.payouts).toEqual({ view: true, edit: true });
    expect(out.refunds).toEqual({ view: true, edit: true });
  });

  it('settings legacy module maps to the jobs page', () => {
    const out = expandLegacyPlatformPermissions({ settings: { edit: true } });
    expect(out.jobs).toEqual({ view: true, edit: true });
  });

  it('OR-merges when a page is reachable from a legacy key and a page key', () => {
    const out = expandLegacyPlatformPermissions({
      finance: { view: true },
      payouts: { edit: true },
    });
    expect(out.payouts).toEqual({ view: true, edit: true });
  });

  it('drops unknown keys and handles null/undefined', () => {
    expect(expandLegacyPlatformPermissions(null)).toEqual({});
    expect(expandLegacyPlatformPermissions(undefined)).toEqual({});
    expect(expandLegacyPlatformPermissions({ nonsense: { view: true } })).toEqual(
      {},
    );
  });
});
