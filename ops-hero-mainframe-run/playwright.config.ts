import { existsSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke test: boots the production preview server and asserts the game renders.
 *
 * Some sandboxed environments ship a Chromium build that does not match the revision this
 * Playwright version would download. CHROMIUM_PATH, or a detected pre-installed binary, is used
 * in preference to a download so the test can run without network access.
 */
const CANDIDATE_CHROMIUM = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter((candidate): candidate is string => Boolean(candidate) && existsSync(candidate as string));

const executablePath = CANDIDATE_CHROMIUM[0];

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // --no-sandbox is required when running as root in a container.
          args: ['--no-sandbox', '--disable-dev-shm-usage'],
          ...(executablePath ? { executablePath } : {}),
        },
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
