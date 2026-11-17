import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const BENCH = 'Barbell Bench Press';
const DATE = '2026-11-17';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);

/** Synthetic, localhost-only data: nothing from a personal installation. */
async function seed(page: Page, appearance: 'light' | 'dark' = 'dark') {
  const bench = { ...toPlanExercise(findLibraryExercise('bench-press')!), sets: 3, target: '6–10 reps',
    defaultKg: 50, targetRir: 2, rest: 120 };
  const template = { id: crypto.randomUUID(), name: 'Existing QA template', kind: 'strength' as const,
    goal: 'strength' as const, minutes: 60, note: 'Isolated test template.', exercises: [bench], warmup: [], cooldown: [] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete', appearance,
    customWorkouts: [template], trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA guidance only.' } });
  const previous = SessionSchema.parse(stopSessionTimers(createSession(template, 0, '2026-11-16', profile, []), 'completed'));
  previous.startedAt = Date.parse('2026-11-16T10:00:00Z');
  previous.finishedAt = previous.startedAt + 60 * 60_000; previous.elapsedMs = 60 * 60_000;
  previous.exercises[0].logs.forEach(log => Object.assign(log, { done: true, kg: 60, reps: 8, rir: 2 }));
  const state = { schemaVersion: 1, profile, profileVersion: 2,
    sessions: [{ session: SessionSchema.parse(previous), version: 1 }], nutrition: [], activities: [], reminders: defaultReminderState() };
  await page.evaluate(state => { localStorage.setItem('setline.gym.v1', JSON.stringify(state)); sessionStorage.clear(); }, state);
  await page.reload();
  return state;
}

async function openBuilder(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'My workouts', exact: true }).click();
  await page.getByRole('button', { name: 'Create workout', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Create workout', exact: true });
  await expect(builder).toBeVisible();
  return builder;
}

async function openPicker(page: Page) {
  await page.getByRole('dialog', { name: 'Create workout', exact: true }).getByRole('button', { name: 'Add exercise', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Add exercise', exact: true });
  await expect(picker.getByRole('searchbox', { name: 'Search exercises', exact: true })).toBeVisible();
  return picker;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 844 }, { width: 1194, height: 834 }]) {
  test(`direct search Add creates one editable template without a detail screen or duplicate Save at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const before = await seed(page, viewport.width === 390 ? 'light' : 'dark');
    const builder = await openBuilder(page);
    await builder.getByLabel('Workout name', { exact: true }).fill('My QA bench workout');
    const picker = await openPicker(page);
    await picker.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill(BENCH);
    const add = picker.getByRole('button', { name: `Add ${BENCH}`, exact: true });
    const touch = await add.boundingBox();
    expect(touch!.width).toBeGreaterThanOrEqual(44); expect(touch!.height).toBeGreaterThanOrEqual(44);
    await expect(picker.locator('.exercise-guide__technique')).toHaveCount(0);
    await add.evaluate(button => { for (let tap = 0; tap < 10; tap++) (button as HTMLButtonElement).click(); });
    await expect(picker).toHaveCount(0);
    await expect(builder.getByRole('button', { name: `Edit ${BENCH}`, exact: true })).toHaveCount(1);
    await builder.getByLabel('Sets', { exact: true }).fill('3');
    await builder.getByLabel('Target', { exact: true }).fill('6–10 reps');
    await builder.getByRole('textbox', { name: `${BENCH} starting weight in kilograms`, exact: true }).fill('60');
    await builder.getByLabel('Rest · sec', { exact: true }).fill('120');
    await builder.getByText('More options', { exact: true }).click();
    await builder.getByLabel('Target RIR', { exact: true }).fill('2');
    expect(await raw(page)).toBe(JSON.stringify(before));
    await builder.getByRole('button', { name: 'Save template', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`builder-direct-${viewport.width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await builder.getByRole('button', { name: 'Save template', exact: true }).evaluate(button => {
      for (let tap = 0; tap < 10; tap++) (button as HTMLButtonElement).click();
    });
    await expect(builder).toHaveCount(0);
    const after = await read(page);
    expect(after.profile.customWorkouts).toHaveLength(2);
    expect(after.profile.customWorkouts[0]).toEqual(before.profile.customWorkouts![0]);
    expect(after.profile.customWorkouts[1].exercises).toHaveLength(1);
    expect(after.profile.customWorkouts[1].exercises[0]).toMatchObject({ exerciseId: 'bench-press', name: BENCH,
      sets: 3, target: '6–10 reps', defaultKg: 60, targetRir: 2, rest: 120 });
    expect(after.profile.plan).toEqual(before.profile.plan);
    expect(after.sessions).toEqual(before.sessions);
    expect(after.nutrition).toEqual(before.nutrition);
    await page.reload();
    expect((await read(page)).profile.customWorkouts).toEqual(after.profile.customWorkouts);
  });
}

test('exercise technique stays optional and Back retains search before direct Add', async ({ page }) => {
  await seed(page);
  const before = await raw(page);
  await openBuilder(page);
  const picker = await openPicker(page);
  const search = picker.getByRole('searchbox', { name: 'Search exercises', exact: true });
  await search.fill(BENCH);
  await picker.getByRole('button', { name: `Select ${BENCH}`, exact: true }).click();
  const detail = page.locator('.exercise-library-sheet');
  await expect(detail.getByRole('heading', { name: BENCH, exact: true })).toBeVisible();
  await expect(detail.getByRole('link', { name: 'Search Google', exact: true })).toBeVisible();
  await expect(detail.getByRole('link', { name: 'YouTube Demonstration', exact: true })).toBeVisible();
  await detail.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(search).toHaveValue(BENCH);
  expect(await raw(page)).toBe(before);
  await picker.getByRole('button', { name: `Add ${BENCH}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create workout', exact: true }).getByRole('button', { name: `Edit ${BENCH}`, exact: true })).toBeVisible();
  expect(await raw(page)).toBe(before);
});

test('recent choices come from recorded exercises and add without opening instructions', async ({ page }) => {
  await seed(page);
  const before = await raw(page);
  await openBuilder(page);
  const picker = await openPicker(page);
  const recent = picker.getByRole('region', { name: 'Recently used exercises', exact: true });
  await expect(recent).toBeVisible();
  await expect(recent.getByRole('button', { name: `Add ${BENCH}`, exact: true })).toHaveCount(1);
  await recent.getByRole('button', { name: `Add ${BENCH}`, exact: true }).click();
  await expect(picker).toHaveCount(0);
  expect(await raw(page)).toBe(before);
});

test('an installation without completed workouts does not invent recent exercises', async ({ page }) => {
  await seed(page);
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)!); state.sessions = [];
    localStorage.setItem(key, JSON.stringify(state));
  }, STORE);
  await page.reload();
  const before = await raw(page);
  await openBuilder(page);
  const picker = await openPicker(page);
  await expect(picker.getByRole('region', { name: 'Recently used exercises', exact: true })).toHaveCount(0);
  await expect(picker.getByRole('searchbox', { name: 'Search exercises', exact: true })).toBeVisible();
  expect(await raw(page)).toBe(before);
});

test.describe('physical keyboard picker', () => {
  test.use({ viewport: { width: 1194, height: 834 }, isMobile: false, hasTouch: false });
  test('search receives focus for a fine pointer without another click', async ({ page }) => {
    await seed(page, 'light');
    await openBuilder(page);
    const picker = await openPicker(page);
    const search = picker.getByRole('searchbox', { name: 'Search exercises', exact: true });
    await expect(search).toBeFocused();
    await page.keyboard.type(BENCH);
    await expect(search).toHaveValue(BENCH);
    await expect(picker.getByRole('button', { name: `Add ${BENCH}`, exact: true })).toBeVisible();
  });
});
