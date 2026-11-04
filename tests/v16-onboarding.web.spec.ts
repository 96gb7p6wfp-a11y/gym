import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';
import { finishWarmup, openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';

// Other regression suites intentionally use an established V15 installation.
// This file starts with no personal data and explicitly seeds its legacy cases.
test.use({ storageState: { cookies: [], origins: [] } });
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
});

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}
async function next(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
}
async function settings(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Your preferences', exact: true });
}

function legacyState() {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), bodyWeight: 71,
    customWorkouts: [{ ...structuredClone(DEFAULT_PROFILE.plan[0]), id: crypto.randomUUID(), name: 'Owner custom workout' }] });
  const active = SessionSchema.parse(createSession(profile.plan[0], 0, DATE, profile, []));
  active.runningSince = null;
  active.exercises[0].logs[0] = { ...active.exercises[0].logs[0], kg: 7.5, reps: 4, rir: 2 };
  const historical = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed'));
  historical.exercises[0].logs[0] = { ...historical.exercises[0].logs[0], kg: 6, reps: 4, rir: 3, done: true };
  historical.notes = 'Keep my existing history';
  return { schemaVersion: 1, profile, profileVersion: 7, sessions: [{ session: historical, version: 3 }, { session: active, version: 4 }],
    nutrition: [{ id: 'owner-weight', date: '2026-10-26', version: 1, payload: { kind: 'weight', kg: 70.5 } }], activities: [],
    reminders: defaultReminderState(), performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-10-26',
      type: 'standing', measurement: 'height', cm: 55, notes: 'Owner jump', source: 'measured' }], readiness: [] }, performanceVersion: 1 };
}

async function seedLegacy(page: Page) {
  const saved = legacyState();
  await page.addInitScript(({ key, saved }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORE, saved });
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return saved;
}

test('fresh visitors remain neutral through refresh and can skip without receiving owner data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'What brings you here?', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBeNull();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'What brings you here?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip setup · use a simple starting plan', exact: true }).click();
  await expect(page.locator('.onboarding-dialog')).toHaveCount(0);
  const saved = await state(page);
  expect(saved.profile.bodyWeight).toBeNull();
  expect(saved.profile.nutrition).toBeUndefined();
  expect(saved.profile.volleyballSchedule).toBeUndefined();
  expect(saved.profile.masterProgram).toBeUndefined();
  expect(saved.profile.onboarding).toEqual({ version: 16, status: 'skipped' });
  expect(saved.profile.presentationMode).toBe('simple');
  expect(saved.sessions).toEqual([]);
  expect(saved.nutrition).toEqual([]);
  expect(saved.reminders).toEqual({ items: [], entries: [] });
  await expect(page.getByRole('region', { name: 'Next training event', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  await expect(page.locator('.onboarding-dialog')).toHaveCount(0);

  const preferences = await settings(page);
  await expect(preferences.getByLabel('Body weight · kg', { exact: true })).toHaveValue('');
  await preferences.getByRole('button', { name: 'Close', exact: true }).click();
  await openSection(page, 'Nutrition');
  await page.getByRole('button', { name: 'Set daily targets', exact: true }).click();
  await page.locator('summary', { hasText: 'Personal calorie calculator' }).click();
  await page.locator('summary', { hasText: 'Edit calculation details' }).click();
  await expect(page.getByLabel('Age', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Height · cm', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Weight for calculation · kg', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: /Use my shared details/ })).toHaveCount(0);
});

test('three-step beginner setup produces a suitable three-day home plan and starts without advanced effort fields', async ({ page }) => {
  await page.goto('/');
  await page.locator('.onboarding-choice').filter({ hasText: 'General fitness' }).click();
  await next(page);
  await page.locator('.onboarding-choice').filter({ hasText: 'Beginner' }).click();
  await next(page);
  await page.getByRole('combobox', { name: 'Training days per week', exact: true }).selectOption('3');
  await page.getByRole('radio', { name: 'Home', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Machines & cables', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Start training', exact: true }).click();
  await expect(page.locator('.onboarding-dialog')).toHaveCount(0);
  const saved = await state(page);
  const strengthDays = saved.profile.plan.filter((day: { kind: string }) => day.kind === 'strength');
  expect(strengthDays).toHaveLength(3);
  expect(strengthDays.every((day: { exercises: { sets: number; mode: string; defaultKg?: number }[] }) => day.exercises.every(exercise => exercise.sets === 2 && exercise.mode === 'bodyweight' && exercise.defaultKg === undefined))).toBe(true);
  expect(saved.profile.trainingPreferences).toMatchObject({ goal: 'fitness', experience: 'beginner', daysPerWeek: 3, location: 'home', equipment: ['bodyweight'] });
  expect(saved.profile.bodyWeight).toBeNull();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(current).toBeVisible();
  await expect(current.getByRole('group', { name: 'Quick reps in reserve', exact: true })).toHaveCount(0);
  await expect(current.locator('.focused-effort > summary')).toContainText('Effort & advanced');
  await expect(current.locator('.focused-effort')).not.toHaveAttribute('open');
  const started = await state(page);
  await page.reload();
  await openSection(page, 'Train');
  const after = await state(page);
  expect(after.sessions).toHaveLength(1);
  expect(after.sessions[0].session.id).toBe(started.sessions[0].session.id);
  expect(after.sessions).toEqual(started.sessions);
  expect(after.sessions[0].session.bodyWeight).toBeNull();
});

test('own-workout setup opens an empty workout builder immediately', async ({ page }) => {
  await page.goto('/');
  await page.locator('.onboarding-choice').filter({ hasText: 'Track my own workouts' }).click();
  await next(page); await next(page);
  await page.getByRole('button', { name: 'Create my workout', exact: true }).click();
  const builder = page.getByRole('dialog', { name: 'Create workout', exact: true });
  await expect(builder).toBeVisible();
  await expect(builder.getByLabel('Workout name', { exact: true })).toHaveValue('');
  await expect(builder.locator('.builder-exercises > li')).toHaveCount(0);
  await expect(builder.getByRole('button', { name: 'Add exercise', exact: true })).toBeVisible();
  const saved = await state(page);
  expect(saved.profile.trainingPreferences.goal).toBe('own');
  expect(saved.profile.plan.every((day: { exercises: unknown[] }) => day.exercises.length === 0)).toBe(true);
  expect(saved.sessions).toEqual([]);
});

test('legacy installations retain all data when switching Simple and Athlete and on refresh', async ({ page }) => {
  const initial = await seedLegacy(page);
  await expect(page.locator('.onboarding-dialog')).toHaveCount(0);
  expect(await state(page)).toEqual(initial);
  const preferences = await settings(page);
  const modes = preferences.getByRole('group', { name: 'Presentation mode', exact: true });
  await expect(modes.getByRole('button', { name: 'Athlete', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const [name, value] of [['Simple', 'simple'], ['Athlete', 'athlete']] as const) {
    await modes.getByRole('button', { name, exact: true }).click();
    await expect(modes.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await state(page)).profile.presentationMode).toBe(value);
    const saved = await state(page);
    expect(saved.profile).toEqual({ ...initial.profile, presentationMode: value });
    expect(saved.sessions).toEqual(initial.sessions);
    expect(saved.nutrition).toEqual(initial.nutrition);
    expect(saved.reminders).toEqual(initial.reminders);
    expect(saved.performance).toEqual(initial.performance);
  }
  await preferences.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  const saved = await state(page);
  expect(saved.sessions).toEqual(initial.sessions);
  expect(saved.profile).toEqual({ ...initial.profile, presentationMode: 'athlete' });
  await expect(page.locator('.onboarding-dialog')).toHaveCount(0);
});

test('editing training preferences keeps an established weekly plan unless replacement is explicitly selected', async ({ page }) => {
  const initial = await seedLegacy(page);
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Training preferences', exact: true }).click();
  await page.locator('.onboarding-choice').filter({ hasText: 'Build muscle' }).click();
  await next(page); await next(page);
  const replacement = page.getByRole('checkbox', { name: /Apply a new starting plan/ });
  await expect(replacement).not.toBeChecked();
  await page.getByRole('button', { name: 'Save preferences', exact: true }).click();
  await expect(page.locator('.onboarding-dialog')).toHaveCount(0);
  const saved = await state(page);
  expect(saved.profile.plan).toEqual(initial.profile.plan);
  expect(saved.profile.bodyWeight).toBe(initial.profile.bodyWeight);
  expect(saved.profile.customWorkouts).toEqual(initial.profile.customWorkouts);
  expect(saved.sessions).toEqual(initial.sessions);
  expect(saved.nutrition).toEqual(initial.nutrition);
  expect(saved.reminders).toEqual(initial.reminders);
  expect(saved.performance).toEqual(initial.performance);
  expect(saved.profile.trainingPreferences.goal).toBe('muscle');
});
