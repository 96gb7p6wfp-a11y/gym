import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const MOVEMENT = 'Medicine Ball Spike Slam';

async function tab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function safeAreas(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

async function unobscured(control: Locator) {
  const bounds = await control.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(await control.evaluate(element => {
    const b = element.getBoundingClientRect();
    return [b.top + 2, b.top + b.height / 2, b.bottom - 2].every(y => {
      const hit = document.elementFromPoint(b.left + b.width / 2, y);
      return hit != null && element.contains(hit);
    });
  }), 'The whole action must remain tappable above fixed bars').toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-08T10:00:00Z') });
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

test('keeps the Today action immediately reachable on a short iPhone with safe areas', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await safeAreas(page);
  const start = page.getByRole('button', { name: 'Start workout', exact: true });
  await expect(start).toBeEnabled();
  await unobscured(start);
  const nav = await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox();
  const action = await start.boundingBox();
  expect(action!.y + action!.height).toBeLessThan(nav!.y);
  await start.tap();
  await expect(page.getByRole('tab', { name: 'Train', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  await expect(page.locator('.session-card h2')).toBeVisible();
});

test('completes a focused decimal set, carries only into empty sets and keeps actions above rest', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await safeAreas(page);
  await tab(page, 'Train');
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const exercise = page.getByRole('region', { name: 'Current exercise', exact: true });
  const weight = exercise.getByRole('textbox', { name: `${MOVEMENT} set 1 weight in kilograms`, exact: true });
  await weight.fill('');
  await weight.pressSequentially('12,5');
  await exercise.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true }).fill('4');
  await exercise.getByRole('button', { name: `Complete ${MOVEMENT} set 1`, exact: true }).tap();
  await expect(exercise.getByRole('textbox', { name: `${MOVEMENT} set 2 weight in kilograms`, exact: true })).toHaveValue('12.5');
  await expect(exercise.getByRole('spinbutton', { name: `${MOVEMENT} set 2 reps`, exact: true })).toHaveValue('4');
  await expect(page.locator('.rest-floating')).toBeVisible();
  const complete = exercise.getByRole('button', { name: `Complete ${MOVEMENT} set 2`, exact: true });
  await complete.scrollIntoViewIfNeeded();
  await unobscured(complete);
  const rest = await page.locator('.rest-floating').boundingBox();
  const action = await complete.boundingBox();
  expect(action!.y + action!.height).toBeLessThan(rest!.y);
  // A value typed into another set must survive automatic advancement.
  await exercise.getByRole('button', { name: `View ${MOVEMENT} set 3`, exact: true }).click();
  await exercise.getByRole('textbox', { name: `${MOVEMENT} set 3 weight in kilograms`, exact: true }).fill('15');
  await exercise.getByRole('spinbutton', { name: `${MOVEMENT} set 3 reps`, exact: true }).fill('3');
  await exercise.getByRole('button', { name: `View ${MOVEMENT} set 2`, exact: true }).click();
  await complete.click();
  await expect(exercise.getByRole('textbox', { name: `${MOVEMENT} set 3 weight in kilograms`, exact: true })).toHaveValue('15');
  await expect(exercise.getByRole('spinbutton', { name: `${MOVEMENT} set 3 reps`, exact: true })).toHaveValue('3');
  await page.reload();
  await tab(page, 'Train');
  await expect(exercise.getByRole('textbox', { name: `${MOVEMENT} set 3 weight in kilograms`, exact: true })).toHaveValue('15');
});

test('an invalid focused set stays current and cannot advance or save a completed set', async ({ page }) => {
  await tab(page, 'Train');
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const exercise = page.getByRole('region', { name: 'Current exercise', exact: true });
  await exercise.getByRole('textbox', { name: `${MOVEMENT} set 1 weight in kilograms`, exact: true }).fill('12..5');
  await exercise.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true }).fill('4');
  await exercise.getByRole('button', { name: `Complete ${MOVEMENT} set 1`, exact: true }).click();
  await expect(exercise.getByRole('textbox', { name: `${MOVEMENT} set 1 weight in kilograms`, exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(exercise.getByRole('textbox', { name: `${MOVEMENT} set 2 weight in kilograms`, exact: true })).toHaveCount(0);
  await expect.poll(() => page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!);
    return data.sessions[0]?.session.exercises[0].logs[0].done;
  }, STORE)).toBe(false);
});

test('reuses recent meals and saved foods as new records without changing the original meal', async ({ page }) => {
  await tab(page, 'Nutrition');
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await meal.getByLabel('Meal name', { exact: true }).fill('Oats breakfast');
  await meal.getByLabel('Food 1', { exact: true }).fill('Oats');
  await meal.getByLabel('Serving / portion', { exact: true }).fill('60 g');
  await meal.getByLabel('Calories · kcal', { exact: true }).fill('230');
  await meal.getByLabel('Protein · g', { exact: true }).fill('8');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(meal).not.toBeVisible();
  const original = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).nutrition.find((r: any) => r.payload.kind === 'meal'), STORE);
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  await meal.locator('summary').filter({ hasText: /^Recent meals$/ }).click();
  await meal.getByRole('button', { name: /Oats breakfast.*230 kcal/ }).click();
  await expect(meal.getByLabel('Food 1', { exact: true })).toHaveValue('Oats');
  await meal.getByLabel('Meal name', { exact: true }).fill('Second breakfast');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(meal).not.toBeVisible();
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  await meal.locator('summary').filter({ hasText: /^Saved foods$/ }).click();
  await meal.getByRole('button', { name: /Oats.*60 g.*230 kcal/ }).click();
  await expect(meal.getByLabel('Food 1', { exact: true })).toHaveValue('Oats');
  await meal.getByLabel('Meal name', { exact: true }).fill('Snack');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(meal).not.toBeVisible();
  const records = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).nutrition.filter((r: any) => r.payload.kind === 'meal'), STORE);
  expect(records).toHaveLength(3);
  expect(new Set(records.map((r: any) => r.id)).size).toBe(3);
  expect(records.find((r: any) => r.id === original.id)).toEqual(original);
  await expect(page.locator('.nutrition-daily__number strong')).toHaveText('690');
});

test('offers a one-tap progress check-in and charts only recorded body weights', async ({ page }) => {
  await tab(page, 'Progress');
  await expect(page.getByRole('img', { name: /^Body weight trend:/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  let check = page.getByRole('dialog', { name: 'Weight check-in', exact: true });
  await expect(check).toBeVisible();
  await check.getByLabel('Body weight · kg', { exact: true }).fill('64.2');
  await check.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(check.locator('.nutrition-weight-average')).toContainText('64.2 kg');
  await check.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Nutrition date', { exact: true }).fill('2026-10-07');
  await page.getByRole('button', { name: /^Weight check-in/ }).click();
  check = page.getByRole('dialog', { name: 'Weight check-in', exact: true });
  await check.getByLabel('Body weight · kg', { exact: true }).fill('64');
  await check.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(check.locator('.nutrition-weight-average')).toContainText('64.1 kg');
  await check.getByRole('button', { name: 'Close', exact: true }).click();
  await tab(page, 'Progress');
  await expect(page.getByRole('img', { name: 'Body weight trend: 64 to 64.2 kilograms across 2 check-ins', exact: true })).toBeVisible();
  await expect(page.locator('.progress-weight-caption')).toContainText('+0.2 kg across 2 recent check-ins');
});

test('imports directly from More and keeps activity totals synchronized with the report week', async ({ page }) => {
  await tab(page, 'More');
  await page.getByRole('button', { name: 'Import activities', exact: true }).click();
  const importer = page.getByRole('dialog', { name: 'Import activities', exact: true });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await importer.getByLabel('Activity files', { exact: true }).setInputFiles({
    name: 'strava.csv', mimeType: 'text/csv', buffer: Buffer.from('Activity ID,Activity Date,Activity Name,Activity Type,Moving Time,Distance\n91,2026-10-05T08:00:00Z,Monday run,Run,1800,5\n'),
  });
  await importer.getByRole('button', { name: 'Import 1 selected activity', exact: true }).click();
  await expect(importer).not.toBeVisible();
  await tab(page, 'Progress');
  await page.getByRole('button', { name: 'Your week', exact: true }).click();
  await page.locator('.report-activity-details > summary').click();
  const totals = page.getByRole('region', { name: 'Extra activity progress', exact: true });
  await expect(totals).toContainText('1 extra activities');
  await page.getByRole('button', { name: 'Previous report week', exact: true }).click();
  await expect(totals).toContainText('0 extra activities');
  await expect(totals).toContainText('28 Sept – 4 Oct');
  await page.getByRole('button', { name: 'Next report week', exact: true }).click();
  await expect(totals).toContainText('1 extra activities');
});

test('editing a saved timed workout cannot start timers or change a separate active session', async ({ page }) => {
  const active = stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0], 0, '2026-10-05', DEFAULT_PROFILE, []), 'active');
  const historical = stopSessionTimers(createSession(DEFAULT_PROFILE.plan[1], 1, '2026-10-06', DEFAULT_PROFILE, []), 'completed');
  await page.evaluate(({ active, historical, profile, key }) => {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: active, version: 1 }, { session: historical, version: 1 }], nutrition: [], activities: [] }));
  }, { active, historical, profile: DEFAULT_PROFILE, key: STORE });
  await page.reload();
  await tab(page, 'Progress');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await page.getByRole('button', { name: /^Volleyball / }).filter({ has: page.getByRole('heading', { name: 'Volleyball', exact: true }) }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit this log', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done editing', exact: true })).toBeVisible();
  const exercise = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(exercise.getByRole('button', { name: /^Start timer for/ })).toHaveCount(0);
  await exercise.getByRole('spinbutton', { name: 'Volleyball practice set 1 minutes', exact: true }).fill('122');
  await exercise.getByRole('button', { name: 'Complete Volleyball practice set 1', exact: true }).click();
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).sessions.find((r: any) => r.session.id === id).session.exercises[0].logs[0].seconds, { key: STORE, id: historical.id })).toBe(7320);
  expect(await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).sessions.find((r: any) => r.session.id === id), { key: STORE, id: active.id })).toEqual({ session: active, version: 1 });
});

test('a changed zinc instruction cannot retain a dose in its display name', async ({ page }) => {
  await tab(page, 'More');
  await page.getByRole('button', { name: 'Routine', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Mivolis zinc reminder', exact: true }).click();
  const form = page.getByRole('form', { name: 'Reminder form', exact: true });
  await form.getByLabel('Dosage text', { exact: true }).fill('Updated label dose');
  await form.getByLabel('Label or prescribed instructions', { exact: true }).fill('Follow my updated label.');
  await expect(form.getByRole('checkbox', { name: 'I verified these instructions and once-daily frequency from my label or prescription.', exact: true })).not.toBeChecked();
  await form.getByRole('button', { name: 'Save reminder', exact: true }).click();
  await expect(form).not.toBeVisible();
  const manage = page.locator('.reminder-panel__manage');
  await manage.locator(':scope > summary').click();
  const zinc = manage.locator('li').filter({ has: page.getByRole('button', { name: 'Edit Mivolis zinc reminder', exact: true }) });
  await expect(zinc.locator('.reminder-panel__name strong')).toHaveText('Zinc');
  await expect(zinc).toContainText('Updated label dose');
  await expect(zinc).not.toContainText('15 mg');
  await expect(page.getByRole('button', { name: 'Mark Mivolis zinc taken', exact: true })).toHaveCount(0);
});

test('keeps all views contained and readable on desktop and narrow phones', async ({ page }) => {
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['Today', 'Train', 'Progress', 'Nutrition', 'More']) {
      await tab(page, name);
      await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('data-state', 'active');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${name} at ${width}px`).toBe(true);
      for (const input of await page.locator('input:visible').all()) {
        expect(await input.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
      }
    }
  }
});
