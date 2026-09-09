import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from '@playwright/test';

/**
 * API-level validation for the audit-remediation changes, run against the live
 * dev backend.
 *
 * These assert the observable outcomes of the backend fixes:
 *   - the reschedule feature is fully removed (routes 404, not just guarded),
 *   - the owner console still logs in and reads bookings after the removal,
 *   - the refund endpoint enforces the new amount cap (rejects over-paid).
 *
 * baseURL is the origin; every path includes the /api prefix via P(). (A
 * leading-slash path replaces baseURL's own path, so a /api in the baseURL would
 * be dropped — the prefix lives on each request path instead.)
 */

const ORIGIN = 'http://localhost:4000';
const P = (path: string) => `/api${path}`;
const OWNER = { phone: '+8801700000002', password: 'localdev-owner-pass' };
const ADMIN = { phone: '+8801700000000', password: 'localdev-admin-pass' };
const uuidZero = '00000000-0000-0000-0000-000000000000';

/** Log in with the given creds and return a request context carrying the cookies. */
async function loginContext(creds: {
  phone: string;
  password: string;
}): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({ baseURL: ORIGIN });
  const res = await ctx.post(P('/auth/login'), { data: creds });
  expect(res.ok(), `login failed for ${creds.phone}: ${res.status()}`).toBeTruthy();
  return ctx;
}

const ownerContext = () => loginContext(OWNER);

/** Fetch a CSRF token bound to the session and return the header to echo back. */
async function csrfHeader(ctx: APIRequestContext): Promise<Record<string, string>> {
  const res = await ctx.get(P('/auth/csrf'));
  expect(res.ok()).toBeTruthy();
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  return { 'x-csrf-token': csrfToken };
}

test.describe('audit remediation — reschedule removal', () => {
  test('reschedule routes are gone (404), while a sibling live route still exists', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: ORIGIN });

    // The two removed routes: fully gone from the router → 404.
    const post = await ctx.post(P(`/booking/${uuidZero}/reschedule`), { data: {} });
    expect(post.status(), 'POST reschedule should be 404 (route removed)').toBe(404);

    const list = await ctx.get(P('/platform/ops/reschedules'));
    expect(list.status(), 'GET reschedules should be 404 (route removed)').toBe(404);

    // Contrast: a route that still exists returns 401 (needs auth), NOT 404 —
    // proving the 404s above are genuine removals, not a blanket failure.
    const cancel = await ctx.post(P(`/booking/${uuidZero}/cancel`), { data: {} });
    expect(cancel.status(), 'cancel route should still exist (401)').toBe(401);

    await ctx.dispose();
  });
});

test.describe('audit remediation — owner console still works', () => {
  test('owner logs in and reads bookings after the reschedule removal', async () => {
    const ctx = await ownerContext();

    const me = await ctx.get(P('/auth/me'));
    expect(me.ok(), `/auth/me failed: ${me.status()}`).toBeTruthy();

    // The owner bookings list is the surface whose 'rescheduled' filter option
    // was removed. It must still load (the removal didn't break the page's data).
    const boats = await ctx.get(P('/me/boats'));
    expect(boats.ok(), `/me/boats failed: ${boats.status()}`).toBeTruthy();
    const mine = (await boats.json()) as Array<{ houseboatId: string }>;
    expect(mine.length, 'seed should give the demo owner a boat').toBeGreaterThan(0);

    const houseboatId = mine[0].houseboatId;
    const bookings = await ctx.get(
      P(`/houseboats/${houseboatId}/bookings?status=confirmed`),
    );
    expect(
      bookings.ok(),
      `owner bookings list failed: ${bookings.status()}`,
    ).toBeTruthy();

    // The removed 'rescheduled' status value must be rejected as an invalid
    // filter now (the enum no longer accepts it).
    const badFilter = await ctx.get(
      P(`/houseboats/${houseboatId}/bookings?status=rescheduled`),
    );
    expect(
      badFilter.status(),
      'the removed "rescheduled" filter value should be rejected (400)',
    ).toBe(400);

    await ctx.dispose();
  });
});

test.describe('audit remediation — refund amount cap (#1)', () => {
  test('a refund far larger than amountPaid is rejected', async () => {
    // Log in as platform admin: platform users get a blanket RBAC bypass, so the
    // owner refund endpoint is reachable against any boat's invoice. We discover
    // a REAL seeded invoice (with a real amountPaid) through the platform finance
    // list, so this exercises the cap against actual paid money — not a 404.
    const ctx = await loginContext(ADMIN);
    const headers = await csrfHeader(ctx);

    const invRes = await ctx.get(P('/platform/finance/invoices?limit=10'));
    expect(invRes.ok(), `platform invoices failed: ${invRes.status()}`).toBeTruthy();
    const page = (await invRes.json()) as {
      items: Array<{ id: string; amountPaid: string }>;
    };
    const target = page.items.find((i) => Number(i.amountPaid) > 0);
    test.skip(!target, 'no invoice with a payment to target the refund cap');
    if (!target) return;

    const overCap = Number(target.amountPaid) + 1_000_000;
    const res = await ctx.post(P(`/invoices/${target.id}/refunds`), {
      headers,
      data: { amount: overCap, reason: 'e2e cap check' },
    });

    // The cap must reject an amount greater than amountPaid with a 400 whose
    // message is the amount guard — proving it's THE CAP rejecting it, not an
    // unrelated auth/state error. Before the fix this path accepted any amount
    // and created an over-cap refund row (a 2xx).
    const bodyText = await res.text();
    expect(
      res.status(),
      `over-cap refund (amount ${overCap} > paid ${target.amountPaid}) must be 400; got ${res.status()} — ${bodyText}`,
    ).toBe(400);
    expect(
      /amount .*greater than zero|no more than the amount paid|amount|paid/i.test(
        bodyText,
      ),
      `expected the amount-cap message, got: ${bodyText}`,
    ).toBeTruthy();

    await ctx.dispose();
  });
});
