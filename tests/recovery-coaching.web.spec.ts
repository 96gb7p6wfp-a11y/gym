import { finishWarmup } from './helpers/navigation';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createVolleyballMasterPlan, MasterProgramSettingsSchema } from '../src/volleyball-master-plan';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';

const STORE = 'setline.gym.v1';
const SUNDAY = '2026-10-25';

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

async function seed(page: Page, options: {
  appearance?: 'light' | 'dark';
  jumps?: { id: string; date: string; type: 'approach'; measurement: 'height' | 'touch'; cm: number; notes: string }[];
  sessions?: { session: unknown; version: number }[];
} = {}) {
  const profile = ProfileSchema.parse({
    ...structuredClone(DEFAULT_PROFILE),
    appearance: options.appearance ?? 'light',
    plan: createVolleyballMasterPlan(),
    preMasterPlan: structuredClone(DEFAULT_PROFILE.plan),
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    masterProgram: MasterProgramSettingsSchema.parse({ version: 1, revision: '8.1', startDate: '2026-10-19', matchWeeks: [] }),
  });
  await page.evaluate(({ key, profile, jumps, sessions }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions, nutrition: [], activities: [],
    performance: { jumps, readiness: [] }, performanceVersion: 1,
  })), { key: STORE, profile, jumps: options.jumps ?? [], sessions: options.sessions ?? [] });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${SUNDAY}T10:00:00Z`) });
  await page.goto('/');
});

test('Progress leads with a truthful next step before the first recorded jump', async ({ page }) => {
  await seed(page);
  const before = await state(page);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
  const summary = overview.getByRole('region', { name: 'Progress summary', exact: true });
  await expect(summary).toHaveText('Your baseline starts here. Log a jump height, then repeat the same test.');
  const controls = overview.getByRole('group', { name: 'Chart metric', exact: true });
  expect((await summary.boundingBox())!.y + (await summary.boundingBox())!.height)
    .toBeLessThanOrEqual((await controls.boundingBox())!.y);
  await expect(summary).not.toContainText(/improved|up \d|\+\d|%/);
  await expect(overview.getByRole('button', { name: 'Log jump', exact: true })).toHaveCount(1);
  expect(await state(page), 'Reading coaching must not create performance records or edit the plan').toEqual(before);
});

test('Progress explains the measured jump improvement and one quality-focused next step', async ({ page }) => {
  await seed(page, { appearance: 'dark', jumps: [
    { id: '18a4f1ed-e92e-45e3-ae06-c24f3640e021', date: '2026-10-20', type: 'approach', measurement: 'height', cm: 65, notes: '' },
    { id: '18a4f1ed-e92e-45e3-ae06-c24f3640e022', date: SUNDAY, type: 'approach', measurement: 'height', cm: 67.5, notes: '' },
  ] });
  const before = await state(page);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
  const summary = overview.getByRole('region', { name: 'Progress summary', exact: true });
  await expect(summary).toHaveText('Approach jump is up 2.5 cm; broader strength trends are still forming. Keep training consistent and compare your key lifts next.');
  await expect(overview.getByRole('region', { name: 'Jump performance', exact: true })).toContainText('67.5');
  await expect(overview.getByRole('img', { name: /Approach jump trend: 65 to 67.5 centimetres/ })).toBeVisible();
  expect(await state(page)).toEqual(before);
});

test('one calf gain does not become an overall improvement verdict', async ({ page }) => {
  const calf = { ...toPlanExercise(findLibraryExercise('Standing Calf Raise')!), sets: 1 };
  const sessions = ['2026-10-20', SUNDAY].map((date, index) => {
    const plan = { name: 'Calf strength', kind: 'strength', minutes: 20, note: '', exercises: [calf] };
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan, index === 0 ? 1 : 6, date, DEFAULT_PROFILE, []), 'completed'));
    session.elapsedMs = 1200000;
    Object.assign(session.exercises[0].logs[0], { done: true, kg: index === 0 ? 40 : 45, reps: 8 });
    return { session, version: 1 };
  });
  await seed(page, { sessions });
  const before = await state(page);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Progress summary', exact: true });
  await expect(summary).toContainText('overall trends are still forming');
  await expect(summary).toContainText('Track several key lifts');
  await expect(summary).not.toContainText('Standing Calf Raise');
  await expect(summary).not.toContainText(/overall (?:strength|fitness|performance) (?:is |has )?(?:up|improv)|jump is (?:up|improv)/i);
  expect(await state(page), 'An overall summary must not invent additional performance records').toEqual(before);
});

test('an empty recovery day starts real stretches and persists them without creating gym sets', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.setSystemTime(new Date('2026-10-24T10:00:00Z'));
  await seed(page, { appearance: 'dark' });
  const before = await state(page);
  const cover = page.getByRole('region', { name: 'Your day', exact: true });
  await expect(cover.locator('[aria-label="Today motivation"]')).toHaveText('Easy movement today, fresher legs for your next jump.');
  await expect(cover.locator('[aria-label="Today motivation"]')).toBeVisible();
  const start = cover.getByRole('button', { name: 'Start recovery', exact: true });
  await expect(start).toBeEnabled();
  await start.tap();
  await finishWarmup(page);
  await expect(page.getByRole('tab', { name: 'Train', exact: true })).toHaveAttribute('data-state', 'active');
  const routine = page.getByRole('region', { name: 'Recovery session', exact: true });
  await expect(routine).toBeVisible();
  await expect(routine).toContainText('Recovery mobility & stretching');
  const firstMovement = routine.getByRole('checkbox', { name: 'Complete Gastrocnemius Stretch in cooldown', exact: true });
  await expect(firstMovement).toBeVisible();
  const firstBounds = (await firstMovement.boundingBox())!;
  const navigationBounds = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
  expect(firstBounds.width).toBeGreaterThanOrEqual(44);
  expect(firstBounds.height).toBeGreaterThanOrEqual(44);
  expect(firstBounds.y + firstBounds.height, 'The first recovery movement must be reachable without scrolling').toBeLessThanOrEqual(navigationBounds.y);
  const hipFlexor = routine.getByRole('checkbox', { name: 'Complete Hip Flexor Stretch in cooldown', exact: true });
  await expect(hipFlexor).toBeVisible();
  await expect(hipFlexor).toBeEnabled();
  await hipFlexor.check();
  await expect.poll(async () => {
    const saved = await state(page);
    return saved.sessions[0]?.session.cooldown?.some((item: any) => item.name === 'Hip Flexor Stretch' && item.done);
  }).toBe(true);
  const saved = (await state(page)).sessions[0].session;
  expect(saved).toMatchObject({ date: '2026-10-24', kind: 'recovery', status: 'active', exercises: [] });
  expect((await state(page)).profile.plan).toEqual(before.profile.plan);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(routine.getByRole('checkbox', { name: 'Complete Hip Flexor Stretch in cooldown', exact: true })).toBeChecked();
  await expect(page.locator('.native-session-prescription')).not.toContainText(/0\s*\/\s*0|0 sets/);

  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('12');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  const complete = page.getByRole('region', { name: 'Workout complete summary', exact: true });
  await expect(complete).toBeVisible();
  await expect(complete).not.toContainText('No completed sets recorded');
  const completed = (await state(page)).sessions[0].session;
  expect(completed).toMatchObject({ kind: 'recovery', status: 'completed', exercises: [], elapsedMs: 720000 });
  expect(completed.cooldown.find((item: any) => item.name === 'Hip Flexor Stretch').done).toBe(true);
  expect((await state(page)).profile.plan).toEqual(before.profile.plan);
});

test('finishing a workout offers real stretches and saves checks onto that completed snapshot', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, { appearance: 'dark' });
  const plan = (await state(page)).profile.plan;
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const exercise = page.getByRole('region', { name: 'Current exercise', exact: true });
  await exercise.getByRole('textbox', { name: 'Medicine Ball Spike Slam set 1 weight in kilograms', exact: true }).fill('3');
  await exercise.getByRole('spinbutton', { name: 'Medicine Ball Spike Slam set 1 reps', exact: true }).fill('3');
  await exercise.getByRole('button', { name: 'Complete Medicine Ball Spike Slam set 1', exact: true }).tap();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('60');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  const complete = page.getByRole('region', { name: 'Workout complete summary', exact: true });
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: 'Workout complete' })).toHaveCount(0);
  await complete.getByRole('button', { name: 'Stretch now', exact: true }).click();
  const stretch = page.getByRole('dialog', { name: 'Stretch routine', exact: true });
  await expect(stretch).toBeVisible();
  await expect(stretch.getByRole('heading', { name: 'Stretch routine', exact: true })).toBeVisible();
  const close = stretch.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeVisible();
  await expect.poll(() => close.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const target = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return bounds.y >= 47 && bounds.width >= 44 && bounds.height >= 44 && target !== null && element.contains(target);
  }), { message: 'The stretch Close must remain a safe, unobscured touch target' }).toBe(true);
  await expect(stretch).toContainText('Cross-Body Shoulder Stretch');
  const check = stretch.getByRole('checkbox', { name: 'Complete Cross-Body Shoulder Stretch in cooldown', exact: true });
  await check.check();
  await expect.poll(async () => (await state(page)).sessions[0].session.cooldown
    .some((item: any) => item.name === 'Cross-Body Shoulder Stretch' && item.done)).toBe(true);
  const saved = (await state(page)).sessions[0].session;
  expect(saved).toMatchObject({ kind: 'strength', status: 'completed', elapsedMs: 3600000, runningSince: null });
  expect(saved.exercises[0].logs[0]).toMatchObject({ kg: 3, reps: 3, done: true });
  expect((await state(page)).sessions).toHaveLength(1);
  expect((await state(page)).profile.plan).toEqual(plan);
  await close.click();
  await page.reload();
  expect((await state(page)).sessions[0].session).toEqual(saved);
});

test('a restored walk-only recovery keeps its old check while making real stretches usable', async ({ page }) => {
  const session = SessionSchema.parse(createSession({ name: 'Recovery', kind: 'recovery', minutes: 20, note: 'Legacy recovery prescription.', exercises: [], cooldown: [
    { key: 'old-walk', name: 'Easy Walk + Breathing', target: '3–5 min', cue: 'Easy movement.', done: false },
  ] }, 6, SUNDAY, DEFAULT_PROFILE, []));
  session.runningSince = null;
  session.cooldown![0].done = true;
  await seed(page, { sessions: [{ session, version: 1 }] });
  const before = await state(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const recovery = page.getByRole('region', { name: 'Recovery session', exact: true });
  await expect(recovery.getByRole('checkbox', { name: 'Complete Easy Walk + Breathing in cooldown', exact: true })).toBeChecked();
  const hipFlexor = recovery.getByRole('checkbox', { name: 'Complete Hip Flexor Stretch in cooldown', exact: true });
  await expect(hipFlexor).toBeVisible();
  expect(await state(page), 'Opening a legacy record must not silently rewrite its snapshot').toEqual(before);
  await hipFlexor.check();
  await expect.poll(async () => (await state(page)).sessions[0].session.cooldown
    .some((item: any) => item.name === 'Hip Flexor Stretch' && item.done)).toBe(true);
  const saved = (await state(page)).sessions[0].session;
  expect(saved.cooldown.find((step: any) => step.key === 'old-walk')).toEqual(session.cooldown![0]);
  expect(saved).toMatchObject({ id: session.id, kind: 'recovery', status: 'active', exercises: [], runningSince: null });
  expect((await state(page)).sessions).toHaveLength(1);
  expect((await state(page)).profile.plan).toEqual(before.profile.plan);
  await recovery.getByRole('button', { name: 'Add exercise', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Add exercise', exact: true });
  await library.getByRole('searchbox', { name: 'Search exercises', exact: true }).fill('Wall Slide');
  await library.getByRole('button', { name: 'Select Wall Slide', exact: true }).click();
  await page.locator('.exercise-library-sheet').getByRole('button', { name: 'Add exercise', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true }).getByRole('heading', { name: 'Wall Slide', exact: true })).toBeVisible();
  const customized = (await state(page)).sessions[0].session;
  expect(customized).toMatchObject({ id: session.id, kind: 'recovery', status: 'active' });
  expect(customized.exercises).toHaveLength(1);
  expect(customized.cooldown).toEqual(saved.cooldown);
  expect((await state(page)).profile.plan).toEqual(before.profile.plan);
});

test('volleyball has a simple reflection without requiring or inventing a completed gym set', async ({ page }) => {
  await seed(page);
  const plan = (await state(page)).profile.plan;
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Tue / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const reflection = page.getByRole('textbox', { name: 'Volleyball reflection', exact: true });
  await expect(reflection).toBeVisible();
  await reflection.fill('Approach felt quick today. Next time: calmer serve receive.');
  await expect.poll(async () => (await state(page)).sessions[0]?.session.notes).toBe('Approach felt quick today. Next time: calmer serve receive.');
  await expect(page.locator('.native-session-prescription')).not.toContainText(/0\s*\/\s*1 sets|0 sets/);
  const saved = (await state(page)).sessions[0].session;
  expect(saved).toMatchObject({ kind: 'sport', status: 'active', notes: 'Approach felt quick today. Next time: calmer serve receive.' });
  // The tracker retains its editable 120-minute prescription. It must remain
  // unchecked; reflecting on training must never turn that target into a log.
  expect(saved.exercises[0].logs[0].done).toBe(false);
  expect((await state(page)).profile.plan).toEqual(plan);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(reflection).toHaveValue(saved.notes);
  const trainingLog = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: /^Training log$/ }) });
  await expect(trainingLog).not.toHaveAttribute('open');
  await trainingLog.locator(':scope > summary').click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('120');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  const complete = page.getByRole('region', { name: 'Workout complete summary', exact: true });
  await expect(complete).toContainText('Training recorded');
  const completed = (await state(page)).sessions[0].session;
  expect(completed).toMatchObject({ kind: 'sport', status: 'completed', notes: saved.notes, elapsedMs: 7200000 });
  expect(completed.exercises[0].logs[0]).toEqual(saved.exercises[0].logs[0]);
  expect((await state(page)).profile.plan).toEqual(plan);
});

test('set encouragement acknowledges a logged set without interrupting the next action', async ({ page }) => {
  await seed(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  const cue = current.getByRole('status', { name: 'Set focus', exact: true });
  await expect(cue.getByText('Coach', { exact: true })).toBeVisible();
  await expect(cue).toContainText('Fast, fresh reps. Stop if height or speed drops.');
  await current.getByRole('textbox', { name: 'Medicine Ball Spike Slam set 1 weight in kilograms', exact: true }).fill('3');
  await current.getByRole('spinbutton', { name: 'Medicine Ball Spike Slam set 1 reps', exact: true }).fill('3');
  await current.getByRole('button', { name: 'Complete Medicine Ball Spike Slam set 1', exact: true }).tap();
  await expect(cue).toContainText('Set 1 of 3 logged. One step at a time.');
  await expect(current.getByRole('button', { name: 'Complete Medicine Ball Spike Slam set 2', exact: true })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.rest-floating')).toBeVisible();
  expect((await state(page)).sessions[0].session.exercises[0].logs.filter((log: any) => log.done)).toHaveLength(1);
});
