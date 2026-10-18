import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { openDisclosure } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-10-19';
const SHOULDER = 'Cable Lateral Raise';

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

function shoulderPlan(mixed = false) {
  return {
    name: mixed ? 'Shoulders + lower' : 'Shoulder strength', kind: 'strength', goal: 'hypertrophy',
    minutes: 25, note: '', exercises: [SHOULDER, ...(mixed ? ['Hack Squat'] : [])]
      .map(name => ({ ...toPlanExercise(findLibraryExercise(name)!), sets: 1, defaultKg: 6 })),
  };
}

async function seed(page: Page, options: { mixed?: boolean; session?: unknown; appearance?: 'light' | 'dark' } = {}) {
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.plan[0] = shoulderPlan(options.mixed);
  const parsed = ProfileSchema.parse({ ...profile, appearance: options.appearance ?? 'light' });
  await page.evaluate(({ key, profile, session }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1,
    sessions: session ? [{ session, version: 1 }] : [], nutrition: [], activities: [],
  })), { key: STORE, profile: parsed, session: options.session });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

async function openWarmup(page: Page) {
  await openDisclosure(page, 'Session tools');
  const warmup = page.locator('.routine-panel').filter({ hasText: 'Dynamic warm-up' });
  const trigger = warmup.locator('[data-slot="accordion-trigger"]');
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  return warmup;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('a shoulder-only session offers shoulder preparation and stretches without unrelated leg defaults', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { appearance: 'dark' });
  const before = await state(page);
  const cover = page.getByRole('region', { name: 'Your day', exact: true });
  await expect(cover.locator('[aria-label="Today motivation"]')).toBeVisible();
  await cover.getByRole('button', { name: 'Start workout', exact: true }).click();
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  const coach = current.getByRole('status', { name: 'Set focus', exact: true });
  await expect(coach.getByText('Coach', { exact: true })).toBeVisible();
  await expect(current.getByRole('button', { name: `Exercise details for ${SHOULDER}`, exact: true })).toBeVisible();
  expect(await current.locator('.focused-effort').evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth)),
    'Exercise details should not be followed by an unnecessary divider').toBe(0);

  const warmup = await openWarmup(page);
  await expect(warmup).toContainText('Arm Circles');
  await expect(warmup).toContainText('Wall Slide');
  await expect(warmup).toContainText('Light Rehearsal Sets');
  await expect(warmup).not.toContainText(/Ankle Knee-to-Wall|Walking Lunge|Hip Switch|Pogo/);
  const wallSlide = warmup.getByRole('checkbox', { name: 'Complete Wall Slide in warmup', exact: true });
  await wallSlide.check();
  await expect.poll(async () => (await state(page)).sessions[0].session.warmup.some((step: any) => step.name === 'Wall Slide' && step.done)).toBe(true);
  await page.locator('.stretch-shortcut').click();
  const stretch = page.getByRole('dialog', { name: 'Stretch routine', exact: true });
  await expect(stretch).toContainText('Cross-Body Shoulder Stretch');
  await expect(stretch).not.toContainText(/Gastrocnemius|Hip Flexor Stretch|Glute Stretch|Soleus/);
  const shoulderStretch = stretch.getByRole('checkbox', { name: 'Complete Cross-Body Shoulder Stretch in cooldown', exact: true });
  await expect.poll(() => shoulderStretch.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const sheet = element.closest('[role="dialog"]')!.getBoundingClientRect();
    const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return bounds.width >= 44 && bounds.height >= 44 && bounds.y >= 47 && bounds.bottom <= sheet.bottom
      && target !== null && element.contains(target);
  }), { message: 'The relevant shoulder stretch must be visible when the sheet first opens on a small iPhone' }).toBe(true);
  await shoulderStretch.check();
  await expect.poll(async () => (await state(page)).sessions[0].session.cooldown.some((step: any) => step.name === 'Cross-Body Shoulder Stretch' && step.done)).toBe(true);
  await stretch.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const restored = await openWarmup(page);
  await expect(restored.getByRole('checkbox', { name: 'Complete Wall Slide in warmup', exact: true })).toBeChecked();
  expect((await state(page)).profile.plan).toEqual(before.profile.plan);
});

test('post-workout stretching follows performed shoulder work rather than skipped lower-body exercises', async ({ page }) => {
  await seed(page, { mixed: true });
  const plan = (await state(page)).profile.plan;
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('textbox', { name: `${SHOULDER} set 1 weight in kilograms`, exact: true }).fill('6');
  await current.getByRole('spinbutton', { name: `${SHOULDER} set 1 reps`, exact: true }).fill('12');
  await current.getByRole('button', { name: `Complete ${SHOULDER} set 1`, exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('25');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await page.getByRole('region', { name: 'Workout complete summary', exact: true }).getByRole('button', { name: 'Stretch now', exact: true }).click();
  const stretch = page.getByRole('dialog', { name: 'Stretch routine', exact: true });
  await expect(stretch).toContainText('Cross-Body Shoulder Stretch');
  await expect(stretch).not.toContainText(/Hip Flexor Stretch|Glute Stretch|Quad Stretch|Gastrocnemius|Soleus/);
  await stretch.getByRole('checkbox', { name: 'Complete Cross-Body Shoulder Stretch in cooldown', exact: true }).check();
  await expect.poll(async () => (await state(page)).sessions[0].session.cooldown.some((step: any) => step.name === 'Cross-Body Shoulder Stretch' && step.done)).toBe(true);
  const session = (await state(page)).sessions[0].session;
  expect(session.exercises[0].logs[0]).toMatchObject({ kg: 6, reps: 12, done: true });
  expect(session.exercises[1].logs.every((log: any) => !log.done)).toBe(true);
  expect((await state(page)).profile.plan).toEqual(plan);
});

test('finishing without set logs keeps planned shoulder stretches available and clearly labelled', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { appearance: 'dark' });
  const plan = (await state(page)).profile.plan;
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('25');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await page.getByRole('region', { name: 'Workout complete summary', exact: true }).getByRole('button', { name: 'Stretch now', exact: true }).click();
  const stretch = page.getByRole('dialog', { name: 'Stretch routine', exact: true });
  await expect(stretch).toContainText('No sets logged. Based on your planned session.');
  const shoulder = stretch.getByRole('checkbox', { name: 'Complete Cross-Body Shoulder Stretch in cooldown', exact: true });
  await expect(shoulder).toBeVisible();
  await expect.poll(() => shoulder.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const sheet = element.closest('[role="dialog"]')!.getBoundingClientRect();
    return bounds.width >= 44 && bounds.height >= 44 && bounds.y >= 47 && bounds.bottom <= sheet.bottom;
  }), { message: 'Planned shoulder stretches should be visible as soon as the sheet opens' }).toBe(true);
  const saved = (await state(page)).sessions[0].session;
  expect(saved).toMatchObject({ status: 'completed', elapsedMs: 1500000 });
  expect(saved.exercises.every((exercise: any) => exercise.logs.every((log: any) => !log.done))).toBe(true);
  expect((await state(page)).profile.plan).toEqual(plan);
});

test('an existing custom routine keeps its text and checked state until an explicit change', async ({ page }) => {
  const session = SessionSchema.parse(createSession(shoulderPlan(), 0, DATE, DEFAULT_PROFILE, []));
  session.runningSince = null;
  session.warmup = [{ key: 'my-shoulder-prep', name: 'My shoulder preparation', target: '6 easy reps', cue: 'Use the version my coach showed me.', done: true }];
  session.cooldown = [{ key: 'my-shoulder-reset', name: 'My shoulder reset', target: '25 sec / side', cue: 'Keep the range comfortable.', done: false }];
  Object.assign(session.exercises[0].logs[0], { kg: 6, reps: 12 });
  await seed(page, { session });
  const before = await state(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const warmup = await openWarmup(page);
  await expect(warmup).toContainText('6 easy reps');
  await expect(warmup).toContainText('Use the version my coach showed me.');
  await expect(warmup.getByRole('checkbox', { name: 'Complete My shoulder preparation in warmup', exact: true })).toBeChecked();
  await page.locator('.stretch-shortcut').click();
  const stretch = page.getByRole('dialog', { name: 'Stretch routine', exact: true });
  await expect(stretch).toContainText('25 sec / side');
  await expect(stretch).toContainText('Keep the range comfortable.');
  expect(await state(page), 'Opening a saved custom routine must not silently rewrite it').toEqual(before);
  await stretch.getByRole('checkbox', { name: 'Complete My shoulder reset in cooldown', exact: true }).check();
  await expect.poll(async () => (await state(page)).sessions[0].session.cooldown[0].done).toBe(true);
  const saved = (await state(page)).sessions[0].session;
  expect(saved.warmup).toEqual(session.warmup);
  expect(saved.cooldown.find((step: any) => step.key === session.cooldown![0].key)).toEqual({ ...session.cooldown[0], done: true });
  expect(saved.exercises).toEqual(session.exercises);
  expect((await state(page)).profile.plan).toEqual(before.profile.plan);
});
