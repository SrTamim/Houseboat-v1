import { test, expect, type Page } from '@playwright/test';

/**
 * Customer auth modal: login, register, and error handling.
 *
 * Regression cover for the page→modal conversion. The bug these exist for: the
 * CSRF token is bound to hb_sid, login rotates hb_sid, and the old login PAGE
 * hid a stale-token bug behind its hard navigation. The modal keeps the JS
 * module alive, so a token minted before login survives and 403s the next
 * mutating request. See refreshCsrfToken() in lib/api.ts.
 */

const PASSWORD = 'TestPass12345';

/** Unique BD mobile per run so registration never collides with a prior run. */
function newPhone(): string {
  const n = String(Date.now()).slice(-8);
  return `017${n}`;
}

async function openModal(page: Page, which: 'Login' | 'Register') {
  const trigger = page.getByRole('button', { name: which, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  // Generous: against a dev server the first click can land while the route is
  // still compiling and hydration has not attached the handler yet.
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 });
}

/**
 * Wait for hydration before interacting. Without this the first spec of a run
 * races the dev server's on-demand compile and clicks a dead button.
 */
async function gotoReady(page: Page, path = '/') {
  await page.goto(path);
  await expect(
    page.getByRole('button', { name: 'Login', exact: true }).or(
      page.getByRole('link', { name: /Account|👤/ }),
    ).first(),
  ).toBeVisible({ timeout: 30_000 });
}

test.describe('auth modal', () => {
  test('registers a new account and confirms it', async ({ page }) => {
    const phone = newPhone();
    await gotoReady(page);
    await openModal(page, 'Register');

    await page.locator('#auth-name').fill('Playwright Guest');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/ }).click();

    // The confirmation the user reported as missing.
    await expect(page.getByText('Account created')).toBeVisible();

    // …then it hands off and the nav reflects the new session.
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    await expect(
      page.getByRole('link', { name: /Playwright|Account/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('logs in an existing account', async ({ page }) => {
    // Arrange: make an account through the UI, then sign out of it.
    const phone = newPhone();
    await gotoReady(page);
    await openModal(page, 'Register');
    await page.locator('#auth-name').fill('Returning Guest');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    await page.context().clearCookies();
    await gotoReady(page);

    // Act
    await openModal(page, 'Login');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Log in/ }).click();

    // Assert: signed in, no navigation away.
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
    await expect(
      page.getByRole('link', { name: /Returning|Account/ }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('login survives a warmed CSRF cache', async ({ page }) => {
    // The CSRF token is bound to hb_sid, and login rotates hb_sid — so a token
    // cached before signing in is dead afterwards (verified against the API:
    // reusing it returns 403 "invalid csrf token").
    //
    // In the browser this is currently masked, because clearing the cache lets
    // the request interceptor re-fetch lazily before the next mutation. That
    // makes it a latent ordering hazard rather than a live break, and this test
    // pins the safe behaviour so a future change to the interceptor's timing
    // cannot reintroduce it silently.
    const phone = newPhone();
    await gotoReady(page);
    await openModal(page, 'Register');
    await page.locator('#auth-name').fill('Warm Cache');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    await page.context().clearCookies();
    await gotoReady(page);

    // Warm the module-level token cache against the ANONYMOUS session, the way
    // a real visitor does — a failed sign-in is a mutating call through the
    // app's own axios instance, so the interceptor caches a token bound to the
    // pre-login hb_sid. A raw page.evaluate(fetch) would NOT do this: it never
    // touches the module variable that holds the bug.
    await openModal(page, 'Login');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill('wrong-on-purpose');
    await page.getByRole('button', { name: /Log in/ }).click();
    await expect(page.getByText(/Invalid phone or password/i)).toBeVisible({
      timeout: 10_000,
    });

    // Now sign in for real, reusing that warmed cache.
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Log in/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    // Assert through the APP's own axios module WITHOUT a full page load. A
    // page.goto() here would re-evaluate the bundle and reset the module-level
    // csrfToken, curing the very bug under test — the buggy build passes if you
    // navigate. Client-side nav keeps the module (and any stale token) alive.
    await page.getByRole('link', { name: /Warm|Account/ }).first().click();
    const signOut = page.getByRole('button', { name: /Sign out/i });
    await expect(signOut).toBeVisible({ timeout: 20_000 });

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/auth/logout') && r.request().method() === 'POST',
        { timeout: 15_000 },
      ),
      signOut.click(),
    ]);

    expect(response.status(), 'post-login mutation must not 403').not.toBe(403);
  });

  test('shows an error for a wrong password and keeps the modal open', async ({
    page,
  }) => {
    const phone = newPhone();
    await gotoReady(page);
    await openModal(page, 'Register');
    await page.locator('#auth-name').fill('Bad Password');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    await page.context().clearCookies();
    await gotoReady(page);

    await openModal(page, 'Login');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /Log in/ }).click();

    await expect(page.getByText(/Invalid phone or password|credentials/i)).toBeVisible({
      timeout: 10_000,
    });
    // Still open, input preserved — not navigated away.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#auth-phone')).toHaveValue(phone);
  });

  test('surfaces a duplicate-phone registration error', async ({ page }) => {
    const phone = newPhone();
    await gotoReady(page);
    await openModal(page, 'Register');
    await page.locator('#auth-name').fill('First Signup');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/ }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 10_000 });

    await page.context().clearCookies();
    await gotoReady(page);

    // Same number again → 409 from the backend, shown in the modal.
    await openModal(page, 'Register');
    await page.locator('#auth-name').fill('Second Signup');
    await page.locator('#auth-phone').fill(phone);
    await page.locator('#auth-password').fill(PASSWORD);
    await page.getByRole('button', { name: /Create account/ }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('blocks submission when required fields are empty', async ({ page }) => {
    await gotoReady(page);
    await openModal(page, 'Register');

    // Name and phone carry the native `required` attribute, so the browser
    // stops the submit before the JS handler runs. Assert the real mechanism
    // rather than a message the user never gets to see.
    await page.getByRole('button', { name: /Create account/ }).click();
    await expect(page.locator('#auth-name')).toHaveJSProperty(
      'validity.valueMissing',
      true,
    );
    // Still open — nothing was sent.
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('#auth-name').fill('Someone');
    await page.getByRole('button', { name: /Create account/ }).click();
    await expect(page.locator('#auth-phone')).toHaveJSProperty(
      'validity.valueMissing',
      true,
    );
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('rejects a too-short password with the JS message', async ({ page }) => {
    // Password has no native minlength (login accepts any length), so this
    // path does reach the handler's own validation.
    await gotoReady(page);
    await openModal(page, 'Register');
    await page.locator('#auth-name').fill('Short Pass');
    await page.locator('#auth-phone').fill(newPhone());
    await page.locator('#auth-password').fill('short');
    await page.getByRole('button', { name: /Create account/ }).click();

    await expect(page.getByText(/at least 8 characters/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});