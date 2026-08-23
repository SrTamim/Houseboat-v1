import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config. Points at an already-running dev server rather than starting one
 * (`pnpm dev` is owned by the developer's terminal; two `next dev` instances
 * sharing .next corrupt each other's output).
 *
 * Run: start the backend and frontend, then `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});