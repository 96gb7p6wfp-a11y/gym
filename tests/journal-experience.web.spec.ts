import { finishWarmup } from './helpers/navigation';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createVolleyballMasterPlan, MasterProgramSettingsSchema } from '../src/volleyball-master-plan';

const STORE = 'setline.gym.v1';
const WEDNESDAY = '2026-10-21';
const LONG_SESSION = 'Main Jump + Heavy Lower A';

const readStore = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seedJournal(page: Page, appearance: 'light' | 'dark', masterPlan = false) {
  const profile = ProfileSchema.parse({
    ...structuredClone(DEFAULT_PROFILE),
    appearance,
    ...(masterPlan ? {
      plan: createVolleyballMasterPlan(),
      preMasterPlan: structuredClone(DEFAULT_PROFILE.plan),
      masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
      masterProgram: MasterProgramSettingsSchema.parse({ version: 1, startDate: '2026-10-19', matchWeeks: [] }),
    } : {}),
  });
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
    performance: { jumps: [], readiness: [] }, performanceVersion: 1,
  })), { key: STORE, profile });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

/** Check the initial screen, without locator scrolling hiding a misplaced CTA. */
async function expectFirstScreenAction(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  const nav = page.getByRole('tablist', { name: 'Main navigation', exact: true });
  const navBounds = (await nav.boundingBox())!;
  const box = (await control.boundingBox())!;
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.y).toBeGreaterThanOrEqual(47);
  expect(box.y + box.height).toBeLessThanOrEqual(navBounds.y);
  expect(await control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return [bounds.top + 2, bounds.top + bounds.height / 2, bounds.bottom - 2].every(y => {
      const target = document.elementFromPoint(bounds.left + bounds.width / 2, y);
      return target !== null && element.contains(target);
    });
  }), 'The action must receive touches above the tab bar').toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install({ time: new Date(`${WEDNESDAY}T10:00:00Z`) });
  await page.goto('/');
});

for (const appearance of ['light', 'dark'] as const) {
  test(`a long Wednesday master-plan session keeps Today and Train actions above the tabs in ${appearance}`, async ({ page }) => {
    await seedJournal(page, appearance, true);
    const before = await readStore(page);
    const cover = page.getByRole('region', { name: 'Your day', exact: true });
    await expect(cover.getByRole('heading', { name: LONG_SESSION, exact: true })).toBeVisible();
    await expect(cover).toContainText('Approach height + maximal force');
    await expectFirstScreenAction(page, cover.getByRole('button', { name: 'Start workout', exact: true }));
    await expectFirstScreenAction(page, page.getByRole('button', {
      name: 'View training progress: 0 of 4 planned gym days recorded', exact: true,
    }));

    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.getByRole('heading', { name: LONG_SESSION, exact: true })).toBeVisible();
    await expectFirstScreenAction(page, page.getByRole('button', { name: 'Start workout', exact: true }));
    await expect(page.getByRole('tablist', { name: 'Main navigation', exact: true }).getByRole('tab')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await readStore(page), 'Previewing the master plan must preserve the saved programme and records').toEqual(before);

    await page.reload();
    expect(await readStore(page)).toEqual(before);
    await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText(LONG_SESSION);

    // Replacing the overview must not let browser scroll anchoring hide the
    // first exercise or its controls behind the status bar on a short phone.
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await page.getByRole('button', { name: /^Mon / }).click();
    await page.getByRole('button', { name: 'Start workout', exact: true }).tap();
  await finishWarmup(page);
    const current = page.getByRole('region', { name: 'Current exercise', exact: true });
    const heading = current.getByRole('heading', { level: 2 });
    await expect(heading).toBeVisible();
    await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(47);
    expect((await readStore(page)).sessions[0].session.status).toBe('active');
  });

  test(`empty Progress offers one real jump entry action and no invented measurement in ${appearance}`, async ({ page }) => {
    await seedJournal(page, appearance);
    const before = await readStore(page);
    await page.getByRole('tab', { name: 'Progress', exact: true }).click();
    const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
    const jump = overview.getByRole('region', { name: 'Jump performance', exact: true });
    await expect(jump).toContainText('Your first jump.');
    await expect(jump).not.toContainText(/\d+(?:[.,]\d+)?\s*cm/);
    await expect(overview.getByRole('img')).toHaveCount(0);
    const logJump = page.getByRole('button', { name: 'Log jump', exact: true });
    await expect(logJump).toHaveCount(1);
    await expectFirstScreenAction(page, logJump);
    await logJump.tap();

    const entry = page.getByRole('dialog', { name: 'Log jump', exact: true });
    await expect(entry).toBeVisible();
    await expect(entry.getByRole('textbox', { name: 'Standing reach in centimetres', exact: true })).toHaveValue('');
    await expect(entry.getByRole('group', { name: 'Entry method', exact: true }).getByRole('button', { name: 'Reach + touch', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await entry.getByRole('button', { name: 'Other measurement', exact: true }).tap();
    await expect(entry.getByRole('textbox', { name: 'Jump height in centimetres', exact: true })).toHaveValue('');
    await expect(entry.getByRole('button', { name: 'Save jump', exact: true })).toBeVisible();
    await entry.getByRole('button', { name: 'Close', exact: true }).tap();
    expect(await readStore(page), 'Opening and dismissing entry must not create a test result').toEqual(before);

    await page.reload();
    await page.getByRole('tab', { name: 'Progress', exact: true }).click();
    await expect(jump).toContainText('Your first jump.');
    await expect(jump).not.toContainText(/\d+(?:[.,]\d+)?\s*cm/);
    await expect(overview.getByRole('img')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log jump', exact: true })).toHaveCount(1);
    expect(await readStore(page)).toEqual(before);
  });
}
