import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const EXERCISE = 'Barbell Bench Press';
const DATE = '2026-11-16';
const NOW = new Date(`${DATE}T10:00:00Z`);
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const read = async (page: Page) => JSON.parse((await raw(page))!);
const activeRecord = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active');

async function controls(page: Page) {
  return page.evaluate(() => ({
    deadline: sessionStorage.getItem('setline.rest-deadline.v1'),
    owner: sessionStorage.getItem('setline.rest-owner.v16'),
    receipt: sessionStorage.getItem('setline.last-completed-set.v16'),
    continuity: localStorage.getItem('setline.workout-continuity.v1'),
  }));
}

async function rejectPrimaryWrites(page: Page) {
  await page.evaluate(key => {
    const native = Storage.prototype.setItem;
    (window as unknown as { allowNativePrimaryWrites: () => void }).allowNativePrimaryWrites = () => { Storage.prototype.setItem = native; };
    Storage.prototype.setItem = function(name, value) {
      if (this === localStorage && name === key) throw new DOMException('Isolated primary quota rejection', 'QuotaExceededError');
      return native.call(this, name, value);
    };
  }, STORE);
}
const allowPrimaryWrites = (page: Page) => page.evaluate(() => (window as unknown as { allowNativePrimaryWrites: () => void }).allowNativePrimaryWrites());

async function seed(page: Page) {
  const catalogue = findLibraryExercise(EXERCISE)!;
  const exercise = { ...toPlanExercise(catalogue), key: 'native-durable-bench', sets: 3,
    target: '6–10 reps', rest: 120, defaultKg: 60, targetRir: 2, equipmentLabel: 'QA rack A' };
  const workout = { ...structuredClone(DEFAULT_PROFILE.plan[0]), name: 'Durable completion QA',
    exercises: [exercise], warmup: [], cooldown: [] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? workout : structuredClone(day)),
    timerSoundEnabled: false, appearance: 'dark', presentationMode: 'athlete',
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA fixture.' } });
  const history = SessionSchema.parse(stopSessionTimers(createSession(workout, 0, '2026-11-09', profile, []), 'completed'));
  history.startedAt = Date.parse('2026-11-09T10:00:00Z');
  history.finishedAt = history.startedAt + 60 * 60_000;
  history.elapsedMs = 60 * 60_000;
  history.exercises[0].logs.forEach(log => Object.assign(log, { kg: 55, reps: 8, rir: 2, done: true }));
  const session = SessionSchema.parse(createSession(workout, 0, DATE, profile, []));
  session.startedAt = NOW.getTime(); session.runningSince = null;
  session.exercises[0].logs.forEach(log => Object.assign(log, { kg: 60, reps: 8, rir: 2, done: false,
    inputSources: { kg: 'manual', reps: 'manual' } }));
  const state = { schemaVersion: 1, profile, profileVersion: 7,
    sessions: [{ session, version: 3 }, { session: history, version: 2 }],
    nutrition: [{ id: 'native-durable-weight', date: DATE, version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: defaultReminderState(), performance: { jumps: [], readiness: [] }, performanceVersion: 1 };
  await page.evaluate(state => {
    sessionStorage.clear();
    localStorage.setItem('setline.gym.v1', JSON.stringify(state));
  }, state);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
  return state;
}

function complete(page: Page, layout: 'Focus' | 'Quick Log') {
  const container = layout === 'Focus'
    ? page.getByRole('region', { name: 'Current exercise', exact: true })
    : page.getByRole('group', { name: `Quick log ${EXERCISE} set 1`, exact: true });
  return container.getByRole('button', { name: `Complete ${EXERCISE} set 1`, exact: true });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: NOW });
  await page.clock.pauseAt(new Date(NOW.getTime() + 1000));
  await page.goto('/');
});

for (const layout of ['Focus', 'Quick Log'] as const) {
  test(`${layout} never confirms, advances or starts rest when completion persistence fails`, async ({ page }) => {
    const before = await seed(page);
    if (layout === 'Quick Log') await page.getByRole('button', { name: layout, exact: true }).click();
    const durable = await raw(page), previousControls = await controls(page);
    await rejectPrimaryWrites(page);
    await complete(page, layout).evaluate(button => {
      for (let count = 0; count < 10; count++) (button as HTMLButtonElement).click();
    });
    await expect(page.locator('.error-banner')).toContainText(/save|storage/i);
    expect(await raw(page)).toBe(durable);
    expect(await controls(page)).toEqual(previousControls);
    await expect(complete(page, layout)).toBeEnabled();
    await expect(page.locator('.rest-floating')).toHaveCount(0);
    await expect(page.getByRole('status', { name: 'Set completion', exact: true })).toHaveCount(0);
    if (layout === 'Focus') await expect(page.getByRole('region', { name: 'Current exercise', exact: true }).getByRole('textbox', { name: `${EXERCISE} set 1 weight in kilograms`, exact: true })).toHaveValue('60');

    await allowPrimaryWrites(page);
    await complete(page, layout).evaluate(button => {
      for (let count = 0; count < 10; count++) (button as HTMLButtonElement).click();
    });
    await expect(page.locator('.error-banner')).toHaveCount(0);
    const saved = await read(page), record = await activeRecord(page);
    expect(record.version).toBe(before.sessions[0].version + 1);
    expect(record.session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
    expect(record.session.exercises[0].logs.slice(1)).toEqual(before.sessions[0].session.exercises[0].logs.slice(1));
    expect(record.session.exercises[0].logs[0]).toEqual({ ...before.sessions[0].session.exercises[0].logs[0], done: true });
    await expect(page.locator('.rest-floating')).toHaveCount(1);
    expect(JSON.parse((await controls(page)).receipt!)).toEqual({ sessionId: record.session.id,
      exerciseKey: record.session.exercises[0].key, setId: record.session.exercises[0].logs[0].id });
    expect(saved.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[1].session.id)).toEqual(before.sessions[1]);
    expect(saved.profile).toEqual(before.profile); expect(saved.nutrition).toEqual(before.nutrition);
    expect(saved.reminders).toEqual(before.reminders); expect(saved.performance).toEqual(before.performance);
  });

  test(`${layout} retains the recorded set, receipt and timer until Undo is durably saved`, async ({ page }) => {
    const before = await seed(page);
    if (layout === 'Quick Log') await page.getByRole('button', { name: layout, exact: true }).click();
    await complete(page, layout).click();
    await expect(page.locator('.rest-floating')).toHaveCount(1);
    const recorded = await activeRecord(page), durable = await raw(page), previousControls = await controls(page);
    await rejectPrimaryWrites(page);
    await page.getByRole('button', { name: 'Undo last set', exact: true }).evaluate(button => {
      for (let count = 0; count < 10; count++) (button as HTMLButtonElement).click();
    });
    await expect(page.locator('.error-banner')).toContainText(/save|storage/i);
    expect(await raw(page)).toBe(durable);
    expect(await controls(page)).toEqual(previousControls);
    await expect(page.locator('.rest-floating')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Undo last set', exact: true })).toBeEnabled();

    await allowPrimaryWrites(page);
    await page.getByRole('button', { name: 'Undo last set', exact: true }).click();
    await expect(page.locator('.error-banner')).toHaveCount(0);
    await expect(page.locator('.rest-floating')).toHaveCount(0);
    const undone = await activeRecord(page), saved = await read(page);
    expect(undone.version).toBe(recorded.version + 1);
    expect(undone.session.exercises[0].logs).toEqual(before.sessions[0].session.exercises[0].logs);
    expect((await controls(page)).receipt).toBeNull();
    expect((await controls(page)).deadline).toBeNull();
    expect((await controls(page)).owner).toBeNull();
    await expect(complete(page, layout)).toBeEnabled();
    expect(saved.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[1].session.id)).toEqual(before.sessions[1]);
    expect(saved.profile).toEqual(before.profile); expect(saved.nutrition).toEqual(before.nutrition);
    expect(saved.reminders).toEqual(before.reminders); expect(saved.performance).toEqual(before.performance);
    await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click();
    expect(await activeRecord(page)).toEqual(undone);
  });
}
