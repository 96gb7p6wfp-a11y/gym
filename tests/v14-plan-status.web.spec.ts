import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createV81VolleyballMasterPlan, createVolleyballMasterPlan } from '../src/volleyball-master-plan';

const STORE = 'setline.gym.v1';

async function seed(page: Page, revision?: '8.1' | '13.1', startDate = '2026-10-05') {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    ...(revision ? { plan: revision === '13.1' ? createVolleyballMasterPlan() : createV81VolleyballMasterPlan(),
      masterProgram: { version: 1, revision, startDate, matchWeeks: [] },
      masterProgramBackup: { savedAt: 1, plan: structuredClone(DEFAULT_PROFILE.plan),
        masterProgram: { version: 1, revision: '8.1', startDate: '2026-09-07', matchWeeks: [] } },
    } : {}),
  });
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 2, sessions: [], nutrition: [], activities: [],
  })), { key: STORE, profile });
  await page.reload();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T11:00:00Z') });
  await page.goto('/');
});

test('V14 names the saved plan separately and opening training keeps the older prescription', async ({ page }) => {
  await seed(page, '8.1');
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  const status = page.getByRole('region', { name: 'Active training plan', exact: true });
  await expect(status).toContainText('Setline V14');
  await expect(status).toContainText('Plan · V8.1');
  await expect(status).toContainText('Week 5 of 8');
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(status).toContainText('Plan · V8.1');
  await expect(status).toContainText('Available to restore · V8.1');
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});

test('upcoming and completed blocks have clear status without silently starting a new block', async ({ page }) => {
  const status = page.getByRole('region', { name: 'Active training plan', exact: true });
  await seed(page, '13.1', '2026-11-09');
  await expect(status).toContainText('Upcoming · starts 2026-11-09');
  await seed(page, '13.1', '2026-08-03');
  await expect(status).toContainText('Block complete · saved weekly plan continues');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).profile.masterProgram.startDate, STORE)).toBe('2026-08-03');
});

test('original weekly plans retain their identity on a narrow iPhone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page);
  await expect(page.getByRole('region', { name: 'Active training plan', exact: true })).toContainText('Plan · Original weekly plan');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
