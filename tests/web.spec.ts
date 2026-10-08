import { readFile } from 'node:fs/promises';
import { Encoder, Profile, type FileIdMesg, type SessionMesg } from '@garmin/fitsdk';
import { expect, test, type Locator, type Page } from '@playwright/test';

const STORE_KEY = 'setline.gym.v1';
const MOVEMENT = 'Medicine Ball Spike Slam';
const SESSION = 'Upper Power + Muscle';
const requests = new WeakMap<Page, string[]>();
const runtimeErrors = new WeakMap<Page, string[]>();

async function selectTab(page: Page, name: string) {
  if (name === 'History') {
    await page.getByRole('tab', { name: 'Progress', exact: true }).click();
    await page.getByRole('button', { name: 'History', exact: true }).click();
    return;
  }
  if (name === 'My plan') {
    await page.getByRole('tab', { name: 'More', exact: true }).click();
    await page.getByRole('button', { name: 'Training plan', exact: true }).click();
    return;
  }
  await page.getByRole('tab', { name: name === 'Workout' ? 'Train' : name, exact: true }).click();
  if (name === 'Progress') await page.getByRole('button', { name: 'Strength', exact: true }).click();
}

async function openAllSets(page: Page) {
  const button = page.getByRole('button', { name: 'All sets', exact: true });
  if (await button.isVisible()) await button.click();
}

async function selectMovement(page: Page, movement: string) {
  await page.locator('summary').filter({ hasText: /^Movements/ }).click();
  await page.getByRole('button', { name: `Train ${movement}`, exact: true }).click();
  await openAllSets(page);
}

async function openFuel(page: Page) {
  const summary = page.locator('summary').filter({ hasText: /^Fuel & recovery$/ });
  if (!await summary.locator('..').evaluate(element => element.hasAttribute('open'))) await summary.click();
}

async function openTargets(page: Page) {
  await page.getByRole('button', { name: /^Targets/ }).click();
  return page.getByRole('dialog', { name: 'Daily targets', exact: true });
}

async function openWeight(page: Page) {
  await page.getByRole('button', { name: /^Weight check-in/ }).click();
  return page.getByRole('dialog', { name: 'Weight check-in', exact: true });
}

async function openReport(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Your week', exact: true }).click();
  const report = page.getByRole('region', { name: 'Weekly training report', exact: true });
  await report.locator(':scope > details > summary').click();
  return report;
}

async function openMealDetails(meal: Locator) {
  const summary = meal.locator('summary').filter({ hasText: /^Meal details$/ });
  if (!await summary.locator('..').evaluate(element => element.hasAttribute('open'))) await summary.click();
}

async function openActivities(page: Page) {
  await selectTab(page, 'Workout');
  const activities = page.locator('details').filter({ has: page.locator('summary').getByText('Activities', { exact: true }) });
  if (!await activities.evaluate(element => element.hasAttribute('open'))) await activities.locator(':scope > summary').click();
}

function mondayHistory(page: Page) {
  return page.getByRole('button', { name: /^Gym / }).filter({
    has: page.getByRole('heading', { name: SESSION, exact: true }),
  });
}

async function startMonday(page: Page) {
  await selectTab(page, 'Workout');
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  await openAllSets(page);
}

async function logWeightSet(page: Page, kilograms: string, reps: string, set = 1, movement = MOVEMENT) {
  await page.getByRole('textbox', { name: `${movement} set ${set} weight in kilograms`, exact: true }).fill(kilograms);
  await page.getByRole('spinbutton', { name: `${movement} set ${set} reps`, exact: true }).fill(reps);
  await page.getByRole('checkbox', { name: `Complete ${movement} set ${set}`, exact: true }).check();
}

async function finishWorkout(page: Page, minutes = '60', watchCalories?: string) {
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill(minutes);
  if (watchCalories !== undefined) {
    await finish.getByLabel('Active calories from your watch · optional', { exact: true }).fill(watchCalories);
  }
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  const summary = page.getByRole('dialog');
  await expect(summary).toContainText('Edit this log');
  return summary;
}

async function closeDialog(dialog: Locator) {
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function setSafeAreas(page: Page, top: number, bottom: number, left = 0, right = 0) {
  await page.evaluate(({ top, bottom, left, right }) => {
    for (const [side, value] of Object.entries({ top, bottom, left, right })) {
      document.documentElement.style.setProperty(`--app-safe-area-${side}`, `${value}px`);
    }
  }, { top, bottom, left, right });
}

async function verifyPinnedClose(page: Page, dialog: Locator, top: number, bottom: number, left = 0, right = 0) {
  const viewport = page.viewportSize()!;
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeVisible();
  await expect.poll(() => dialog.evaluate((element) =>
    element.getAnimations().filter((animation) => animation.playState === 'running').length,
  )).toBe(0);
  const bounds = await dialog.boundingBox();
  const before = await close.boundingBox();
  expect(bounds).not.toBeNull();
  expect(before).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(top + 15);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height - bottom - 15);
  expect(bounds!.x).toBeGreaterThanOrEqual(left + 15);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width - right - 15);
  expect(before!.width).toBeGreaterThanOrEqual(44);
  expect(before!.height).toBeGreaterThanOrEqual(44);
  const scroll = dialog.locator('[data-slot="dialog-scroll"]');
  await scroll.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const after = await close.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBeCloseTo(before!.y, 0);
  const point = { x: after!.x + after!.width / 2, y: after!.y + after!.height / 2 };
  expect(await close.evaluate((element, point) => {
    const target = document.elementFromPoint(point.x, point.y);
    return target !== null && element.contains(target);
  }, point)).toBe(true);
  // Tap its actual screen coordinates; locator.click() could hide a broken
  // layout by automatically scrolling an off-screen button back into view.
  await page.touchscreen.tap(point.x, point.y);
  await expect(dialog).not.toBeVisible();
}

async function waitForPersistedText(page: Page, text: string) {
  await expect.poll(() => page.evaluate(({ key, text }) => localStorage.getItem(key)?.includes(text) ?? false, {
    key: STORE_KEY, text,
  })).toBe(true);
}

async function openPreferences(page: Page) {
  await selectTab(page, 'More');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function currentMondayDate(page: Page) {
  return page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() - (date.getDay() + 6) % 7);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
}

async function openActivityImport(page: Page) {
  await openActivities(page);
  await page.getByRole('button', { name: 'Import activities', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import activities', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  const forbidden: string[] = [];
  const errors: string[] = [];
  requests.set(page, forbidden);
  runtimeErrors.set(page, errors);
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname.includes('chatgpt.site') || /^\/api\/(?:tracker|nutrition)(?:\/|$)/.test(url.pathname)) {
      forbidden.push(request.url());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(page.locator('iframe')).toHaveCount(0);
  await selectTab(page, 'Workout');
});

test.afterEach(async ({ page }) => {
  expect(requests.get(page), 'The app must not call the former host or its backend').toEqual([]);
  expect(runtimeErrors.get(page), 'The app must not throw browser runtime errors').toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('provides all five views and usable navigation at iPhone and narrow phone sizes', async ({ page }) => {
  const headings: Record<string, string> = {
    Today: '',
    Train: 'Train',
    Progress: 'Progress',
    Nutrition: 'Nutrition',
    More: 'More',
  };
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const [name, heading] of Object.entries(headings)) {
      const tab = page.getByRole('tab', { name, exact: true });
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      await tab.click();
      if (heading) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      else await expect(page.getByRole('tabpanel', { name: 'Today', exact: true })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    }
  }
  await selectTab(page, 'My plan');
  await page.locator('.plan-program > summary').click();
  await expect(page.getByRole('heading', { name: 'Your 8-week jump block', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit primer', exact: true })).toBeVisible();
});

test('validates sets, saves a complete workout, edits its log, and deletes and restores history', async ({ page }) => {
  await startMonday(page);
  const completed = page.getByRole('checkbox', { name: `Complete ${MOVEMENT} set 1`, exact: true });
  await completed.click();
  await expect(completed).not.toBeChecked();
  await expect(page.getByText('Enter your reps before checking off this set.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add set', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: `${MOVEMENT} set 5 reps`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: `Remove last set of ${MOVEMENT}`, exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: `${MOVEMENT} set 5 reps`, exact: true })).toHaveCount(0);
  await logWeightSet(page, '6', '4');
  await expect(completed).toBeChecked();
  await page.locator('.train-secondary > summary').filter({ hasText: /^Rest timer$/ }).click();
  await expect(page.getByRole('button', { name: 'Skip rest', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Time & RIR', exact: true }).click();
  await page.getByLabel('Time', { exact: true }).first().fill('45');
  await page.getByLabel('RIR', { exact: true }).first().fill('2');
  await page.locator('.workout-notes > details > summary').click();
  await page.getByLabel('Workout notes', { exact: true }).fill('Felt strong; keep the same setup.');
  const summary = await finishWorkout(page, '60', '350');
  await expect(summary).toContainText(/60\s*minutes/);
  await expect(summary).toContainText(/1\s*sets/);
  await expect(summary).toContainText(/24\s*kg volume/);
  await expect(summary).toContainText(/350\s*active kcal/);
  await expect(summary.getByRole('cell', { name: '6 kg', exact: true })).toBeVisible();
  await expect(summary.getByRole('cell', { name: '45s', exact: true })).toBeVisible();
  await expect(summary).toContainText('Felt strong; keep the same setup.');

  await summary.getByRole('button', { name: 'Edit this log', exact: true }).click();
  await selectMovement(page, MOVEMENT);
  await expect(page.getByText('EDITING SAVED WORKOUT', { exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true }).fill('5');
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await selectTab(page, 'History');
  const history = mondayHistory(page);
  await expect(history).toContainText('30 kg total volume');
  await page.reload();
  await selectTab(page, 'History');
  await expect(history).toContainText('30 kg total volume');
  await history.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete workout', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Delete this workout?', exact: true });
  await expect(confirmation).toContainText('You can restore it from Recently deleted.');
  await confirmation.getByRole('button', { name: 'Delete workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your first workout starts the story.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Recently deleted/ }).click();
  await expect(page.getByRole('button', { name: 'Restore', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(page.getByText('No deleted workouts.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(history).toContainText('30 kg total volume');
});

test('preserves a paused active workout across reload, resumes it, and cancels it safely', async ({ page }) => {
  await startMonday(page);
  await logWeightSet(page, '7', '4');
  await page.locator('.workout-notes > details > summary').click();
  await page.getByLabel('Workout notes', { exact: true }).fill('Paused session survives reload.');
  await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await waitForPersistedText(page, 'Paused session survives reload.');
  await page.reload();
  await selectTab(page, 'Workout');
  await openAllSets(page);
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: `${MOVEMENT} set 1 weight in kilograms`, exact: true })).toHaveValue('7');
  await expect(page.getByRole('checkbox', { name: `Complete ${MOVEMENT} set 1`, exact: true })).toBeChecked();
  await page.locator('.workout-notes > details > summary').click();
  await expect(page.getByLabel('Workout notes', { exact: true })).toHaveValue('Paused session survives reload.');
  await page.getByRole('button', { name: 'Resume workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause workout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard this workout', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Discard this workout?', exact: true });
  await confirmation.getByRole('button', { name: 'Keep workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Discard this workout', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  await page.reload();
  await selectTab(page, 'History');
  await expect(page.getByText('0 completed workouts', { exact: true })).toBeVisible();
  await selectTab(page, 'Workout');
  await openFuel(page);
  await expect(page.locator('[aria-label="Daily training total"] strong')).toHaveText(['0', '0']);
});

test('keeps the close button tappable while a tall Volleyball log scrolls in iPhone safe areas', async ({ page }) => {
  await page.getByRole('button', { name: /^Tue / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await closeDialog(await finishWorkout(page, '120'));
  const toastClose = page.getByRole('button', { name: 'Close toast', exact: true });
  if (await toastClose.isVisible()) await toastClose.click();
  await selectTab(page, 'History');
  const history = page.getByRole('button', { name: /^Volleyball / });
  for (const size of [
    { width: 390, height: 844, top: 59, bottom: 34, left: 0, right: 0 },
    { width: 844, height: 390, top: 0, bottom: 21, left: 59, right: 59 },
    { width: 320, height: 568, top: 20, bottom: 0, left: 0, right: 0 },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await setSafeAreas(page, size.top, size.bottom, size.left, size.right);
    await history.click();
    const summary = page.getByRole('dialog', { name: 'Volleyball', exact: true });
    await expect(summary).toContainText(/120\s*minutes/);
    await expect(summary).toContainText('Ankle Knee-to-Wall');
    await verifyPinnedClose(page, summary, size.top, size.bottom, size.left, size.right);
    await expect(history).toBeVisible();
  }
});

test('keeps long plan and meal forms dismissible after scrolling on a short phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await setSafeAreas(page, 59, 34);
  await selectTab(page, 'My plan');
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  await verifyPinnedClose(page, page.getByRole('dialog', { name: 'Edit Monday', exact: true }), 59, 34);
  await selectTab(page, 'Nutrition');
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  await verifyPinnedClose(page, page.getByRole('dialog', { name: 'Add a meal', exact: true }), 59, 34);
});

async function addExtraActivity(page: Page, type: string, minutes: string, distance?: string, intensity = 'moderate') {
  await openActivities(page);
  await page.getByRole('region', { name: 'Extra activities', exact: true }).getByRole('button', { name: 'Add activity', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add activity', exact: true });
  await dialog.getByLabel('Activity', { exact: true }).selectOption(type);
  await dialog.getByLabel('Duration · minutes', { exact: true }).fill(minutes);
  if (distance) await dialog.getByLabel('Distance · km · optional', { exact: true }).fill(distance);
  await dialog.getByLabel('Intensity', { exact: true }).selectOption(intensity);
  return dialog;
}

test('logs a five-kilometre run independently and includes it in history, progress and nutrition guidance', async ({ page }) => {
  await page.getByRole('button', { name: /^Sat / }).click();
  const run = await addExtraActivity(page, 'run', '30', '5', 'easy');
  const activityDate = await run.getByLabel('Activity date', { exact: true }).inputValue();
  await expect(run.locator('.extra-live-estimate')).toContainText('320 active kcal');
  await run.getByRole('button', { name: 'Save activity', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Extra activities', exact: true });
  await expect(panel.getByRole('article', { name: 'Running activity', exact: true })).toContainText('5 km');
  await expect(panel).toContainText('320 active kcal');
  const metrics = page.locator('.session-stats .stats-grid');
  await expect(metrics.locator('.stat').filter({ hasText: 'Active kcal' }).locator('strong')).toHaveText('320');
  await expect(metrics.locator('.stat').filter({ hasText: 'Minutes' }).locator('strong')).toHaveText('30');
  await expect(metrics.locator('.stat').filter({ hasText: 'Sets done' }).locator('strong')).toHaveText('0');
  const guidance = page.getByRole('region', { name: 'Training and nutrition guidance', exact: true });
  await openFuel(page);
  await guidance.locator('.guidance-advice > summary').click();
  await expect(guidance.getByRole('heading', { name: 'Training & recovery', exact: true })).toBeVisible();
  await expect(guidance).toContainText('Preserve your recovery day');
  await expect(guidance).toContainText('90–128 g/day');
  const savedPlan = await page.evaluate(() => JSON.parse(localStorage.getItem('setline.gym.v1')!).profile.plan);
  await page.reload();
  await selectTab(page, 'Workout');
  await page.getByRole('button', { name: /^Sat / }).click();
  await openActivities(page);
  await expect(panel).toContainText('320 active kcal');
  await selectTab(page, 'History');
  const history = page.getByRole('region', { name: 'Extra activity history', exact: true });
  await history.locator('summary').filter({ hasText: activityDate }).click();
  await expect(history).toContainText('Running');
  await history.getByRole('button', { name: 'Edit Running', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await edit.getByLabel('Distance · km · optional', { exact: true }).fill('6');
  await edit.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(history).toContainText('384 active kcal');
  await openReport(page);
  await page.locator('.report-activity-details > summary').click();
  await expect(page.getByRole('region', { name: 'Extra activity progress', exact: true })).toContainText('384');
  await selectTab(page, 'Nutrition');
  await page.getByLabel('Nutrition date', { exact: true }).fill(activityDate);
  await page.locator('.nutrition-simple-fuel > summary').click();
  await expect(guidance.locator('[aria-label="Daily training total"]')).toContainText('384');
  await expect(page.locator('.nutrition-totals')).toContainText('No target set');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('setline.gym.v1')!).profile.plan)).toEqual(savedPlan);
});

test('adds cycling to the saved workout date during editing and can delete and restore it', async ({ page }) => {
  await page.getByRole('button', { name: /^Tue / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const summary = await finishWorkout(page, '120');
  await summary.getByRole('button', { name: 'Edit this log', exact: true }).click();
  await expect(page.getByText('EDITING SAVED WORKOUT', { exact: true })).toBeVisible();
  await expect(page.locator('.session-card [role="progressbar"]')).toHaveCount(0);
  const cycle = await addExtraActivity(page, 'cycle', '45', '15');
  const date = await cycle.getByLabel('Activity date', { exact: true }).inputValue();
  expect(new Date(`${date}T12:00:00`).getDay()).toBe(2);
  await expect(cycle.locator('.extra-live-estimate')).toContainText('292 active kcal');
  await cycle.getByRole('button', { name: 'Save activity', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Extra activities', exact: true });
  await expect(panel).toContainText('292 active kcal');
  const guidance = page.getByRole('region', { name: 'Training and nutrition guidance', exact: true });
  await openFuel(page);
  await expect(guidance).toContainText('Volleyball already loads your legs');
  await expect(guidance).toContainText('165 minutes');
  await expect(guidance.locator('[aria-label="Daily training total"]')).toContainText('695');
  page.once('dialog', (dialog) => dialog.accept());
  await panel.getByRole('button', { name: 'Delete Cycling', exact: true }).click();
  await expect(panel.getByRole('article', { name: 'Cycling activity', exact: true })).toHaveCount(0);
  await expect(guidance.locator('[aria-label="Daily training total"]')).toContainText('403');
  await panel.locator('summary').filter({ hasText: 'Recently deleted activities' }).click();
  await panel.getByRole('button', { name: 'Restore Cycling', exact: true }).click();
  await expect(panel).toContainText('292 active kcal');
  await panel.getByRole('button', { name: 'Edit Cycling', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await edit.getByLabel('Watch active calories · optional', { exact: true }).fill('0');
  await edit.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(panel).toContainText('0 active kcal');
  await expect(panel).toContainText('Watch reading');
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await page.getByRole('button', { name: /^Wed / }).click();
  await expect(panel).toContainText('No extra activities logged for this date.');
});

test('logs and exports an extra activity offline without altering the recurring plan', async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.getByRole('button', { name: /^Mon / }).click();
  const walk = await addExtraActivity(page, 'walk', '20', undefined, 'easy');
  await walk.getByRole('button', { name: 'Save activity', exact: true }).click();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await selectTab(page, 'Workout');
  await page.getByRole('button', { name: /^Mon / }).click();
  await openActivities(page);
  await expect(page.getByRole('region', { name: 'Extra activities', exact: true })).toContainText('40 active kcal');
  const preferences = await openPreferences(page);
  const downloadPromise = page.waitForEvent('download');
  await preferences.getByRole('button', { name: 'Export backup', exact: true }).click();
  const backup = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
  expect(backup.data.activities).toHaveLength(1);
  expect(backup.data.activities[0].activity.type).toBe('walk');
  expect(backup.data.profile.plan).toHaveLength(7);
});

test('validates and persists editable day plans without changing an existing workout', async ({ page }) => {
  await startMonday(page);
  await selectTab(page, 'My plan');
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Monday', exact: true });
  await editor.getByLabel('Session name', { exact: true }).fill('');
  await editor.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(page.getByText('Check the names, sets, and numbers in your plan.', { exact: true })).toBeVisible();
  await editor.getByLabel('Session name', { exact: true }).fill('Custom strength');
  await editor.getByLabel('Movement', { exact: true }).first().fill('Custom press');
  await editor.getByLabel('Sets', { exact: true }).first().fill('2');
  await editor.getByLabel('Target', { exact: true }).first().fill('8 reps');
  await editor.getByLabel('Rest · sec', { exact: true }).first().fill('60');
  await editor.getByRole('button', { name: 'Remove Pallof Press', exact: true }).click();
  await editor.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const added = editor.locator('.plan-exercise-editor').last();
  await added.getByLabel('Movement', { exact: true }).fill('Bodyweight squat');
  await added.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Bodyweight + reps', exact: true }).click();
  await editor.getByRole('textbox', { name: 'Session note', exact: true }).fill('My custom weekly session.');
  await editor.getByRole('button', { name: 'Save day', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.reload();
  await selectTab(page, 'Workout');
  await openAllSets(page);
  await expect(page.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Upper Body', exact: true })).toBeVisible();
  await selectTab(page, 'My plan');
  await page.getByRole('button', { name: 'Edit Monday', exact: true }).click();
  await expect(editor.getByLabel('Session name', { exact: true })).toHaveValue('Custom strength');
  await expect(editor.getByLabel('Movement', { exact: true }).first()).toHaveValue('Custom press');
  await expect(editor.getByLabel('Sets', { exact: true }).first()).toHaveValue('2');
  await expect(editor.getByLabel('Movement', { exact: true })).toHaveCount(10);
  await expect(editor.getByRole('button', { name: 'Remove Pallof Press', exact: true })).toHaveCount(0);
  await expect(editor.locator('.plan-exercise-editor').last().getByRole('combobox')).toContainText('Bodyweight + reps');
  await closeDialog(editor);
  await selectTab(page, 'Workout');
  await page.getByRole('button', { name: 'Discard this workout', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard workout', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await openAllSets(page);
  await expect(page.getByRole('heading', { name: 'Custom strength', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Custom press set 1 reps', exact: true })).toHaveAttribute('placeholder', '8');
  await expect(page.getByRole('spinbutton', { name: 'Custom press set 3 reps', exact: true })).toHaveCount(0);
});

test('charts completed workout progress and excludes unchecked heavy sets', async ({ page }) => {
  await startMonday(page);
  await logWeightSet(page, '6', '4');
  await page.getByRole('textbox', { name: `${MOVEMENT} set 2 weight in kilograms`, exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: `${MOVEMENT} set 2 reps`, exact: true }).fill('99');
  await closeDialog(await finishWorkout(page));
  await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await openAllSets(page);
  await logWeightSet(page, '8', '5');
  await closeDialog(await finishWorkout(page));
  await selectTab(page, 'Progress');
  await page.getByRole('combobox', { name: 'Movement', exact: true }).click();
  await page.getByRole('option', { name: MOVEMENT, exact: true }).click();
  await expect(page.getByRole('heading', { name: MOVEMENT, exact: true })).toBeVisible();
  await expect(page.locator('.movement-history')).toContainText('6 kg × 4');
  await expect(page.locator('.movement-history')).toContainText('8 kg × 5');
  await expect(page.locator('.movement-history')).not.toContainText('100 kg');
  await expect(page.locator('.recharts-surface')).toBeVisible();
  await expect(page.locator('.recharts-line-dot')).toHaveCount(2);
  await page.reload();
  await selectTab(page, 'Progress');
  await page.getByRole('combobox', { name: 'Movement', exact: true }).click();
  await page.getByRole('option', { name: MOVEMENT, exact: true }).click();
  await expect(page.locator('.movement-history').getByRole('button')).toHaveCount(2);
});

test('records jump measurements and timed movement sets', async ({ page }) => {
  await page.getByRole('button', { name: /^Sun / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await openAllSets(page);
  await page.getByRole('spinbutton', { name: 'Approach Jump set 1 reps', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Approach Jump set 1 Highest touch · cm', exact: true }).fill('310');
  await page.getByRole('checkbox', { name: 'Complete Approach Jump set 1', exact: true }).check();
  await page.getByRole('spinbutton', { name: 'Approach Jump set 2 reps', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Approach Jump set 2 Highest touch · cm', exact: true }).fill('315');
  await page.getByRole('checkbox', { name: 'Complete Approach Jump set 2', exact: true }).check();
  await selectMovement(page, 'Pogo Jump');
  await page.getByRole('spinbutton', { name: 'Pogo Jump set 1 seconds', exact: true }).fill('15');
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).click();
  const stopTimer = page.getByRole('button', { name: 'Stop timer for Pogo Jump', exact: true });
  await expect(stopTimer).toBeVisible();
  const timerBounds = await stopTimer.boundingBox();
  expect(timerBounds).not.toBeNull();
  expect(timerBounds!.width).toBeGreaterThanOrEqual(44);
  expect(timerBounds!.height).toBeGreaterThanOrEqual(44);
  const floatingRestBounds = await page.locator('.rest-floating').boundingBox();
  const navigationBounds = await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox();
  expect(floatingRestBounds).not.toBeNull();
  expect(navigationBounds).not.toBeNull();
  expect(timerBounds!.y).toBeGreaterThanOrEqual(0);
  expect(timerBounds!.y + timerBounds!.height).toBeLessThanOrEqual(floatingRestBounds!.y);
  expect(timerBounds!.y + timerBounds!.height).toBeLessThanOrEqual(navigationBounds!.y);
  const timerPoint = { x: timerBounds!.x + timerBounds!.width / 2, y: timerBounds!.y + timerBounds!.height / 2 };
  const timerPoints = [timerPoint, { x: timerPoint.x, y: timerBounds!.y + 2 }, { x: timerPoint.x, y: timerBounds!.y + timerBounds!.height - 2 }];
  expect(await stopTimer.evaluate((element, points) => points.every((point) => {
    const target = document.elementFromPoint(point.x, point.y);
    return target !== null && element.contains(target);
  }), timerPoints), 'The full movement timer tap area must stay above the fixed rest bar and navigation').toBe(true);
  await stopTimer.click();
  await expect(page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Complete Pogo Jump set 1', exact: true }).check();
  const summary = await finishWorkout(page);
  await expect(summary).toContainText(/3\s*sets/);
  await expect(summary.getByRole('cell', { name: '315', exact: true })).toBeVisible();
  await expect(summary.getByRole('cell', { name: '15s', exact: true })).toBeVisible();
  await closeDialog(summary);
  await selectTab(page, 'Progress');
  await page.getByRole('combobox', { name: 'Movement', exact: true }).click();
  await page.getByRole('option', { name: 'Approach Jump', exact: true }).click();
  await expect(page.locator('.movement-history')).toContainText('315 cm');
});

test('persists meals, portions, nutrition targets and weight check-ins', async ({ page }) => {
  await selectTab(page, 'Nutrition');
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await meal.getByLabel('Meal name', { exact: true }).fill('Training dinner');
  await meal.getByLabel('Food 1', { exact: true }).fill('Rice');
  await meal.getByLabel('Serving / portion', { exact: true }).fill('150 g cooked');
  await meal.getByLabel('Calories · kcal', { exact: true }).fill('200');
  await meal.getByLabel('Protein · g', { exact: true }).fill('5');
  await meal.getByLabel('Carbs · g', { exact: true }).fill('45');
  await meal.getByLabel('Fat · g', { exact: true }).fill('1');
  await meal.getByRole('button', { name: 'Add another food', exact: true }).click();
  await meal.getByLabel('Food 2', { exact: true }).fill('Yogurt');
  await meal.getByLabel('Serving / portion', { exact: true }).nth(1).fill('One bowl');
  await meal.getByLabel('Calories · kcal', { exact: true }).nth(1).fill('150');
  await meal.getByLabel('Protein · g', { exact: true }).nth(1).fill('10');
  await meal.getByLabel('Carbs · g', { exact: true }).nth(1).fill('20');
  await meal.getByLabel('Fat · g', { exact: true }).nth(1).fill('5');
  await openMealDetails(meal);
  await meal.getByLabel('Meal notes', { exact: true }).fill('After training.');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.getByRole('button', { name: /Training dinner/ })).toContainText('350 kcal');
  const weightCheck = await openWeight(page);
  await weightCheck.getByLabel('Body weight · kg', { exact: true }).fill('62.5');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.locator('.nutrition-weight-average')).toContainText('62.5 kg');
  await closeDialog(weightCheck);
  await openTargets(page);
  await page.getByRole('button', { name: 'Edit targets', exact: true }).click();
  const targets = page.getByRole('dialog', { name: 'Your nutrition targets', exact: true });
  for (const [label, value] of [['Calories · kcal', '2800'], ['Protein · g', '120'], ['Carbs · g', '350'], ['Fat · g', '80'], ['Goal weight · kg', '68']]) {
    await targets.getByLabel(label, { exact: true }).fill(value);
  }
  await targets.getByRole('button', { name: 'Save targets', exact: true }).click();
  await page.reload();
  await selectTab(page, 'Nutrition');
  await expect(page.locator('.nutrition-daily__number strong')).toHaveText('2,450');
  await expect(page.locator('.nutrition-daily__protein strong')).toHaveText('15 / 120 g');
  await expect(page.locator('.nutrition-daily__macros strong')).toHaveText(['65 / 350 g', '6 / 80 g']);
  await expect(page.locator('.nutrition-totals')).toContainText('of 2800 kcal');
  await openWeight(page);
  await expect(page.locator('.nutrition-weight-average')).toContainText('62.5 kg');
  await closeDialog(page.getByRole('dialog'));
  await openTargets(page);
  await expect(page.getByText('Goal weight: 68 kg', { exact: true })).toBeVisible();
  await closeDialog(page.getByRole('dialog'));
  await page.getByRole('button', { name: /Training dinner/ }).click();
  const edit = page.getByRole('dialog');
  await openMealDetails(edit);
  await expect(edit.getByRole('textbox', { name: 'Meal notes', exact: true })).toHaveValue('After training.');
  await expect(edit.getByLabel('Food 2', { exact: true })).toHaveValue('Yogurt');
  await edit.getByLabel('Protein · g', { exact: true }).first().fill('6');
  await edit.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.locator('.nutrition-daily__protein strong')).toHaveText('16 / 120 g');
});

test('keeps manual meal entry available and hides unavailable photo analysis', async ({ page }) => {
  await selectTab(page, 'Nutrition');
  await expect(page.getByRole('button', { name: 'Meal photo', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add a meal', exact: true }).getByLabel('Meal name', { exact: true })).toBeVisible();
});

test('persists body weight and default rest preferences', async ({ page }) => {
  const preferences = await openPreferences(page);
  await preferences.getByLabel('Body weight · kg', { exact: true }).fill('62.5');
  await preferences.getByLabel('Default rest · seconds', { exact: true }).fill('120');
  await preferences.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(preferences).not.toBeVisible();
  await selectTab(page, 'Workout');
  await page.locator('.train-secondary > summary').filter({ hasText: /^Rest timer$/ }).click();
  await expect(page.locator('.rest-clock')).toHaveText('02:00');
  await page.reload();
  const restored = await openPreferences(page);
  await expect(restored.getByLabel('Body weight · kg', { exact: true })).toHaveValue('62.5');
  await expect(restored.getByLabel('Default rest · seconds', { exact: true })).toHaveValue('120');
});

test('shows iPhone Safari home-screen installation instructions', async ({ page }) => {
  await selectTab(page, 'More');
  await page.getByRole('button', { name: 'Install Setline', exact: true }).click();
  const install = page.getByRole('dialog', { name: 'Setline on your iPhone', exact: true });
  await expect(install).toContainText('Open this app in Safari.');
  await expect(install).toContainText('Tap Share, then Add to Home Screen.');
  await expect(install).toContainText('Open as Web App');
  await expect(install).toContainText('saved on this device and work offline');
  await closeDialog(install);
});

test('serves a standalone PWA manifest, local icons, safe-area HTML, and a worker', async ({ request }) => {
  const manifestResponse = await request.get('/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifest = await manifestResponse.json();
  expect(manifest.name).toContain('Setline');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(['standalone', 'fullscreen']).toContain(manifest.display);
  expect(manifest.theme_color).toBe('#f5f5f0');
  expect(manifest.background_color).toBe('#f5f5f0');
  expect(manifest.display_override).toContain('fullscreen');
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ sizes: '192x192' }),
    expect.objectContaining({ sizes: '512x512' }),
    expect.objectContaining({ purpose: 'maskable' }),
  ]));
  for (const icon of manifest.icons) {
    expect(icon.src).toMatch(/^\//);
    const response = await request.get(icon.src);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('image/png');
    const bytes = await response.body();
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  }
  const html = await (await request.get('/')).text();
  expect(html).toContain('viewport-fit=cover');
  expect(html).toContain('apple-mobile-web-app-capable');
  expect(html).toContain('name="apple-mobile-web-app-status-bar-style" content="default"');
  const workerResponse = await request.get('/service-worker.js');
  expect(workerResponse.ok()).toBe(true);
  expect(workerResponse.headers()['content-type']).toContain('javascript');
});

test('reloads the cached full app offline and saves a complete workout without a network', async ({ page, context }) => {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15_000 }).toBe('activated');
  const cachedPaths = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shellKey = keys.find((key) => key.startsWith('setline-pwa-'));
    if (!shellKey) return [];
    const cache = await caches.open(shellKey);
    return (await cache.keys()).map((request) => new URL(request.url).pathname);
  });
  expect(cachedPaths).toContain('/index.html');
  expect(cachedPaths).toContain('/manifest.webmanifest');
  expect(cachedPaths.some((pathname) => pathname.endsWith('.js'))).toBe(true);
  expect(cachedPaths.some((pathname) => pathname.endsWith('.css'))).toBe(true);
  await context.setOffline(true);
  const response = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(response?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  await startMonday(page);
  await logWeightSet(page, '9', '6');
  await page.locator('.workout-notes > details > summary').click();
  await page.getByLabel('Workout notes', { exact: true }).fill('Logged entirely offline.');
  const summary = await finishWorkout(page, '45');
  await expect(summary).toContainText(/54\s*kg volume/);
  await closeDialog(summary);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await selectTab(page, 'History');
  const history = mondayHistory(page);
  await expect(history).toContainText('54 kg total volume');
  await history.click();
  await expect(page.getByRole('dialog')).toContainText('Logged entirely offline.');
});

test('exports a portable backup, rejects invalid imports, and restores after a confirmed reset', async ({ page }) => {
  await startMonday(page);
  await logWeightSet(page, '10', '3');
  await closeDialog(await finishWorkout(page, '30'));
  let preferences = await openPreferences(page);
  await preferences.getByLabel('Body weight · kg', { exact: true }).fill('70');
  await preferences.getByLabel('Default rest · seconds', { exact: true }).fill('180');
  await preferences.getByRole('button', { name: 'Save preferences', exact: true }).click();
  preferences = await openPreferences(page);
  const downloadPromise = page.waitForEvent('download');
  await preferences.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^setline-backup-.*\.json$/);
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();
  const backupText = await readFile(backupPath!, 'utf8');
  const backup = JSON.parse(backupText);
  expect(backup.app).toBe('Setline');
  expect(backup.version).toBe(1);
  expect(backup.data.profile.bodyWeight).toBe(70);
  expect(backup.data.sessions).toHaveLength(1);

  page.once('dialog', (dialog) => dialog.accept());
  await preferences.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({
    name: 'invalid-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"wrong":"format"}'),
  });
  await expect(preferences.getByRole('alert')).toHaveText('Choose a supported Setline backup.');
  await expect(preferences.getByLabel('Body weight · kg', { exact: true })).toHaveValue('70');
  page.once('dialog', (dialog) => dialog.dismiss());
  await preferences.getByRole('button', { name: 'Delete all local data', exact: true }).click();
  await expect(preferences).toBeVisible();
  await expect(preferences.getByLabel('Body weight · kg', { exact: true })).toHaveValue('70');

  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    preferences.getByRole('button', { name: 'Delete all local data', exact: true }).click(),
  ]);
  await selectTab(page, 'History');
  await expect(page.getByText('0 completed workouts', { exact: true })).toBeVisible();
  preferences = await openPreferences(page);
  await expect(preferences.getByLabel('Body weight · kg', { exact: true })).toHaveValue('64');
  page.once('dialog', (dialog) => dialog.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    preferences.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({
      name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(backupText),
    }),
  ]);
  preferences = await openPreferences(page);
  await expect(preferences.getByLabel('Body weight · kg', { exact: true })).toHaveValue('70');
  await expect(preferences.getByLabel('Default rest · seconds', { exact: true })).toHaveValue('180');
  await closeDialog(preferences);
  await selectTab(page, 'History');
  await expect(mondayHistory(page)).toContainText('30 kg total volume');
});

test('reviews a GPX run, keeps imported metadata when editing, and skips a repeated import', async ({ page }) => {
  const date = await currentMondayDate(page);
  const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="adidas Running"><trk><name>Morning run</name><type>running</type><extensions><DistanceMeters>5000</DistanceMeters><Calories>900</Calories></extensions><trkseg><trkpt lat="52.5" lon="13.4"><time>${date}T08:00:00Z</time></trkpt><trkpt lat="52.51" lon="13.41"><time>${date}T08:40:00Z</time></trkpt></trkseg></trk></gpx>`;
  const file = { name: 'adidas-morning-run.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from(gpx) };
  let dialog = await openActivityImport(page);
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles(file);
  const preview = dialog.getByRole('article', { name: 'Import preview 1', exact: true });
  await expect(preview.getByLabel('Date', { exact: true })).toHaveValue(date);
  await expect(preview.getByLabel('Duration · minutes', { exact: true })).toHaveValue('40');
  await expect(preview.getByLabel('Distance · km · optional', { exact: true })).toHaveValue('5');
  await expect(preview).toContainText('Source calories: 900 kcal');
  await expect(preview).toContainText('320 active kcal');
  await preview.getByLabel('Name', { exact: true }).fill('Reviewed morning run');
  await preview.getByLabel('Duration · minutes', { exact: true }).fill('30');
  await dialog.getByRole('button', { name: 'Import 1 selected activity', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /^Mon / }).click();
  const extras = page.getByRole('region', { name: 'Extra activities', exact: true });
  await expect(extras).toContainText('Reviewed morning run');
  await expect(extras).toContainText('Imported from Adidas Running');
  await expect(extras).toContainText('320 active kcal');
  await extras.getByRole('button', { name: 'Edit Reviewed morning run', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit activity', exact: true });
  await edit.getByLabel('Distance · km · optional', { exact: true }).fill('6');
  await edit.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(extras).toContainText('384 active kcal');
  await page.reload();
  await openActivities(page);
  await page.getByRole('button', { name: /^Mon / }).click();
  await expect(extras).toContainText('Reviewed morning run');
  await expect(extras).toContainText('Imported from Adidas Running');
  const records = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).activities, STORE_KEY);
  expect(records).toHaveLength(1);
  expect(records[0].activity).toMatchObject({ durationMinutes: 30, distanceKm: 6, watchCalories: null });
  expect(records[0].activity.importSource).toMatchObject({ provider: 'adidas', format: 'gpx', originalCalories: 900 });
  expect(records[0].activity.importSource.fingerprint).toBeTruthy();

  dialog = await openActivityImport(page);
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles(file);
  await expect(dialog).toContainText('Already imported. This activity will be skipped.');
  await expect(dialog.getByRole('checkbox')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Import 0 selected activities', exact: true })).toBeDisabled();
  await closeDialog(dialog);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).activities.length, STORE_KEY)).toBe(1);
});

test('imports a Strava CSV offline and downloads a weekly report from saved workouts and activities', async ({ page, context }) => {
  const date = await currentMondayDate(page);
  await startMonday(page);
  await logWeightSet(page, '6', '4');
  await closeDialog(await finishWorkout(page, '60', '350'));
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15_000 }).toBe('activated');
  await context.setOffline(true);
  let dialog = await openActivityImport(page);
  const invalidCsv = `Activity ID,Activity Date,Activity Name,Activity Type,Moving Time,Distance\n800,${date}T08:00:00Z,Valid row,Run,1800,5\n799,${date}T09:00:00Z,Broken row,Ride,not-a-duration,12\n`;
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles({
    name: 'invalid-strava.csv', mimeType: 'text/csv', buffer: Buffer.from(invalidCsv),
  });
  await expect(dialog.getByRole('alert')).toContainText('Import not saved: 1 invalid CSV row.');
  await expect(dialog.getByRole('article', { name: /^Import preview/ })).toHaveCount(0);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).activities.length, STORE_KEY)).toBe(0);
  const csv = `Activity ID,Activity Date,Activity Name,Activity Type,Moving Time,Distance,Calories,Active Calories\n801,${date}T08:00:00Z,"Easy run, riverside",Run,1800,5,450,\n802,${date}T17:00:00Z,Evening ride,Ride,2400,12,280,200\n`;
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles({
    name: 'strava-activities.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await expect(dialog.getByRole('article', { name: /^Import preview/ })).toHaveCount(2);
  const run = dialog.getByRole('article', { name: 'Import preview 1', exact: true });
  const ride = dialog.getByRole('article', { name: 'Import preview 2', exact: true });
  await expect(run.getByLabel('Duration · minutes', { exact: true })).toHaveValue('30');
  await expect(run).toContainText('320 active kcal');
  await expect(ride).toContainText('200 active kcal');
  await expect(ride).toContainText('imported active energy');
  await dialog.getByRole('button', { name: 'Import 2 selected activities', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await selectTab(page, 'Nutrition');
  await page.getByLabel('Nutrition date', { exact: true }).fill(date);
  await page.getByRole('button', { name: 'Log meal', exact: true }).click();
  const meal = page.getByRole('dialog', { name: 'Add a meal', exact: true });
  await meal.getByLabel('Meal name', { exact: true }).fill('Recovery lunch');
  await meal.getByLabel('Food 1', { exact: true }).fill('Rice and tofu');
  await meal.getByLabel('Calories · kcal', { exact: true }).fill('500');
  await meal.getByLabel('Protein · g', { exact: true }).fill('30');
  await meal.getByLabel('Carbs · g', { exact: true }).fill('70');
  await meal.getByLabel('Fat · g', { exact: true }).fill('10');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.getByRole('button', { name: /Recovery lunch/ })).toBeVisible();
  const report = await openReport(page);
  await expect(report.locator('.weekly-report-metrics strong')).toHaveText(['1', '0', '2h 10m', '1/4']);
  await expect(report).toContainText('1 completed set');
  await expect(report).toContainText('24 kg volume');
  await expect(report).toContainText('2 extra activities');
  await expect(report).toContainText('5 km running');
  await expect(report).toContainText('12 km cycling');
  await expect(report).toContainText(/1 meals? logged on 1\/7 days/);
  await expect(report).toContainText('30 g protein/day recorded on logged days');
  await expect(report).toContainText('Partial logs; unrecorded meals are unknown.');
  await report.getByRole('button', { name: 'Previous report week', exact: true }).click();
  await expect(report.locator('.weekly-report-metrics strong')).toHaveText(['0', '0', '0m', '0/4']);
  await report.getByRole('button', { name: 'Next report week', exact: true }).click();
  await expect(report.locator('.weekly-report-metrics strong')).toHaveText(['1', '0', '2h 10m', '1/4']);
  const downloadPromise = page.waitForEvent('download');
  await report.getByRole('button', { name: 'Download weekly report', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`setline-weekly-report-${date}.json`);
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.app).toBe('Setline');
  expect(exported.report).toMatchObject({
    weekStart: date,
    completedPlannedGymDays: 1,
    totals: { workouts: 1, minutes: 130, completedSets: 1, volumeKg: 24, extraActivities: 2, activeCalories: 870, runKm: 5, cycleKm: 12 },
    nutrition: { available: true, mealLoggedDays: 1, mealsLogged: 1, meanLoggedProteinGrams: 30 },
  });
  expect(exported.report.insights.length).toBeGreaterThan(0);
  expect(exported.report.actions.length).toBeGreaterThan(0);
  dialog = await openActivityImport(page);
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles({
    name: 'strava-activities.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await expect(dialog).toContainText('0 selected · 2 already present or repeated');
  await closeDialog(dialog);
  const records = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).activities, STORE_KEY);
  expect(records).toHaveLength(2);
  expect(records[0].activity.importSource.externalId).toBe('801');
  expect(records[1].activity.watchCalories).toBe(200);
});

test('keeps daily food and recovery tips short and shows local exercise instructions on a narrow iPhone', async ({ page }) => {
  await openFuel(page);
  const routine = page.getByRole('region', { name: 'Before and after training', exact: true });
  await page.getByRole('button', { name: /^Sat / }).click();
  await expect(routine).toContainText('No special workout snack is needed today.');
  await expect(routine).toContainText('7–9 hours of sleep.');
  await page.getByRole('button', { name: /^Mon / }).click();
  await expect(routine.getByRole('heading', { name: 'Before training', exact: true })).toBeVisible();
  await expect(routine.getByRole('heading', { name: 'After training', exact: true })).toBeVisible();
  await expect(routine).toContainText('banana');
  await expect(routine).toContainText('20–40 g protein');
  for (const tip of await routine.locator('p').allTextContents()) expect(tip.length).toBeLessThanOrEqual(180);

  await page.getByRole('button', { name: /^Dynamic warm-up/ }).click();
  const warmup = page.locator('details.exercise-guide').filter({ has: page.locator('summary[aria-label="Exercise details for Wall Slide"]') });
  await warmup.locator('summary').click();
  await expect(warmup.locator('ol li')).toHaveCount(3);
  await expect(warmup).toContainText(/ribs/i);
  await expect(warmup.getByRole('link')).toHaveAttribute('href', /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  const warmupSummaryBounds = await warmup.locator('summary').boundingBox();
  expect(warmupSummaryBounds!.height).toBeGreaterThanOrEqual(44);
  const plannedGuide = page.locator('details.exercise-guide').filter({ has: page.locator(`summary[aria-label="Exercise details for ${MOVEMENT}"]`) });
  await plannedGuide.locator('summary').click();
  await expect(plannedGuide.locator('ol li')).toHaveCount(3);
  await expect(plannedGuide.getByRole('link')).toHaveAttribute('target', '_blank');

  await startMonday(page);
  const activeGuide = page.locator('details.exercise-guide').filter({ has: page.locator(`summary[aria-label="Exercise details for ${MOVEMENT}"]`) });
  await activeGuide.locator('summary').click();
  await expect(activeGuide.locator('ol li')).toHaveCount(3);
  await expect(activeGuide).toContainText('Avoid');
  await expect(activeGuide).toContainText('Feel it');
  await expect(activeGuide).toContainText('Safety');
  await page.setViewportSize({ width: 320, height: 844 });
  await activeGuide.scrollIntoViewIfNeeded();
  await expect(activeGuide.getByRole('link')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  for (const summary of [activeGuide.locator('summary')]) {
    const bounds = await summary.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
});

test('decodes an actual FIT binary from the cached app offline and rejects a damaged checksum', async ({ page, context }) => {
  const date = await currentMondayDate(page);
  const start = new Date(`${date}T08:00:00Z`);
  const encoder = new Encoder();
  const fileId: FileIdMesg = {
    type: 'activity', manufacturer: 'development', product: 1, timeCreated: start,
  };
  const session: SessionMesg = {
    sport: 'running', startTime: start, timestamp: new Date(start.getTime() + 2100_000),
    totalTimerTime: 1800, totalElapsedTime: 2100, totalDistance: 5000, totalCalories: 450,
  };
  encoder.onMesg(Profile.MesgNum.FILE_ID, fileId);
  encoder.onMesg(Profile.MesgNum.SESSION, session);
  const binary = Buffer.from(encoder.close());
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15_000 }).toBe('activated');
  await context.setOffline(true);
  const dialog = await openActivityImport(page);
  const damaged = Buffer.from(binary);
  damaged[damaged.length - 1] ^= 1;
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles({
    name: 'damaged.fit', mimeType: 'application/octet-stream', buffer: damaged,
  });
  await expect(dialog.getByRole('alert')).toContainText(/checksum|damaged/i);
  await expect(dialog.getByRole('article', { name: /^Import preview/ })).toHaveCount(0);
  await dialog.getByLabel('Activity files', { exact: true }).setInputFiles({
    name: 'strava-run.fit', mimeType: 'application/octet-stream', buffer: binary,
  });
  const preview = dialog.getByRole('article', { name: 'Import preview 1', exact: true });
  await expect(preview.getByLabel('Date', { exact: true })).toHaveValue(date);
  await expect(preview.getByLabel('Duration · minutes', { exact: true })).toHaveValue('30');
  await expect(preview.getByLabel('Distance · km · optional', { exact: true })).toHaveValue('5');
  await expect(preview).toContainText('320 active kcal');
  await expect(preview).toContainText('Source calories: 450 kcal');
  await preview.getByLabel('Name', { exact: true }).fill('Imported FIT run');
  await dialog.getByRole('button', { name: 'Import 1 selected activity', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openActivities(page);
  await page.getByRole('button', { name: /^Mon / }).click();
  const extras = page.getByRole('region', { name: 'Extra activities', exact: true });
  await expect(extras).toContainText('Imported FIT run');
  await expect(extras).toContainText('Imported from Strava');
  await expect(extras).toContainText('320 active kcal');
  const records = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).activities, STORE_KEY);
  expect(records).toHaveLength(1);
  expect(records[0].activity).toMatchObject({ type: 'run', date, durationMinutes: 30, distanceKm: 5, watchCalories: null });
  expect(records[0].activity.importSource).toMatchObject({ format: 'fit', provider: 'strava', originalCalories: 450 });
});
