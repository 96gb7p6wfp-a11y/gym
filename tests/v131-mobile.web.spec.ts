import { expect, test, type Page, type Locator } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan';

async function reachable(page: Page, action: Locator) {
  await expect(action).toBeVisible();
  const button = (await action.boundingBox())!;
  const tabs = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
  expect(button.height).toBeGreaterThanOrEqual(44);
  expect(button.y).toBeGreaterThanOrEqual(47);
  expect(button.y + button.height).toBeLessThanOrEqual(tabs.y);
  expect(await action.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [bounds.top + 2, bounds.bottom - 2].every(y => {
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, y);
      return target !== null && element.contains(target);
    });
  })).toBe(true);
}

for (const appearance of ['light', 'dark'] as const) test(`V13.1 workout actions stay reachable on a small iPhone in ${appearance}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install({ time: new Date('2026-11-02T11:00:00Z') });
  await page.goto('/');
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance,
    plan: createVolleyballMasterPlan(), masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [],
      clearance: { impact: 'cleared', heavyLifting: 'cleared' } },
  });
  await page.evaluate(profile => localStorage.setItem('setline.gym.v1', JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
  })), profile);
  await page.reload();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  await reachable(page, page.getByRole('button', { name: 'Start workout', exact: true }));
  await page.screenshot({ path: info.outputPath('today.png') });
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  for (const weekday of ['Mon', 'Wed', 'Thu', 'Sat']) {
    await page.getByRole('button', { name: new RegExp(`^${weekday} `) }).click();
    await reachable(page, page.getByRole('button', { name: 'Start workout', exact: true }));
    await reachable(page, page.getByRole('button', { name: 'View workout', exact: true }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`${weekday.toLowerCase()}.png`) });
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('setline.gym.v1')!).sessions)).toEqual([]);
});
