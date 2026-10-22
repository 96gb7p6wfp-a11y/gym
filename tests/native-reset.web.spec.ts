import { openSection, finishWarmup } from './helpers/navigation';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const TODAY = '2026-10-15';
const screens = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

async function safeAreas(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

async function tab(page: Page, name: string) {
  await openSection(page, name);
}

async function unobscured(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect.poll(() => control.evaluate(element => {
    const b = element.getBoundingClientRect();
    return b.width >= 44 && b.height >= 44 && [b.top + 2, b.top + b.height / 2, b.bottom - 2].every(y => {
      const hit = document.elementFromPoint(b.left + b.width / 2, y);
      return hit !== null && element.contains(hit);
    });
  })).toBe(true);
}

async function read(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.evaluate(({ key, profile, appearance }) => {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null') ?? {
      schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [],
    };
    data.profile.appearance = appearance;
    localStorage.setItem(key, JSON.stringify(data));
  }, { key: STORE, profile: DEFAULT_PROFILE, appearance });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', appearance);
  await safeAreas(page);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

for (const appearance of ['light', 'dark'] as const) {
  for (const screen of screens) {
    test(`native pages fit ${screen.width}px in ${appearance} with reachable training and safe floating tabs`, async ({ page }) => {
      await page.setViewportSize(screen);
      await seed(page, appearance);
      const nav = page.getByRole('tablist', { name: 'Main navigation', exact: true });
      await expect(nav.getByRole('tab')).toHaveCount(4);
      const bounds = (await nav.boundingBox())!;
      // The pill floats above the home indicator rather than extending the
      // touch surface into it. Keep both horizontal gutters clear as well.
      expect(bounds.x).toBeGreaterThanOrEqual(14);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(screen.width - 14);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(screen.height - 34 - 12);
      expect(await nav.evaluate(element => parseFloat(getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThanOrEqual(24);
      for (const item of await nav.getByRole('tab').all()) await unobscured(item);
      for (const action of [
        page.getByRole('button', { name: 'Start workout', exact: true }),
        page.getByRole('button', { name: /^View training progress:/ }),
      ]) {
        const box = (await action.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(47);
        expect(box.y + box.height).toBeLessThanOrEqual(bounds.y);
        await unobscured(action);
      }
      for (const name of ['Train', 'Progress', 'Nutrition', 'You', 'Today']) {
        await tab(page, name);
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (name === 'Train') {
          const start = page.getByRole('button', { name: 'Start workout', exact: true });
          const box = (await start.boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(bounds.y);
          await unobscured(start);
        }
      }
    });
  }
}

test('floating tabs stay clear of both landscape notches and the home indicator', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  for (const appearance of ['light', 'dark'] as const) {
    await seed(page, appearance);
    await page.evaluate(() => {
      for (const [side, value] of Object.entries({ top: 0, bottom: 21, left: 59, right: 59 })) {
        document.documentElement.style.setProperty(`--app-safe-area-${side}`, `${value}px`);
      }
    });
    const nav = page.getByRole('tablist', { name: 'Main navigation', exact: true });
    const bounds = (await nav.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(59 + 14);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(844 - 59 - 14);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(390 - 21 - 12);
    for (const item of await nav.getByRole('tab').all()) await unobscured(item);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('You offers a read-only searchable library and Back restores the query without modifying data', async ({ page }) => {
  const before = await read(page);
  await tab(page, 'More');
  await page.getByRole('button', { name: 'Exercise library', exact: true }).click();
  const sheet = page.locator('.exercise-library-sheet');
  const search = sheet.getByRole('searchbox', { name: 'Search exercises', exact: true });
  await search.fill('Hack');
  await sheet.getByRole('group', { name: 'Exercise categories', exact: true }).getByRole('button', { name: 'Strength', exact: true }).click();
  await expect(sheet.locator('.exercise-library__filters')).toBeHidden();
  await sheet.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Filters', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await sheet.locator('summary').filter({ hasText: /^Equipment/ }).click();
  await sheet.getByRole('group', { name: 'Filter by equipment', exact: true }).getByRole('button', { name: 'Machine', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Filters, 1 active', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'View Hack Squat', exact: true }).click();
  await expect(sheet.getByRole('heading', { name: 'Hack Squat', exact: true })).toBeVisible();
  await expect(sheet).toContainText('Quads');
  await expect(sheet.getByRole('button', { name: 'Add exercise', exact: true })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(search).toHaveValue('Hack');
  await expect(sheet.getByRole('button', { name: 'Filters, 1 active', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'View Hack Squat', exact: true })).toBeFocused();
  await sheet.getByRole('button', { name: 'View Hack Squat', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(sheet).not.toBeVisible();
  expect(await read(page)).toEqual(before);
});

test('Progress keeps one chart at a time and never mixes highest touch with jump height', async ({ page }) => {
  await seed(page, 'light');
  const jumps = [
    { id: '00000000-0000-4000-8000-000000000001', date: '2026-10-01', type: 'approach', measurement: 'height', cm: 65, notes: '' },
    { id: '00000000-0000-4000-8000-000000000002', date: TODAY, type: 'approach', measurement: 'height', cm: 67.5, notes: '' },
    { id: '00000000-0000-4000-8000-000000000003', date: '2026-10-01', type: 'approach', measurement: 'touch', cm: 305, notes: '' },
    { id: '00000000-0000-4000-8000-000000000004', date: TODAY, type: 'approach', measurement: 'touch', cm: 307.5, notes: '' },
  ];
  await page.evaluate(({ key, jumps }) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    data.performance = { jumps, readiness: [] };
    data.performanceVersion = 1;
    localStorage.setItem(key, JSON.stringify(data));
  }, { key: STORE, jumps });
  await page.reload();
  await tab(page, 'Progress');
  const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
  const metrics = page.getByRole('group', { name: 'Chart metric', exact: true });
  await expect(overview.getByRole('img')).toHaveCount(1);
  const jump = overview.getByRole('img', { name: /^Approach jump trend:/ });
  await expect(jump).toHaveAttribute('aria-label', /65 to 67\.5 centimetres/);
  await expect(overview.getByRole('region', { name: 'Jump performance', exact: true })).not.toContainText('307.5');
  await metrics.getByRole('button', { name: 'Weight', exact: true }).click();
  await expect(jump).not.toBeVisible();
  await expect(overview.getByRole('img')).toHaveCount(0);
  await metrics.getByRole('button', { name: 'Strength', exact: true }).click();
  await expect(overview.getByRole('img')).toHaveCount(0);
  await metrics.getByRole('button', { name: 'Jump', exact: true }).click();
  await expect(jump).toBeVisible();
  expect((await read(page)).performance.jumps).toEqual(jumps);
});

for (const appearance of ['light', 'dark'] as const) {
  test(`set completion and meal logging stay reachable above the rest timer in ${appearance}`, async ({ page }) => {
    await seed(page, appearance);
    await tab(page, 'Train');
    await page.getByRole('button', { name: /^Mon / }).click();
    await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
    const current = page.getByRole('region', { name: 'Current exercise', exact: true });
    const complete = current.getByRole('button', { name: 'Complete Medicine Ball Spike Slam set 1', exact: true });
    await current.getByRole('textbox', { name: 'Medicine Ball Spike Slam set 1 weight in kilograms', exact: true }).fill('12.5');
    await current.getByRole('spinbutton', { name: 'Medicine Ball Spike Slam set 1 reps', exact: true }).fill('4');
    await unobscured(complete);
    const nav = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
    const button = (await complete.boundingBox())!;
    expect(button.y + button.height).toBeLessThan(nav.y);
    await complete.tap();
    await expect(page.locator('.rest-floating')).toBeVisible();
    await tab(page, 'Nutrition');
    const log = page.getByRole('button', { name: 'Log meal', exact: true });
    await unobscured(log);
    await log.tap();
    const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
    await expect(meal).toBeVisible();
    await unobscured(meal.getByRole('button', { name: 'Close', exact: true }));
    const active = (await read(page)).sessions[0].session;
    expect(active.exercises[0].logs[0]).toMatchObject({ kg: 12.5, reps: 4, done: true });
    await page.reload();
    expect((await read(page)).sessions[0].session).toEqual(active);
  });
}
