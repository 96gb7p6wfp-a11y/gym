import { defineConfig } from '@playwright/test';
import { DEFAULT_PROFILE } from './src/domain.js';
import { defaultReminderState } from './src/reminders';

export default defineConfig({
  testDir: './tests',
  testMatch: ['web.spec.ts', '*.web.spec.ts'],
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Existing V15 regression cases exercise an established installation. Fresh
    // V16 onboarding cases explicitly opt into an empty storageState.
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:4173', localStorage: [{
      name: 'setline.gym.v1', value: JSON.stringify({ schemaVersion: 1, profile: DEFAULT_PROFILE,
        profileVersion: 0, sessions: [], nutrition: [], activities: [], reminders: defaultReminderState() }),
    }] }] },
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'en-GB',
    timezoneId: 'Europe/Berlin',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-web.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
