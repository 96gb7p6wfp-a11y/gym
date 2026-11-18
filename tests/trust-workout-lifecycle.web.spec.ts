import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';
import { startAlreadyWarmed } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-16';
const NAME = 'My saved upper strength session';
const PRESS = 'Machine Chest Press';
const ROW = 'Chest-Supported Row';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const current = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session;
const focus = (page: Page) => page.getByRole('region', { name: 'Current exercise', exact: true });

/** Entirely isolated, user-shaped saved plan. It is not a replacement for V9. */
async function seed(page: Page, appearance: 'light' | 'dark' = 'dark') {
  const all = DEFAULT_PROFILE.plan.flatMap(day => day.exercises);
  const press = all.find(exercise => exercise.name === PRESS)!;
  const row = all.find(exercise => exercise.name === ROW)!;
  const plan = structuredClone(DEFAULT_PROFILE.plan);
  plan[0] = { ...plan[0], name: NAME, minutes: 75, warmup: [], cooldown: [], exercises: [
    { ...press, key: 'trust-press', sets: 3, target: '6–8 reps', rest: 75, defaultKg: null, equipmentLabel: 'QA Machine A', targetRir: 2 },
    { ...row, key: 'trust-row', sets: 2, target: '6–8 reps', rest: 90, defaultKg: null, equipmentLabel: 'QA Bench A', targetRir: 2 },
  ] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan, appearance, presentationMode: 'athlete',
    restSeconds: 75, timerSoundEnabled: false,
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA fixture. Not real medical guidance.' },
  });
  const history = SessionSchema.parse(stopSessionTimers(createSession(plan[0], 0, '2026-11-09', profile, []), 'completed'));
  history.startedAt = Date.parse('2026-11-09T10:00:00Z');
  history.finishedAt = history.startedAt + 70 * 60_000;
  history.elapsedMs = 70 * 60_000;
  history.exercises.forEach((exercise, index) => {
    exercise.logs = exercise.logs.map(log => ({ ...log, kg: index === 0 ? 60 : 40, reps: 8, rir: 2, done: true,
      inputSources: { kg: 'manual', reps: 'manual' } }));
  });
  const state = { schemaVersion: 1, profile, profileVersion: 6, sessions: [{ session: history, version: 4 }],
    nutrition: [{ id: 'trust-qa-bodyweight', date: DATE, version: 1, payload: { kind: 'weight', kg: 64.7 } }],
    activities: [], reminders: defaultReminderState(), performance: { jumps: [], readiness: [] }, performanceVersion: 1 };
  await page.evaluate(state => {
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
    sessionStorage.clear();
  }, state);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return state;
}

async function startToday(page: Page) {
  const today = page.getByRole('region', { name: 'Your day', exact: true });
  await expect(today).toContainText(NAME);
  await today.getByRole('button', { name: 'Start workout', exact: true }).click();
  await startAlreadyWarmed(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(focus(page)).toBeVisible();
}

async function rejectWorkoutWrites(page: Page) {
  await page.evaluate(key => {
    const native = Storage.prototype.setItem;
    (window as unknown as { restoreTrustStorage: () => void }).restoreTrustStorage = () => { Storage.prototype.setItem = native; };
    Storage.prototype.setItem = function(name, value) {
      if (this === window.localStorage && name === key) throw new DOMException('Isolated QA storage full', 'QuotaExceededError');
      return native.call(this, name, value);
    };
  }, STORE);
}
const allowWorkoutWrites = (page: Page) => page.evaluate(() => (window as unknown as { restoreTrustStorage: () => void }).restoreTrustStorage());

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('a complete workout retains prior values, manual edits, Undo, timer ownership and original settings across interruptions', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const before = await seed(page);
  await startToday(page);
  const session = await current(page);
  expect(session.exercises[0].logs.every((log: { done: boolean }) => !log.done)).toBe(true);
  await expect(focus(page)).toContainText('Previous');
  await expect(focus(page)).toContainText('60 kg × 8');
  await expect(focus(page).getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true })).toHaveValue('60');
  await expect(focus(page).getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true })).toHaveValue('8');
  await page.screenshot({ path: testInfo.outputPath('focus-390.png') });

  // Duplicate requests are one immutable set action, not ten new sets.
  await focus(page).getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).evaluate(button => {
    for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
  });
  await expect.poll(async () => (await current(page)).exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  await expect(focus(page).getByRole('textbox', { name: `${PRESS} set 2 weight in kilograms`, exact: true })).toHaveValue('60');
  await expect(focus(page).getByRole('spinbutton', { name: `${PRESS} set 2 reps`, exact: true })).toHaveValue('8');
  await focus(page).getByRole('textbox', { name: `${PRESS} set 2 weight in kilograms`, exact: true }).fill('62.5');
  await focus(page).getByRole('spinbutton', { name: `${PRESS} set 2 reps`, exact: true }).fill('7');
  await focus(page).getByRole('button', { name: `Complete ${PRESS} set 2`, exact: true }).click();
  await focus(page).getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect.poll(async () => (await current(page)).exercises[0].logs[1]).toMatchObject({ kg: 62.5, reps: 7, done: false });
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await focus(page).getByRole('button', { name: `Complete ${PRESS} set 2`, exact: true }).click();
  await expect.poll(async () => (await current(page)).exercises[0].logs[1].done).toBe(true);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const deadline = await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
  const owner = await page.evaluate(() => sessionStorage.getItem('setline.rest-owner.v16'));
  expect(deadline).not.toBeNull();
  expect(JSON.parse(owner!)).toMatchObject({ sessionId: session.id, exerciseKey: 'trust-press', setId: session.exercises[0].logs[1].id });

  // Navigation and refresh simulate a supported interruption; no new session.
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('2 / 5 sets complete');
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  expect((await current(page)).id).toBe(session.id);
  expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);
  expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-owner.v16'))).toBe(owner);
  await expect(focus(page).getByRole('textbox', { name: `${PRESS} set 3 weight in kilograms`, exact: true })).toHaveValue('62.5');
  await expect(focus(page).getByRole('spinbutton', { name: `${PRESS} set 3 reps`, exact: true })).toHaveValue('7');

  // Quick Log edits the same records; existing manual values remain in Focus.
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const third = page.getByRole('group', { name: `Quick log ${PRESS} set 3`, exact: true });
  await expect(third.getByRole('textbox', { name: `${PRESS} set 3 weight in kilograms`, exact: true })).toHaveValue('62.5');
  await page.screenshot({ path: testInfo.outputPath('quick-log-390.png') });
  await third.getByRole('button', { name: `Complete ${PRESS} set 3`, exact: true }).click();
  for (const index of [1, 2]) {
    const row = page.getByRole('group', { name: `Quick log ${ROW} set ${index}`, exact: true });
    await expect(row.getByRole('textbox', { name: `${ROW} set ${index} weight in kilograms`, exact: true })).toHaveValue('40');
    await expect(row.getByRole('spinbutton', { name: `${ROW} set ${index} reps`, exact: true })).toHaveValue('8');
    await row.getByRole('button', { name: `Complete ${ROW} set ${index}`, exact: true }).click();
  }
  await expect.poll(async () => (await current(page)).exercises.flatMap((exercise: { logs: { done: boolean }[] }) => exercise.logs).filter((log: { done: boolean }) => log.done).length).toBe(5);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(focus(page).getByLabel('All sets complete', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('75');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Workout complete', exact: true })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done', exact: true }).click();
  await expect.poll(() => current(page)).toBeUndefined();
  const saved = await read(page);
  const completed = saved.sessions.find((row: { session: { id: string } }) => row.session.id === session.id).session;
  expect(completed.status).toBe('completed');
  expect(completed.elapsedMs).toBe(75 * 60_000);
  expect(completed.exercises[0].logs.map((log: { kg: number; reps: number; done: boolean }) => [log.kg, log.reps, log.done]))
    .toEqual([[60, 8, true], [62.5, 7, true], [62.5, 7, true]]);
  expect(saved.sessions).toHaveLength(2);
  expect(saved.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  expect(saved.profile).toEqual(before.profile);
  for (const key of ['nutrition', 'activities', 'reminders', 'performance']) expect(saved[key]).toEqual(before[key as keyof typeof before]);

  // The saved session reaches both history and its existing exercise analytics.
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Strength history', exact: true }).click();
  await page.getByRole('combobox', { name: 'Movement', exact: true }).click();
  await page.getByRole('listbox').getByRole('option').filter({ hasText: /^Machine Chest Press/ }).first().click();
  const history = page.locator('.movement-history');
  await expect(history.locator('button')).toHaveCount(2);
  await expect(history).toContainText('62.5 kg × 7');
  await expect(history).toContainText('60 kg × 8');
  await expect(history).toContainText(NAME);
  await page.reload();
  const restarted = await read(page);
  expect(restarted).toEqual(saved);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('storage rejection retains the edited draft but never confirms completion until an explicit durable retry', async ({ page }) => {
  const before = await seed(page, 'light');
  await startToday(page);
  const session = await current(page);
  const durable = await read(page);
  await rejectWorkoutWrites(page);
  await focus(page).getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true }).fill('65');
  await focus(page).getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).click();
  const error = page.locator('.error-banner');
  await expect(error).toBeVisible();
  await expect(error).toContainText(/storage|save|space/i);
  expect(await read(page)).toEqual(durable);
  await expect(focus(page).getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true })).toHaveValue('65');
  await expect(focus(page).getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true })).toBeEnabled();
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Set completion', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('setline.last-completed-set.v16'))).toBeNull();
  await allowWorkoutWrites(page);
  await error.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(error).not.toBeVisible();
  // Retry saves only the manual input draft. It must not resurrect a failed
  // completion intent, start rest or advance through a set without a new action.
  await expect.poll(async () => (await current(page)).exercises[0].logs[0]).toMatchObject({ kg: 65, reps: 8, done: false });
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(page.getByRole('status', { name: 'Set completion', exact: true })).toHaveCount(0);
  const draft = await current(page);
  expect(draft.exercises[0].logs.slice(1)).toEqual(session.exercises[0].logs.slice(1));
  await focus(page).getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).click();
  await expect.poll(async () => (await current(page)).exercises[0].logs[0]).toMatchObject({ kg: 65, reps: 8, done: true });
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const state = await read(page);
  expect(state.sessions).toHaveLength(2);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === session.id).session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  expect(state.profile).toEqual(before.profile);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  await page.reload();
  expect(await read(page)).toEqual(state);
});

test('valid weight and rep edits survive an immediate same-event reload before the old 450 ms save delay', async ({ page }) => {
  const before = await seed(page);
  await startToday(page);
  const session = await current(page);
  const weight = focus(page).getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true });
  // Dispatch both real input changes and reload in the same browser task. No
  // timeout or persistence polling can conceal a pending debounced write.
  await Promise.all([
    page.waitForNavigation(),
    weight.evaluate((element, repLabel) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(element, '67.5');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      const reps = [...document.querySelectorAll('input')].find(input => input.getAttribute('aria-label') === repLabel)!;
      set.call(reps, '9');
      reps.dispatchEvent(new Event('input', { bubbles: true }));
      window.location.reload();
    }, `${PRESS} set 1 reps`),
  ]);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(focus(page).getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true })).toHaveValue('67.5');
  await expect(focus(page).getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true })).toHaveValue('9');
  const state = await read(page), active = await current(page);
  expect(active.id).toBe(session.id);
  expect(active.exercises[0].logs[0]).toMatchObject({ kg: 67.5, reps: 9, done: false, inputSources: { kg: 'manual', reps: 'manual' } });
  expect(active.exercises[0].logs.slice(1)).toEqual(session.exercises[0].logs.slice(1));
  expect(state.profile).toEqual(before.profile);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
});

test('a rejected finish keeps the active session and finish sheet, then retries the same workout exactly once', async ({ page }) => {
  const before = await seed(page, 'light');
  await startToday(page);
  await focus(page).getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).click();
  const session = await current(page);
  await expect.poll(async () => (await current(page)).exercises[0].logs[0].done).toBe(true);
  const durable = await read(page);
  const deadline = await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('75');
  await rejectWorkoutWrites(page);
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await expect(finish).toBeVisible();
  await expect(finish.getByRole('alert')).toContainText(/storage|save|space/i);
  await expect(finish.getByRole('button', { name: 'Save completed workout', exact: true })).toBeEnabled();
  await expect(page.getByRole('heading', { name: 'Workout complete', exact: true })).toHaveCount(0);
  expect(await read(page)).toEqual(durable);
  expect((await current(page)).id).toBe(session.id);
  expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);

  await allowWorkoutWrites(page);
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).evaluate(button => {
    for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
  });
  await expect(finish).not.toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Workout complete', exact: true })).toBeVisible();
  expect(await current(page)).toBeUndefined();
  const after = await read(page);
  expect(after.sessions).toHaveLength(2);
  const record = after.sessions.find((row: { session: { id: string } }) => row.session.id === session.id);
  expect(record.version).toBe(durable.sessions.find((row: { session: { id: string } }) => row.session.id === session.id).version + 1);
  expect(record.session).toMatchObject({ id: session.id, status: 'completed', elapsedMs: 75 * 60_000 });
  expect(record.session.exercises).toEqual(session.exercises);
  expect(after.profile).toEqual(before.profile);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  await page.reload();
  expect(await read(page)).toEqual(after);
});

test('Quick Log Undo immediately rearms only its exact set and ten recompletion taps create one completion', async ({ page }) => {
  const before = await seed(page);
  await startToday(page);
  const session = await current(page);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const first = page.getByRole('group', { name: `Quick log ${PRESS} set 1`, exact: true });
  await first.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).click();
  await expect.poll(async () => (await current(page)).exercises[0].logs[0].done).toBe(true);
  await page.getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect.poll(async () => (await current(page)).exercises[0].logs[0].done).toBe(false);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  const complete = first.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true });
  await expect(complete).toBeEnabled();
  await complete.evaluate(button => {
    for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
  });
  await expect.poll(async () => (await current(page)).exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const state = await read(page);
  const record = state.sessions.find((row: { session: { id: string } }) => row.session.id === session.id);
  expect(record.version).toBe(4);
  expect(record.session.exercises[0].logs[0]).toMatchObject({ kg: 60, reps: 8, done: true });
  expect(record.session.exercises[0].logs.slice(1)).toEqual(session.exercises[0].logs.slice(1));
  expect(record.session.exercises[1]).toEqual(session.exercises[1]);
  expect(state.profile).toEqual(before.profile);
  expect(state.sessions).toHaveLength(2);
});

test('a rejected initial start keeps preflight retryable without an optimistic active-session trap', async ({ page }, testInfo) => {
  const before = await seed(page, 'light');
  expect(await current(page)).toBeUndefined();
  const today = page.getByRole('region', { name: 'Your day', exact: true });
  await today.getByRole('button', { name: 'Start workout', exact: true }).click();
  const check = page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
  await check.getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
  await check.getByRole('button', { name: 'Yes — already warmed up', exact: true }).click();
  await rejectWorkoutWrites(page);
  await check.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(check).toBeVisible();
  await expect(check.getByRole('alert')).toContainText(/could not|storage|save/i);
  expect(await current(page)).toBeUndefined();
  expect(await read(page)).toEqual(before);
  await page.screenshot({ path: testInfo.outputPath('initial-start-error-retryable-390.png') });
  // A failed initial write must leave no in-memory active session that locks
  // this sheet. Correcting storage should be sufficient to retry the start.
  await expect(check.getByRole('button', { name: 'Start workout', exact: true })).toBeEnabled();
  await allowWorkoutWrites(page);
  await check.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(check).not.toBeVisible();
  await expect.poll(() => current(page)).toBeTruthy();
  const state = await read(page), active = await current(page);
  expect(state.sessions).toHaveLength(2);
  expect(state.sessions.filter((row: { session: { status: string } }) => row.session.status === 'active')).toHaveLength(1);
  expect(active.exercises.every((exercise: { logs: { done: boolean }[] }) => exercise.logs.every(log => !log.done))).toBe(true);
  expect(state.profile).toEqual(before.profile);
  expect(state.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
});

test('an active workout saved by another window during preflight is resumed without a second session or trapped sheet', async ({ page }) => {
  const before = await seed(page);
  const today = page.getByRole('region', { name: 'Your day', exact: true });
  await today.getByRole('button', { name: 'Start workout', exact: true }).click();
  const check = page.getByRole('dialog', { name: 'Ready to Train?', exact: true });
  await check.getByRole('button', { name: 'Yes — fit to train', exact: true }).click();
  await check.getByRole('button', { name: 'Yes — already warmed up', exact: true }).click();
  const other = SessionSchema.parse(createSession(before.profile.plan[0], 0, DATE, before.profile, [before.sessions[0].session]));
  other.startedAt = Date.parse(`${DATE}T10:00:00Z`);
  other.runningSince = null;
  other.notes = 'Isolated QA session saved in another window.';
  Object.assign(other.exercises[0].logs[0], { kg: 67.5, reps: 9, done: true, inputSources: { kg: 'manual', reps: 'manual' } });
  // A same-origin tab's save is authoritative even if this stale page has not
  // processed its storage event yet. Do not give this window an early hint.
  const authoritative = { ...before, sessions: [{ session: other, version: 3 }, ...before.sessions] };
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), authoritative);
  await check.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(check).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Finish workout', exact: true })).toBeVisible();
  await expect(focus(page)).toBeVisible();
  expect((await current(page)).id).toBe(other.id);
  expect(await read(page)).toEqual(authoritative);
  await page.reload();
  expect(await read(page)).toEqual(authoritative);
  expect((await current(page)).id).toBe(other.id);
});
