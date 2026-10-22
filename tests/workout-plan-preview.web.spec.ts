import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-10-19';
const EXERCISES = ['Hack Squat', 'Romanian Deadlift', 'Standing Calf Raise'];

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

async function seed(page: Page, appearance: 'light' | 'dark' = 'light') {
  const profile = structuredClone(DEFAULT_PROFILE);
  const lower = {
    name: 'Lower Strength', kind: 'strength', goal: 'strength', minutes: 55, note: 'Quality force production.',
    exercises: EXERCISES.map((name, index) => ({ ...toPlanExercise(findLibraryExercise(name)!), sets: 3, target: index ? '8–10 reps' : '4–6 reps', defaultKg: 50 + index * 5, rest: 120 })),
  };
  profile.plan[0] = lower;
  const parsed = ProfileSchema.parse({ ...profile, masterProgram: undefined, appearance });
  const history = SessionSchema.parse(createSession(lower, 0, '2026-10-12', parsed, []));
  history.status = 'completed'; history.runningSince = null; history.finishedAt = history.startedAt + 45 * 60_000; history.elapsedMs = 45 * 60_000;
  history.exercises[0].logs[0] = { ...history.exercises[0].logs[0], kg: 50, reps: 6, done: true };
  await page.evaluate(({ key, profile, history }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: history, version: 1 }],
    nutrition: [{ id: 'saved-weight', date: '2026-10-18', version: 1, payload: { kind: 'weight', kg: 64.2 } }], activities: [],
  })), { key: STORE, profile: parsed, history });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
}

async function preview(page: Page) {
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function options(page: Page, sheet: Locator, name: string) {
  await sheet.getByRole('button', { name: `Options for ${name}`, exact: true }).click();
  const menu = page.getByRole('dialog', { name, exact: true });
  await expect(menu).toBeVisible();
  return menu;
}

async function chooseLibrary(page: Page, title: 'Add exercise' | 'Replace exercise', name: string) {
  const library = page.getByRole('dialog', { name: title, exact: true });
  await expect(library).toBeVisible();
  await library.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill(name);
  await library.getByRole('button', { name: `Select ${name}`, exact: true }).click();
  await page.locator('.exercise-library-sheet').getByRole('button', { name: title, exact: true }).click();
  await expect(page.locator('.exercise-library-sheet')).not.toBeVisible();
}

async function assertSheetGeometry(sheet: Locator, height: number) {
  await expect.poll(async () => sheet.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const close = element.querySelector('.dialog-close-button')!.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, width: rect.width, viewport: innerWidth,
      closeTop: close.top, closeBottom: close.bottom, closeWidth: close.width, closeHeight: close.height,
      safeTop: rect.top >= 46, safeBottom: rect.bottom <= innerHeight - 33,
      overflow: document.documentElement.scrollWidth > innerWidth };
  })).toMatchObject({ closeWidth: 44, closeHeight: 44, safeTop: true, safeBottom: true, overflow: false });
  expect(await sheet.evaluate(() => innerHeight)).toBe(height);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('Today previews the entire scheduled session and technique without starting or writing a workout', async ({ page }) => {
  await seed(page);
  const before = await state(page);
  const raw = await page.evaluate(key => localStorage.getItem(key), STORE);
  const sheet = await preview(page);
  await expect(sheet).toContainText('About 55 min');
  await expect(sheet).toContainText('3 exercises · 9 sets');
  await expect(sheet).toContainText('Weekly plan unchanged.');
  for (const name of EXERCISES) await expect(sheet.getByRole('button', { name: `Exercise details for ${name}`, exact: true })).toBeVisible();
  await expect(sheet).toContainText('3 × 4–6 reps · 50 kg');
  await expect(sheet).toContainText('120 sec rest');
  await sheet.locator('.plan-preview__warmup > summary').click();
  await expect(sheet.getByRole('list', { name: 'Preview warm-up exercises', exact: true })).toContainText('Ankle Knee-to-Wall');
  await expect(sheet.getByRole('checkbox')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Hack Squat', exact: true });
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Alternatives', exact: true }).click();
  await expect(guide.locator('.exercise-guide__alternatives')).toContainText('Squat');
  await guide.getByRole('button', { name: 'Close', exact: true }).click();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(raw);
  expect((await state(page)).sessions).toEqual(before.sessions);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Edit today', exact: true }).click();
  await expect(sheet).toBeVisible();
  expect((await state(page)).profile.sessionDrafts ?? []).toEqual([]);
});

test('preview edits, decimal defaults and exercise changes persist for one date without altering history or the reusable plan', async ({ page }) => {
  await seed(page);
  const before = await state(page);
  let sheet = await preview(page);
  const menu = await options(page, sheet, 'Hack Squat');
  await menu.getByRole('button', { name: 'Sets, reps & rest', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit exercise', exact: true });
  await edit.getByLabel('Sets', { exact: true }).fill('2');
  await edit.getByLabel('Reps / time', { exact: true }).fill('6–8 reps');
  await edit.getByRole('textbox', { name: 'Hack Squat planned weight in kilograms', exact: true }).fill('62,5');
  await edit.getByLabel('Rest · seconds', { exact: true }).fill('150');
  await edit.getByRole('button', { name: 'Save for this day', exact: true }).click();
  await expect(edit).not.toBeVisible();
  await expect(sheet).toContainText('2 × 6–8 reps · 62.5 kg');
  await expect(sheet).toContainText('150 sec rest');

  const replace = await options(page, sheet, 'Romanian Deadlift');
  await replace.getByRole('button', { name: 'Replace exercise', exact: true }).click();
  await chooseLibrary(page, 'Replace exercise', 'Dumbbell Romanian Deadlift');
  await expect(sheet.getByRole('button', { name: 'Exercise details for Dumbbell Romanian Deadlift', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Add exercise', exact: true }).click();
  await chooseLibrary(page, 'Add exercise', 'Pallof Press');
  const reorder = await options(page, sheet, 'Pallof Press');
  await reorder.getByRole('button', { name: 'Move Pallof Press up', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.sessionDrafts[0].plan.exercises.map((exercise: { name: string }) => exercise.name)).toEqual(['Hack Squat', 'Dumbbell Romanian Deadlift', 'Pallof Press', 'Standing Calf Raise']);
  await reorder.getByRole('button', { name: 'Close', exact: true }).click();
  const remove = await options(page, sheet, 'Standing Calf Raise');
  await remove.getByRole('button', { name: 'Remove exercise', exact: true }).click();
  await expect(remove).not.toBeVisible();

  const saved = await state(page);
  expect(saved.profile.plan).toEqual(before.profile.plan);
  expect(saved.sessions).toEqual(before.sessions);
  expect(saved.nutrition).toEqual(before.nutrition);
  expect(saved.profile.sessionDrafts).toHaveLength(1);
  expect(saved.profile.sessionDrafts[0]).toMatchObject({ date: DATE, slot: 'main', warmupOverride: false,
    plan: { exercises: [{ name: 'Hack Squat', sets: 2, target: '6–8 reps', defaultKg: 62.5, rest: 150 }, { name: 'Dumbbell Romanian Deadlift' }, { name: 'Pallof Press' }] } });
  await page.reload();
  sheet = await preview(page);
  await expect(sheet).toContainText('2 × 6–8 reps · 62.5 kg');
  await expect(sheet.getByRole('list', { name: 'Scheduled exercises', exact: true })).not.toContainText('Standing Calf Raise');
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Choose training day', exact: true }).click();
  const days = page.getByRole('dialog', { name: 'Choose a day', exact: true });
  await days.getByRole('button', { name: 'Next week', exact: true }).click();
  await days.getByRole('button', { name: /^Mon / }).click();
  await days.getByRole('button', { name: 'Close', exact: true }).click();
  const nextWeek = await preview(page);
  await expect(nextWeek).toContainText('3 × 4–6 reps · 50 kg');
  await expect(nextWeek.getByRole('list', { name: 'Scheduled exercises', exact: true })).toContainText('Standing Calf Raise');
  expect((await state(page)).profile.sessionDrafts).toEqual(saved.profile.sessionDrafts);
});

test('today-only drafts are included in a real backup and restore with existing workout and weight records', async ({ page }) => {
  await seed(page);
  const sheet = await preview(page);
  const menu = await options(page, sheet, 'Hack Squat');
  await menu.getByRole('button', { name: 'Move Hack Squat down', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.sessionDrafts?.length).toBe(1);
  await menu.getByRole('button', { name: 'Close', exact: true }).click();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  const saved = await state(page);
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  const downloading = page.waitForEvent('download');
  await settings.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloading;
  const text = await readFile((await download.path())!, 'utf8');
  const backup = JSON.parse(text);
  expect(backup.data.profile.sessionDrafts).toEqual(saved.profile.sessionDrafts);
  expect(backup.data.sessions).toEqual(saved.sessions);
  expect(backup.data.nutrition).toEqual(saved.nutrition);
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    settings.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({ name: 'setline-with-preview.json', mimeType: 'application/json', buffer: Buffer.from(text) }),
  ]);
  expect((await state(page)).profile.sessionDrafts).toEqual(saved.profile.sessionDrafts);
  expect((await state(page)).sessions).toEqual(saved.sessions);
  expect((await state(page)).nutrition).toEqual(saved.nutrition);
  const restored = await preview(page);
  await expect(restored.getByRole('button', { name: 'Exercise details for Romanian Deadlift', exact: true }).first()).toBeVisible();
});

for (const appearance of ['light', 'dark'] as const) {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`preview, details and editing remain usable at ${viewport.width}px in ${appearance} mode`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seed(page, appearance);
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--app-safe-area-top', '47px');
        document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
      });
      const sheet = await preview(page);
      await assertSheetGeometry(sheet, viewport.height);
      const details = sheet.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true });
      await details.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `/tmp/setline-preview-${appearance}-${viewport.width}.png` });
      await details.click();
      const guide = page.getByRole('dialog', { name: 'Hack Squat', exact: true });
      await assertSheetGeometry(guide, viewport.height);
      await page.screenshot({ path: `/tmp/setline-preview-guide-${appearance}-${viewport.width}.png` });
      await guide.getByRole('button', { name: 'Close', exact: true }).click();
      const menu = await options(page, sheet, 'Hack Squat');
      await menu.getByRole('button', { name: 'Sets, reps & rest', exact: true }).click();
      const edit = page.getByRole('dialog', { name: 'Edit exercise', exact: true });
      await assertSheetGeometry(edit, viewport.height);
      const weight = edit.getByRole('textbox', { name: 'Hack Squat planned weight in kilograms', exact: true });
      await weight.fill('12.5');
      await expect(weight).toHaveAttribute('inputmode', 'decimal');
      await page.screenshot({ path: `/tmp/setline-preview-edit-${appearance}-${viewport.width}.png` });
      const save = edit.getByRole('button', { name: 'Save for this day', exact: true });
      await save.click();
      await expect(edit).not.toBeVisible();
      await expect(sheet).toContainText('12.5 kg');
      expect((await state(page)).sessions).toHaveLength(1);
    });
  }
}
