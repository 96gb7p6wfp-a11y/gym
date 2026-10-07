import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';

const STORE_KEY = 'setline.gym.v1';
const MOVEMENT = 'Medicine Ball Spike Slam';
const SESSION = 'Upper Power + Muscle';
const requests = new WeakMap<Page, string[]>();
const runtimeErrors = new WeakMap<Page, string[]>();

async function selectTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
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
}

async function logWeightSet(page: Page, kilograms: string, reps: string, set = 1, movement = MOVEMENT) {
  await page.getByRole('spinbutton', { name: `${movement} set ${set} weight in kilograms`, exact: true }).fill(kilograms);
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
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your preferences', exact: true });
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
  await expect(page.getByRole('heading', { name: 'One set at a time.', exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
});

test.afterEach(async ({ page }) => {
  expect(requests.get(page), 'The app must not call the former host or its backend').toEqual([]);
  expect(runtimeErrors.get(page), 'The app must not throw browser runtime errors').toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('provides all five views and usable navigation at iPhone and narrow phone sizes', async ({ page }) => {
  const headings: Record<string, string> = {
    Workout: 'One set at a time.',
    History: 'Your workout history.',
    Progress: 'See your progress.',
    Nutrition: 'Fuel your training.',
    'My plan': 'Your weekly plan.',
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
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    }
  }
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
  await expect(page.getByRole('button', { name: 'Skip rest', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Time & RIR', exact: true }).click();
  await page.getByLabel('Time', { exact: true }).first().fill('45');
  await page.getByLabel('RIR', { exact: true }).first().fill('2');
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
  await page.getByLabel('Workout notes', { exact: true }).fill('Paused session survives reload.');
  await page.getByRole('button', { name: 'Pause workout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await waitForPersistedText(page, 'Paused session survives reload.');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume workout', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: `${MOVEMENT} set 1 weight in kilograms`, exact: true })).toHaveValue('7');
  await expect(page.getByRole('checkbox', { name: `Complete ${MOVEMENT} set 1`, exact: true })).toBeChecked();
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
  await page.getByRole('button', { name: 'Add meal', exact: true }).click();
  await verifyPinnedClose(page, page.getByRole('dialog', { name: 'Add a meal', exact: true }), 59, 34);
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
  await expect(page.getByRole('spinbutton', { name: `${MOVEMENT} set 1 reps`, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: SESSION, exact: true })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Custom strength', exact: true })).toBeVisible();
  await expect(page.getByRole('spinbutton', { name: 'Custom press set 1 reps', exact: true })).toHaveAttribute('placeholder', '8');
  await expect(page.getByRole('spinbutton', { name: 'Custom press set 3 reps', exact: true })).toHaveCount(0);
});

test('charts completed workout progress and excludes unchecked heavy sets', async ({ page }) => {
  await startMonday(page);
  await logWeightSet(page, '6', '4');
  await page.getByRole('spinbutton', { name: `${MOVEMENT} set 2 weight in kilograms`, exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: `${MOVEMENT} set 2 reps`, exact: true }).fill('99');
  await closeDialog(await finishWorkout(page));
  await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
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
  await page.getByRole('spinbutton', { name: 'Approach Jump set 1 reps', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Approach Jump set 1 Highest touch · cm', exact: true }).fill('310');
  await page.getByRole('checkbox', { name: 'Complete Approach Jump set 1', exact: true }).check();
  await page.getByRole('spinbutton', { name: 'Approach Jump set 2 reps', exact: true }).fill('2');
  await page.getByRole('spinbutton', { name: 'Approach Jump set 2 Highest touch · cm', exact: true }).fill('315');
  await page.getByRole('checkbox', { name: 'Complete Approach Jump set 2', exact: true }).check();
  await page.getByRole('button', { name: /^02 Pogo Jump/ }).click();
  await page.getByRole('spinbutton', { name: 'Pogo Jump set 1 seconds', exact: true }).fill('15');
  await page.getByRole('button', { name: 'Start timer for Pogo Jump', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Stop timer for Pogo Jump', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop timer for Pogo Jump', exact: true }).click();
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
  await page.getByRole('button', { name: 'Add meal', exact: true }).click();
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
  await meal.getByLabel('Meal notes', { exact: true }).fill('After training.');
  await meal.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.getByRole('button', { name: /Training dinner/ })).toContainText('350 kcal');
  await page.getByLabel('Body weight · kg', { exact: true }).fill('62.5');
  await page.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.locator('.nutrition-weight-average')).toContainText('62.5 kg');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const targets = page.getByRole('dialog', { name: 'Your nutrition targets', exact: true });
  for (const [label, value] of [['Calories · kcal', '2800'], ['Protein · g', '120'], ['Carbs · g', '350'], ['Fat · g', '80'], ['Goal weight · kg', '68']]) {
    await targets.getByLabel(label, { exact: true }).fill(value);
  }
  await targets.getByRole('button', { name: 'Save targets', exact: true }).click();
  await page.reload();
  await selectTab(page, 'Nutrition');
  await expect(page.locator('.nutrient-card strong')).toHaveText(['350', '15', '65', '6']);
  await expect(page.locator('.nutrient-card').first()).toContainText('of 2800 kcal');
  await expect(page.locator('.nutrition-weight-average')).toContainText('62.5 kg');
  await expect(page.getByText('Goal weight: 68 kg', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Training dinner/ }).click();
  const edit = page.getByRole('dialog');
  await expect(edit.getByRole('textbox', { name: 'Meal notes', exact: true })).toHaveValue('After training.');
  await expect(edit.getByLabel('Food 2', { exact: true })).toHaveValue('Yogurt');
  await edit.getByLabel('Protein · g', { exact: true }).first().fill('6');
  await edit.getByRole('button', { name: 'Save meal', exact: true }).click();
  await expect(page.locator('.nutrient-card strong').nth(1)).toHaveText('16');
});

test('keeps manual meal entry available from the optional photo feature', async ({ page }) => {
  await selectTab(page, 'Nutrition');
  await page.getByRole('button', { name: 'Meal photo', exact: true }).click();
  const photo = page.getByRole('dialog', { name: 'Estimate a meal from a photo', exact: true });
  await expect(photo).toContainText(/Manual meal logging is available|Enter.*manually/i);
  await expect(photo.getByRole('button', { name: 'Analyze and review', exact: true })).toBeDisabled();
  await photo.getByRole('button', { name: 'Enter meal manually', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add a meal', exact: true }).getByLabel('Meal name', { exact: true })).toBeVisible();
});

test('persists body weight and default rest preferences', async ({ page }) => {
  const preferences = await openPreferences(page);
  await preferences.getByLabel('Body weight · kg', { exact: true }).fill('62.5');
  await preferences.getByLabel('Default rest · seconds', { exact: true }).fill('120');
  await preferences.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(preferences).not.toBeVisible();
  await expect(page.locator('.rest-clock')).toHaveText('02:00');
  await page.reload();
  const restored = await openPreferences(page);
  await expect(restored.getByLabel('Body weight · kg', { exact: true })).toHaveValue('62.5');
  await expect(restored.getByLabel('Default rest · seconds', { exact: true })).toHaveValue('120');
});

test('shows iPhone Safari home-screen installation instructions', async ({ page }) => {
  await page.getByRole('button', { name: 'Add Setline to your iPhone', exact: true }).click();
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
  await expect(page.getByRole('heading', { name: 'One set at a time.', exact: true })).toBeVisible();
  await startMonday(page);
  await logWeightSet(page, '9', '6');
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
  await expect(preferences.getByLabel('Body weight · kg', { exact: true })).toHaveValue('61');
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
