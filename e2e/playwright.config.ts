import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for DSVTT E2E tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',

  /* Run tests sequentially in CI, parallel locally */
  fullyParallel: !process.env.CI,

  /* Fail the build on CI if test.only is left in the source */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests — more retries in CI */
  retries: process.env.CI ? 2 : 0,

  /* Limit parallel workers in CI to avoid resource contention */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter configuration */
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['html', { open: 'on-failure' }]],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  /* Browser projects — Chromium only for Sprint 1 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Start the dev server before running tests (local only) */
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm --filter @dsvtt/web dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
