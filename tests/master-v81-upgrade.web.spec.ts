import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { defaultReminderState } from '../src/reminders';
import { openSection, finishWarmup } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const program = (page: Page) => page.getByRole('region', { name: '8-week volleyball-first program', exact: true });

async function openPlan(page: Page) {
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'Training plan', exact: true }).click();
  const options = page.locator('.native-program-options');
  if (!await options.evaluate(element => element.hasAttribute('open'))) await options.locator(':scope > summary').click();
}

/** A genuine legacy-style personal prescription, not the new factory relabelled as old. */
async function seedLegacy(page: Page, active = false) {
  const plan = structuredClone(DEFAULT_PROFILE.plan);
  plan[0] = { name: 'My custom upper', kind: 'strength', minutes: 45, note: 'My existing personal setup.',
    exercises: [{ ...toPlanExercise(findLibraryExercise('Chest-Supported Row')!), sets: 4, target: '8 reps', defaultKg: 42.5 }] };
  plan[5] = { name: 'My Saturday lower', kind: 'strength', minutes: 70, note: 'Previous Saturday prescription.',
    exercises: [{ ...toPlanExercise(findLibraryExercise('Leg Press')!), sets: 4, target: '6 reps', defaultKg: 100 }] };
  plan[6] = { name: 'Recovery', kind: 'recovery', minutes: 20, note: 'Old Sunday recovery.', exercises: [] };
  const matchWeekend = [
    { name: 'My easy primer', kind: 'strength', minutes: 20, note: 'Custom match preparation.',
      exercises: [{ ...toPlanExercise(findLibraryExercise('Approach Jump')!), sets: 2, target: '1 rep' }] },
    { name: 'Match', kind: 'sport', minutes: 90, note: 'Actual time not set.',
      exercises: [{ ...toPlanExercise(findLibraryExercise('Volleyball practice')!), sets: 1, target: '90 min' }] },
  ];
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan, appearance: 'dark',
    masterProgram: { version: 1, startDate: '2026-10-05', matchWeeks: [2, 4, 7],
      readiness: [{ date: '2026-10-28', status: 'green' }] },
    preMasterPlan: structuredClone(DEFAULT_PROFILE.plan), masterMatchWeekend: matchWeekend,
    timerSoundEnabled: true, timerSoundVolume: 0.35,
    customWorkouts: [{ ...plan[0], id: '83b5449d-466b-409d-909d-bb2603f41d24', name: 'My saved travel workout' }],
    sessionDrafts: [
      { date: '2026-11-02', slot: 'main', plan: { ...plan[0], name: 'My dated adjustment' }, customized: true },
      { date: '2026-11-04', slot: 'main', plan: plan[2], customized: false },
    ],
  });
  const old = SessionSchema.parse(stopSessionTimers(createSession(plan[0], 0, '2026-10-12', profile, []), 'completed'));
  old.exercises[0].logs[0] = { ...old.exercises[0].logs[0], kg: 42.5, reps: 8, done: true };
  old.elapsedMs = 45 * 60_000;
  const sessions = [{ session: old, version: 3 }];
  if (active) sessions.push({ session: SessionSchema.parse(createSession(plan[0], 2, '2026-10-28', profile, [])), version: 2 });
  const data = { schemaVersion: 1, profile, profileVersion: 5, sessions,
    nutrition: [{ id: 'old-weight', date: '2026-10-27', version: 1, payload: { kind: 'weight', kg: 64.4 } }],
    activities: [{ version: 2, activity: { id: 'saved-strava-run', date: '2026-10-22', type: 'run', name: 'Easy school run',
      durationMinutes: 30, distanceKm: 5, intensity: 'easy', bodyWeightKg: 64, watchCalories: null, notes: 'Imported once.', createdAt: 1792663200000, deletedAt: null,
      importSource: { provider: 'strava', format: 'csv', externalId: 'strava-123', fingerprint: 'saved-run-fingerprint' } } }],
    reminders: defaultReminderState(),
    performanceVersion: 2, performance: { jumps: [{ id: '83b5449d-466b-409d-909d-bb2603f41d25', date: '2026-10-23', type: 'approach', measurement: 'height', cm: 81.5, notes: 'Measured wall test.' }], readiness: [] },
  };
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), { key: STORE, data });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
}

async function reviewUpgrade(page: Page) {
  await openPlan(page);
  await program(page).getByRole('button', { name: 'Upgrade to V8.1', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Upgrade to V8.1', exact: true });
  await expect(review).toBeVisible();
  return review;
}
async function applyUpgrade(page: Page) {
  const review = await reviewUpgrade(page);
  await review.getByRole('button', { name: 'Apply V8.1', exact: true }).click();
  await expect(review).not.toBeVisible();
  await expect.poll(async () => (await read(page)).profile.masterProgram.revision).toBe('8.1');
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-28T11:00:00Z') });
  await page.goto('/');
});

test('the V8.1 schedule can be inspected and dismissed without changing a legacy personal program', async ({ page }) => {
  await seedLegacy(page);
  const before = await read(page);
  const review = await reviewUpgrade(page);
  await expect(review).toContainText('Heavy Lower B');
  await expect(review).toContainText('Sunday');
  await expect(review).toContainText('Recovery');
  await expect(review).toContainText('Pre-Match Primer');
  await review.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await read(page)).toEqual(before);
});

test('Today exposes V8.1 directly and applying it shows the new Sunday workout without nested menus', async ({ page }) => {
  await seedLegacy(page);
  const before = await read(page);
  const action = page.getByRole('button', { name: /^V8.1 is ready Review plan/ });
  await expect(action).toBeVisible();
  await action.click();
  const review = page.getByRole('dialog', { name: 'Upgrade to V8.1', exact: true });
  await expect(review).toBeVisible();
  expect(await read(page)).toEqual(before);
  await review.getByRole('button', { name: 'Apply V8.1', exact: true }).click();
  await expect(review).not.toBeVisible();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('button', { name: /^V8.1 is ready/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Heavy Lower B');
  expect((await read(page)).sessions).toEqual(before.sessions);
});

test('an older active workout clearly explains why it keeps its saved prescription after applying V8.1', async ({ page }) => {
  await seedLegacy(page, true);
  await applyUpgrade(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByText('V8.1 applies to your next workout. This session keeps its original plan.', { exact: true })).toBeVisible();
  await expect(page.locator('.session-card h2')).toHaveText('My custom upper');
});

test('an athlete without an active program can start V8.1 this week from the visible Today action', async ({ page }) => {
  await seedLegacy(page);
  await page.evaluate(key => {
    const data = JSON.parse(localStorage.getItem(key)!);
    delete data.profile.masterProgram;
    localStorage.setItem(key, JSON.stringify(data));
  }, STORE);
  await page.reload();
  const before = await read(page);
  await page.getByRole('button', { name: /^V8.1 is ready Review plan/ }).click();
  await expect(program(page).getByLabel('Start Monday', { exact: true })).toHaveValue('2026-10-26');
  await program(page).getByRole('button', { name: 'Use this plan', exact: true }).click();
  await expect.poll(async () => (await read(page)).profile.masterProgram.revision).toBe('8.1');
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Main Jump + Heavy Lower A');
  expect((await read(page)).profile.preMasterPlan).toEqual(before.profile.plan);
  expect((await read(page)).sessions).toEqual(before.sessions);
});

test('an explicit upgrade keeps cycle, match weeks, date edits and every historical and active record intact', async ({ page }) => {
  await seedLegacy(page, true);
  const before = await read(page);
  await applyUpgrade(page);
  const after = await read(page);
  expect(after.profile.masterProgram).toEqual({ ...before.profile.masterProgram, revision: '8.1' });
  expect(after.profile.masterProgramBackup.plan).toEqual(before.profile.plan);
  expect(after.profile.masterProgramBackup.masterMatchWeekend).toEqual(before.profile.masterMatchWeekend);
  expect(after.profile.preMasterPlan).toEqual(before.profile.preMasterPlan);
  expect(after.profile.sessionDrafts).toEqual([before.profile.sessionDrafts[0]]);
  expect(after.profile.customWorkouts).toEqual(before.profile.customWorkouts);
  expect(after.profile.timerSoundVolume).toBe(0.35);
  expect(after.profile.appearance).toBe('dark');
  expect(after.profile.plan[5].kind).toBe('recovery');
  expect(after.profile.plan[6].name).toBe('Heavy Lower B');
  expect(after.sessions).toEqual(before.sessions);
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.activities).toEqual(before.activities);
  expect(after.reminders).toEqual(before.reminders);
  expect(after.performance).toEqual(before.performance);
  expect(after.performanceVersion).toEqual(before.performanceVersion);
  await page.reload();
  const persisted = await read(page);
  expect(persisted.sessions).toEqual(before.sessions);
  expect(persisted.profile.masterProgramBackup).toEqual(after.profile.masterProgramBackup);
});

test('the athlete can restore the previous customized program after upgrade without losing records', async ({ page }) => {
  await seedLegacy(page, true);
  const before = await read(page);
  await applyUpgrade(page);
  await program(page).getByRole('button', { name: 'Restore previous program', exact: true }).click();
  const restore = page.getByRole('alertdialog', { name: 'Restore your previous program?', exact: true });
  await restore.getByRole('button', { name: 'Restore previous program', exact: true }).click();
  await expect(restore).not.toBeVisible();
  const after = await read(page);
  expect(after.profile.plan).toEqual(before.profile.plan);
  expect(after.profile.masterProgram).toEqual(before.profile.masterProgram);
  expect(after.profile.masterMatchWeekend).toEqual(before.profile.masterMatchWeekend);
  expect(after.profile.customWorkouts).toEqual(before.profile.customWorkouts);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.activities).toEqual(before.activities);
  expect(after.nutrition).toEqual(before.nutrition);
  expect(after.performance).toEqual(before.performance);
});

test('future Train preview uses the right match branch while Today remains the actual Wednesday', async ({ page }) => {
  await seedLegacy(page); await applyUpgrade(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sun / }).click();
  await expect(page.locator('.session-card h2')).toContainText('Match');
  const before = await read(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview).toContainText('1 Nov');
  await expect(preview).not.toContainText('Heavy Lower B');
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.locator('.page-header')).toContainText(/Wednesday,? 28 October/);
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Main Jump + Heavy Lower A');
  expect(await read(page)).toEqual(before);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Heavy Lower B');
});

test('optional Thursday work stays collapsed and adds no sets unless deliberately enabled', async ({ page }) => {
  await seedLegacy(page); await applyUpgrade(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: /^Thu / }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  const required = preview.getByRole('list', { name: 'Scheduled exercises', exact: true });
  await expect(required).not.toContainText('Plyometric Push-up');
  await expect(required).not.toContainText('Hammer Curl');
  await expect(preview.getByRole('button', { name: 'Include Plyometric Push-up', exact: true })).not.toBeVisible();
  await preview.locator('summary').filter({ hasText: 'Optional work' }).click();
  await preview.getByRole('button', { name: 'Include Plyometric Push-up', exact: true }).click();
  await expect(required).toContainText('Plyometric Push-up');
  const before = await read(page);
  await preview.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const active = (await read(page)).sessions.find((row: any) => row.session.status === 'active').session;
  expect(active.exercises.find((exercise: any) => exercise.name === 'Plyometric Push-up').logs).toHaveLength(2);
  expect(active.exercises.some((exercise: any) => /Hammer Curl|Triceps Pushdown/.test(exercise.name))).toBe(false);
  expect((await read(page)).sessions.filter((row: any) => row.session.status === 'completed')).toEqual(before.sessions);
});


test('a completed eight-week block waits for an explicit next-block action', async ({ page }) => {
  await page.clock.setSystemTime(new Date('2026-12-01T11:00:00Z'));
  await seedLegacy(page); await applyUpgrade(page);
  const before = await read(page);
  await expect(program(page)).toContainText('Block complete');
  await expect(program(page).getByRole('button', { name: 'Plan next block', exact: true })).toBeVisible();
  expect((await read(page)).profile.masterProgram.startDate).toBe('2026-10-05');
  await program(page).getByRole('button', { name: 'Plan next block', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Plan the next block?', exact: true });
  await expect(confirmation).toBeVisible();
  expect((await read(page)).profile.masterProgram.startDate).toBe(before.profile.masterProgram.startDate);
  await confirmation.getByRole('button', { name: 'Start next block', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect.poll(async () => (await read(page)).profile.masterProgram.startDate).not.toBe(before.profile.masterProgram.startDate);
  const after = await read(page);
  expect(new Date(`${after.profile.masterProgram.startDate}T12:00:00Z`).getUTCDay()).toBe(1);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.performance).toEqual(before.performance);
});
