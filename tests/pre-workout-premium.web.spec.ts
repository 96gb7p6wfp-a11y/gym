import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-14';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const gate = (page: Page) => page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
async function seed(page: Page, { unknown = false, custom = false, stalePoor = false } = {}) {
  const guidance = { impact: unknown ? 'unknown' as const : 'cleared' as const,
    heavyLifting: unknown ? 'unknown' as const : 'cleared' as const, note: 'Isolated QA guidance only.' };
  const week = createV9VolleyballMasterPlan();
  const personal = structuredClone(week[5]);
  const leg = personal.exercises.find(exercise => exercise.name === 'Leg Press')!;
  Object.assign(leg, { sets: 4, defaultKg: 72.5 });
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: week,
    appearance: 'dark', presentationMode: 'athlete', trainingGuidance: guidance,
    masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [], calendarMatches: [], clearance: guidance,
      dailyReadiness: stalePoor ? [{ date: DATE, feeling: 'poor' }] : [] },
    ...(custom ? { sessionDrafts: [{ date: DATE, slot: 'main', plan: personal, customized: true, readiness: 'green',
      reviewedForCoach: 1, reviewedForProgram: { revision: '9', programSessionId: personal.programSessionId } }] } : {}) });
  const history = SessionSchema.parse(stopSessionTimers(createSession(week[5], 5, '2026-11-07', profile, []), 'completed'));
  Object.assign(history.exercises.find(exercise => exercise.name === 'Leg Press')!.logs[0], { done: true, kg: 70, reps: 6, rir: 2 });
  const state = { schemaVersion: 1, profile, profileVersion: 4, sessions: [{ session: history, version: 2 }],
    nutrition: [{ id: 'qa-preflight-weight', date: DATE, version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: defaultReminderState(), performance: { jumps: [], readiness: [] }, performanceVersion: 1 };
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), state);
  await page.reload();
  return state;
}
async function open(page: Page) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Start (?:adjusted )?workout$/, exact: false }).click();
  await expect(gate(page)).toBeVisible();
}
async function answer(page: Page, { tired = false, poor = false, warm = true } = {}) {
  if (tired || poor) {
    await gate(page).getByRole('button', { name: 'Not quite', exact: true }).click();
    if (tired) await gate(page).getByRole('button', { name: 'Just tired — lighter training', exact: true }).click();
  } else await gate(page).getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
  await gate(page).getByRole('button', { name: warm ? 'Yes — already warmed up' : 'Not yet', exact: true }).click();
}
const active = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session;
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('the check appears only after Start; choosing answers and cancelling is entirely read-only', async ({ page }) => {
  await seed(page);
  const before = await raw(page);
  await expect(gate(page)).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Daily readiness', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Daily readiness', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(gate(page)).toHaveCount(0);
  await page.getByRole('dialog', { name: 'Workout preview', exact: true }).getByRole('button', { name: 'Start workout', exact: true }).click();
  await answer(page);
  expect(await raw(page)).toBe(before);
  await gate(page).getByRole('button', { name: 'Close', exact: true }).click();
  expect(await raw(page)).toBe(before);
  expect(await active(page)).toBeUndefined();
});

test('fit and already warm starts the complete eligible dose once, replaces stale daily conditions and survives refresh', async ({ page }) => {
  const before = await seed(page, { stalePoor: true });
  await open(page);
  await answer(page);
  await gate(page).getByRole('button', { name: 'Start workout', exact: true }).evaluate(button => {
    for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
  });
  await expect.poll(() => active(page)).toBeTruthy();
  const state = await read(page), session = await active(page);
  expect(session.exercises).toHaveLength(11);
  expect(session.exercises.reduce((sum: number, exercise: { logs: unknown[] }) => sum + exercise.logs.length, 0)).toBe(29);
  expect(session.warmupStatus).toBe('elsewhere');
  expect(session.warmup.every((step: { done: boolean }) => !step.done)).toBe(true);
  expect(session.exercises.every((exercise: { logs: { done: boolean }[] }) => exercise.logs.every(log => !log.done))).toBe(true);
  expect(state.profile.masterProgram.dailyReadiness).toEqual([{ date: DATE, feeling: 'normal' }]);
  expect(state.sessions).toHaveLength(2);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  expect(state.nutrition).toEqual(before.nutrition);
  expect(state.reminders).toEqual(before.reminders);
  await expect(page.getByRole('dialog', { name: 'Warm-up', exact: true })).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(gate(page)).toHaveCount(0);
  expect((await active(page)).id).toBe(session.id);
  expect((await active(page)).exercises).toEqual(session.exercises);
});

test('not warmed up opens specific lower-body preparation and never completes its working sets', async ({ page }) => {
  await seed(page);
  await open(page); await answer(page, { warm: false });
  await gate(page).getByRole('button', { name: 'Quick warm-up', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  await expect(warmup).toContainText(/lower|loading|landing/i);
  await expect(warmup.getByRole('list', { name: 'Quick warm-up exercises', exact: true })).toBeVisible();
  expect(await active(page)).toBeUndefined();
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  expect((await active(page)).warmupStatus).toBe('not-recorded');
});

test('a tired cold start reduces a deliberate date edit exactly once and preserves its full prescription and planned load', async ({ page }) => {
  const before = await seed(page, { custom: true });
  await open(page); await answer(page, { tired: true, warm: false });
  await gate(page).getByRole('button', { name: 'Quick warm-up', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  const first = warmup.getByRole('list', { name: 'Quick warm-up exercises', exact: true }).getByRole('checkbox').first();
  await first.check();
  expect((await read(page)).profile.sessionDrafts[0].plan.exercises).toEqual(before.profile.sessionDrafts![0].plan.exercises);
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page), state = await read(page);
  expect(session.exercises.some((exercise: { name: string }) => /Acceleration|Split-Squat Jump/.test(exercise.name))).toBe(false);
  const leg = session.exercises.find((exercise: { name: string }) => exercise.name === 'Leg Press');
  expect(leg.logs).toHaveLength(3);
  expect(leg.logs.every((log: { kg: number }) => log.kg === 72.5)).toBe(true);
  expect(state.profile.sessionDrafts[0].plan.exercises).toEqual(before.profile.sessionDrafts![0].plan.exercises);
  expect(state.profile.sessionDrafts[0].readiness).toBe('green');
  expect(state.profile.plan).toEqual(before.profile.plan);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
});

test('Not quite defaults to recovery while a positive answer cannot grant medical clearance', async ({ page }) => {
  const before = await seed(page, { unknown: true });
  await open(page); await answer(page);
  await expect(gate(page)).toContainText('Your saved guidance still limits');
  await gate(page).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page);
  expect(session.name).toContain('Easy Preparation');
  expect(session.exercises).toHaveLength(9);
  expect(session.exercises.every((exercise: { sets: number; preparationOnly: boolean }) => exercise.sets <= 2 && exercise.preparationOnly)).toBe(true);
  expect((await read(page)).profile.trainingGuidance).toEqual(before.profile.trainingGuidance);
});

test('feeling unwell offers recovery instead of starting heavy or high-impact work', async ({ page }) => {
  await seed(page);
  await open(page); await answer(page, { poor: true });
  await expect(gate(page).getByRole('button', { name: 'Recovery', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await gate(page).getByRole('button', { name: 'Start recovery', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  expect((await active(page)).kind).toBe('recovery');
  expect((await active(page)).exercises).toEqual([]);
});

test('new guidance and a deliberate custom edit saved elsewhere during preparation are retained at actual start', async ({ page }) => {
  const before = await seed(page, { custom: true });
  await open(page); await answer(page, { warm: false });
  await gate(page).getByRole('button', { name: 'Quick warm-up', exact: true }).click();
  const warmup = page.getByRole('dialog', { name: 'Warm-up', exact: true });
  await expect(warmup).toBeVisible();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('setline.gym.v1')!);
    state.profile.trainingGuidance = { impact: 'restricted', heavyLifting: 'unknown', note: 'A newly saved isolated QA limit.' };
    state.profile.masterProgram.clearance = state.profile.trainingGuidance;
    state.profile.sessionDrafts[0].plan.exercises.find((exercise: { name: string }) => exercise.name === 'Leg Press').defaultKg = 80;
    state.profileVersion++;
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
  });
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect.poll(() => active(page)).toBeTruthy();
  const session = await active(page), state = await read(page);
  expect(session.name).toContain('Easy Preparation');
  expect(session.exercises.every((exercise: { preparationOnly: boolean; logs: { kg: number }[] }) => exercise.preparationOnly && exercise.logs.every(log => log.kg === 0))).toBe(true);
  expect(state.profile.sessionDrafts[0].plan.exercises.find((exercise: { name: string }) => exercise.name === 'Leg Press').defaultKg).toBe(80);
  expect(state.profile.trainingGuidance).toMatchObject({ impact: 'restricted', heavyLifting: 'unknown' });
  expect(state.profile.plan).toEqual(before.profile.plan);
});
