import { expandLegacyPermissions } from './rbac.service';
import { FULL_PERMISSIONS } from './permission.types';

/**
 * The resolver must expand pre-migration legacy roles to pages while leaving
 * page-shaped roles (migrated / authored by the team UI) exactly as stored —
 * including roles built purely from the six keys that double as page names.
 */
describe('expandLegacyPermissions', () => {
  it('returns {} for null/undefined/empty', () => {
    expect(expandLegacyPermissions(null)).toEqual({});
    expect(expandLegacyPermissions(undefined)).toEqual({});
    expect(expandLegacyPermissions({})).toEqual({});
  });

  it('expands a legacy-only role (money) to its pages', () => {
    const out = expandLegacyPermissions({ money: { view: true, edit: true } });
    expect(out).toEqual({
      refunds: { view: true, edit: true },
      payouts: { view: true, edit: true },
      earnings: { view: true, edit: true },
      billing: { view: true, edit: true },
    });
    // The legacy key itself is gone.
    expect((out as Record<string, unknown>).money).toBeUndefined();
  });

  it('expands the seeded crew role {bookings, trips} — has legacy-only trips', () => {
    const out = expandLegacyPermissions({
      bookings: { view: true },
      trips: { view: true },
    });
    // trips is legacy-only → whole map is legacy → both expand.
    expect(out.pos).toEqual({ view: true, edit: false });
    expect(out.packages).toEqual({ view: true, edit: false });
    expect(out.schedule).toEqual({ view: true, edit: false });
    expect(out.guests).toEqual({ view: true, edit: false });
  });

  it('leaves a page-shaped role with a page-only key untouched', () => {
    const role = { bookings: { view: true, edit: false }, pos: { view: true, edit: true } };
    // pos is page-only → page-shaped → no expansion; bookings stays just bookings.
    expect(expandLegacyPermissions(role)).toEqual(role);
  });

  it('does NOT over-expand an overlap-only page role ({bookings})', () => {
    // A team-UI role granting only the Bookings page. No legacy-only key present,
    // so it is treated as page-shaped and must stay exactly {bookings}.
    const role = { bookings: { view: true, edit: false } };
    expect(expandLegacyPermissions(role)).toEqual(role);
  });

  it('does NOT over-expand {pricing, settings} (both overlap keys, page-shaped)', () => {
    const role = {
      pricing: { view: true, edit: true },
      settings: { view: true, edit: false },
    };
    expect(expandLegacyPermissions(role)).toEqual(role);
  });

  it('is a no-op on FULL_PERMISSIONS (already 29 page keys)', () => {
    expect(expandLegacyPermissions(FULL_PERMISSIONS)).toEqual(FULL_PERMISSIONS);
  });

  it('ORs a legacy key onto a page, keeping the stronger grant', () => {
    // assets → profile+cabins+maintenance; here assets grants view only.
    const out = expandLegacyPermissions({ assets: { view: true, edit: false } });
    expect(out.profile).toEqual({ view: true, edit: false });
    expect(out.cabins).toEqual({ view: true, edit: false });
    expect(out.maintenance).toEqual({ view: true, edit: false });
  });
});
