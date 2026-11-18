import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { defaultReminderState } from '../src/reminders';
import { startAlreadyWarmed } from './helpers/navigation';
import { settleWithFrozenClock } from './helpers/frozen-clock';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-16';
// 23:59 in Setline's Berlin calendar. The test deliberately crosses midnight.
const START = new Date('2026-11-16T22:59:45Z');
const NAME = 'Saved bench strength';
const BENCH = 'Barbell Bench Press';
const EQUIPMENT = 'QA Olympic bar · rack A';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const active = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session;
const focus = (page: Page) => page.getByRole('region', { name: 'Current exercise', exact: true });
const row = (page: Page, set: number, exercise = BENCH) => page.getByRole('group', { name: `Quick log ${exercise} set ${set}`, exact: true });
const deadline = (page: Page) => page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));

async function seed(page: Page, { history = false, differentEquipmentOnly = false, unilateral = false } = {}) {
  const catalogue = findLibraryExercise(unilateral ? 'One-arm Dumbbell Row' : BENCH)!;
  const exercise = { ...toPlanExercise(catalogue), key: unilateral ? 'native-unilateral-row' : 'native-bench',
    sets: 3, target: '6–10 reps', rest: 120, defaultKg: null, targetRir: 2,
    equipmentLabel: unilateral ? 'QA dumbbell · bench A' : EQUIPMENT, ...(unilateral ? { perSide: true } : {}) };
  const workout = { name: NAME, kind: 'strength' as const, goal: 'strength' as const, minutes: 75,
    note: 'Isolated QA template, not the owner’s plan or training history.', exercises: [exercise], warmup: [], cooldown: [] };
  const template = { ...workout, id: crypto.randomUUID() };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? workout : structuredClone(day)),
    customWorkouts: [template], appearance: 'dark', presentationMode: 'athlete', restSeconds: 120, timerSoundEnabled: false,
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA settings only.' } });
  const sessions: { session: ReturnType<typeof SessionSchema.parse>; version: number }[] = [];
  if (history) {
    const prior = SessionSchema.parse(stopSessionTimers(createSession(workout, 0, '2026-11-09', profile, []), 'completed'));
    prior.startedAt = Date.parse('2026-11-09T10:00:00Z');
    prior.finishedAt = prior.startedAt + 60 * 60_000;
    prior.elapsedMs = 60 * 60_000;
    prior.exercises[0].logs.forEach(log => Object.assign(log, { kg: unilateral ? 22.5 : 55, reps: 8, rir: 2, done: true }));
    if (!differentEquipmentOnly) sessions.push({ session: prior, version: 3 });
    // A newer record for a different apparatus must not become the suggestion.
    const other = structuredClone(prior);
    other.id = crypto.randomUUID(); other.date = '2026-11-12';
    other.startedAt = Date.parse('2026-11-12T10:00:00Z'); other.finishedAt = other.startedAt + 60 * 60_000;
    other.exercises[0].equipmentLabel = 'QA different apparatus B';
    other.exercises[0].logs.forEach(log => Object.assign(log, { id: crypto.randomUUID(), kg: 80, reps: 5 }));
    sessions.push({ session: other, version: 4 });
  }
  const state = { schemaVersion: 1, profile, profileVersion: 6, sessions,
    nutrition: [{ id: 'native-qa-bodyweight', date: DATE, version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: defaultReminderState(), performance: { jumps: [], readiness: [] }, performanceVersion: 1 };
  await page.evaluate(state => {
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
    sessionStorage.clear();
  }, state);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText(NAME);
  return state;
}

async function start(page: Page) {
  await page.getByRole('region', { name: 'Your day', exact: true }).getByRole('button', { name: 'Start workout', exact: true }).click();
  await settleWithFrozenClock(page, async () => {
    await startAlreadyWarmed(page);
    await expect(focus(page)).toBeVisible();
  });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: START });
  await page.clock.pauseAt(new Date(START.getTime() + 1000));
  await page.goto('/');
});

test('bench 3×6–10 preserves 60×8 then 62.5×7, Undo, rest, midnight recovery and the saved template through a complete workout', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 375, height: 812 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const before = await seed(page);
  await start(page);
  const original = await active(page);
  expect(original.exercises).toHaveLength(1);
  expect(original.exercises[0]).toMatchObject({ exerciseId: 'bench-press', sets: 3, target: '6–10 reps', rest: 120 });
  expect(original.exercises[0].logs.every((log: { done: boolean }) => !log.done)).toBe(true);
  const initialIds = original.exercises[0].logs.map((log: { id: string }) => log.id);
  const weight = (set: number) => focus(page).getByRole('textbox', { name: `${BENCH} set ${set} weight in kilograms`, exact: true });
  const reps = (set: number) => focus(page).getByRole('spinbutton', { name: `${BENCH} set ${set} reps`, exact: true });
  const complete = (set: number) => focus(page).getByRole('button', { name: `Complete ${BENCH} set ${set}`, exact: true });
  await expect(weight(1)).toHaveValue('');
  await weight(1).fill('60'); await reps(1).fill('8');
  await complete(1).evaluate(button => { for (let i = 0; i < 10; i++) (button as HTMLButtonElement).click(); });
  await expect.poll(async () => (await active(page)).exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  await expect(weight(2)).toHaveValue('60'); await expect(reps(2)).toHaveValue('8');
  await weight(2).fill('62.5'); await reps(2).fill('7');
  await complete(2).click();
  await focus(page).getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect.poll(async () => (await active(page)).exercises[0].logs[1]).toMatchObject({ kg: 62.5, reps: 7, done: false });
  await expect(weight(2)).toHaveValue('62.5'); await expect(reps(2)).toHaveValue('7');
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await complete(2).evaluate(button => { for (let i = 0; i < 10; i++) (button as HTMLButtonElement).click(); });
  await expect.poll(async () => (await active(page)).exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, true, false]);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const afterSecond = await active(page), savedDeadline = Number(await deadline(page));
  expect(savedDeadline).toBeGreaterThan(START.getTime());
  const owner = await page.evaluate(() => JSON.parse(sessionStorage.getItem('setline.rest-owner.v16')!));
  expect(owner).toEqual({ sessionId: original.id, exerciseKey: 'native-bench', setId: initialIds[1] });
  await page.getByRole('button', { name: 'Add 15 seconds rest', exact: true }).click();
  expect(Number(await deadline(page))).toBe(savedDeadline + 15_000);
  await page.getByRole('button', { name: 'Reduce rest by 15 seconds', exact: true }).click();
  expect(Number(await deadline(page))).toBe(savedDeadline);
  expect((await active(page)).exercises).toEqual(afterSecond.exercises);
  await page.screenshot({ path: testInfo.outputPath('bench-focus-rest-375.png') });

  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  // The active workout keeps its original date while Today advances normally.
  await page.clock.fastForward(30_000);
  await expect(page.locator('.page-header')).toContainText(/Tuesday,? 17 November/);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await settleWithFrozenClock(page, () => expect(focus(page)).toBeVisible());
  expect((await active(page)).id).toBe(original.id);
  expect((await active(page)).date).toBe(DATE);
  expect(Number(await deadline(page))).toBe(savedDeadline);
  await expect(weight(3)).toHaveValue('62.5'); await expect(reps(3)).toHaveValue('7');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  await expect(row(page, 3).getByRole('textbox', { name: `${BENCH} set 3 weight in kilograms`, exact: true })).toHaveValue('62.5');
  await expect(row(page, 3).getByRole('spinbutton', { name: `${BENCH} set 3 reps`, exact: true })).toHaveValue('7');
  await row(page, 3).getByRole('button', { name: `Complete ${BENCH} set 3`, exact: true }).click();
  await expect.poll(async () => (await active(page)).exercises[0].logs.filter((log: { done: boolean }) => log.done).length).toBe(3);
  await page.screenshot({ path: testInfo.outputPath('bench-quick-log-375.png') });
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('75');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Workout complete', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  const saved = await read(page);
  expect(saved.sessions).toHaveLength(1);
  const completed = saved.sessions[0].session;
  expect(completed).toMatchObject({ id: original.id, date: DATE, status: 'completed', elapsedMs: 75 * 60_000 });
  expect(completed.exercises[0].logs.map((log: { id: string }) => log.id)).toEqual(initialIds);
  expect(completed.exercises[0].logs.map((log: { kg: number; reps: number; done: boolean }) => [log.kg, log.reps, log.done]))
    .toEqual([[60, 8, true], [62.5, 7, true], [62.5, 7, true]]);
  expect(saved.profile).toEqual(before.profile);
  expect(saved.profile.customWorkouts).toEqual(before.profile.customWorkouts);
  for (const key of ['nutrition', 'activities', 'reminders', 'performance']) expect(saved[key]).toEqual(before[key as keyof typeof before]);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await settleWithFrozenClock(page, () => expect(page.getByRole('button', { name: 'Strength history', exact: true })).toBeVisible());
  await page.getByRole('button', { name: 'Strength history', exact: true }).click();
  await page.getByRole('combobox', { name: 'Movement', exact: true }).click();
  await page.getByRole('listbox').getByRole('option').filter({ hasText: /^Barbell Bench Press/ }).first().click();
  const history = page.locator('.movement-history');
  await expect(history.locator('button')).toHaveCount(1);
  await expect(history).toContainText('62.5 kg × 7');
  await expect(history).toContainText(NAME);
  await page.reload();
  expect(await read(page)).toEqual(saved);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const differentEquipmentOnly of [false, true]) {
  test(`bench history ${differentEquipmentOnly ? 'does not fill from a different apparatus' : 'uses the latest matching apparatus rather than a newer mismatched record'}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    const before = await seed(page, { history: true, differentEquipmentOnly });
    await start(page);
    const weight = focus(page).getByRole('textbox', { name: `${BENCH} set 1 weight in kilograms`, exact: true });
    await expect(weight).toHaveValue(differentEquipmentOnly ? '' : '55');
    if (!differentEquipmentOnly) await expect(focus(page).locator('.focused-exercise__previous')).toContainText('55 kg × 8');
    await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
    await expect(row(page, 2).getByRole('textbox', { name: `${BENCH} set 2 weight in kilograms`, exact: true })).toHaveValue(differentEquipmentOnly ? '' : '55');
    const snapshot = await read(page);
    expect(snapshot.sessions.filter((item: { session: { status: string } }) => item.session.status === 'completed')).toEqual(before.sessions);
    expect(snapshot.profile).toEqual(before.profile);
    expect((await active(page)).exercises[0].logs.every((log: { done: boolean }) => !log.done)).toBe(true);
  });
}

test('unilateral history and carried values remain per side in both views and do not double recorded repetitions', async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  const before = await seed(page, { history: true, unilateral: true });
  await start(page);
  const name = 'One-arm Dumbbell Row';
  await expect(focus(page)).toContainText('per side');
  await expect(focus(page).getByRole('textbox', { name: `${name} set 1 weight in kilograms`, exact: true })).toHaveValue('22.5');
  await expect(focus(page).getByRole('spinbutton', { name: `${name} set 1 reps`, exact: true })).toHaveValue('8');
  await focus(page).getByRole('button', { name: `Complete ${name} set 1`, exact: true }).click();
  await expect(focus(page).getByRole('textbox', { name: `${name} set 2 weight in kilograms`, exact: true })).toHaveValue('22.5');
  await expect(focus(page).getByRole('spinbutton', { name: `${name} set 2 reps`, exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  await expect(row(page, 2, name).getByRole('spinbutton', { name: `${name} set 2 reps`, exact: true })).toHaveValue('8');
  await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const session = await active(page);
  expect(session.exercises[0]).toMatchObject({ exerciseId: 'one-arm-dumbbell-row', perSide: true });
  expect(session.exercises[0].logs.map((log: { kg: number; reps: number; done: boolean }) => [log.kg, log.reps, log.done]))
    .toEqual([[22.5, 8, true], [22.5, 8, false], [22.5, 8, false]]);
  expect((await read(page)).profile).toEqual(before.profile);
  expect((await read(page)).sessions.filter((item: { session: { status: string } }) => item.session.status === 'completed')).toEqual(before.sessions);
});
