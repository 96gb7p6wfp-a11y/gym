import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const PRESS = 'Machine Chest Press';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const logs = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active').session.exercises[0].logs;
const activeRecord = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active');
const quickRow = (page: Page, name: string, number = 1) => page.getByRole('group', { name: `Quick log ${name} set ${number}`, exact: true });

async function seed(page: Page) {
  const exercise = (key: string, name: string, extra = {}) => ExerciseSchema.parse({
    key, name, group: 'Training', sets: 3, target: '8 reps', mode: 'weight', rest: 60, perSide: false, ...extra,
  });
  const plan = { ...DEFAULT_PROFILE.plan[0], name: 'V16 shared workout', warmup: [], cooldown: [], exercises: [
    exercise('quick-press', PRESS, { exerciseId: 'chest-press' }),
    exercise('quick-plank', 'Plank', { mode: 'timed', target: '45 sec' }),
    exercise('quick-jump', 'Approach Jump', { mode: 'bodyweight', measurement: 'touch', target: '1 rep' }),
    exercise('quick-pushup', 'Push-Up', { mode: 'bodyweight', target: '12 reps' }),
  ] };
  const profile = { ...structuredClone(DEFAULT_PROFILE), masterProgram: undefined, presentationMode: 'simple',
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) };
  const active = SessionSchema.parse(createSession(plan, 0, DATE, profile, []));
  active.startedAt = Date.parse(`${DATE}T10:00:00Z`); active.runningSince = null;
  active.exercises[0].logs.forEach((log, index) => Object.assign(log, { kg: 60 - index * 2.5, reps: 8 - index, rir: 2 }));
  active.exercises[1].logs[0].seconds = 45;
  active.exercises[2].logs[0].reps = 1;
  active.exercises[3].logs[0].reps = 12;
  const history = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-10-26', profile, []), 'completed'));
  for (const [index, metric] of [{ kg: 60, reps: 8 }, { seconds: 45 }, { reps: 1, measurementCm: 315 }, { reps: 12 }].entries()) {
    Object.assign(history.exercises[index].logs[0], { kg: null, reps: null, seconds: null, done: true }, metric);
  }
  await page.evaluate(({ key, profile, active, history }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile,
    profileVersion: 1, sessions: [{ session: history, version: 1 }, { session: active, version: 1 }], nutrition: [], activities: [] })),
  { key: STORE, profile, active, history });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  return { active, history, profile };
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('Focus and Quick Log share inputs, completion, undo and the same durable session', async ({ page }) => {
  const initial = await seed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(focus.getByRole('group', { name: 'Quick reps in reserve', exact: true })).toHaveCount(0);
  await focus.getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true }).fill('62,5');
  await focus.getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true }).fill('9');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const row = quickRow(page, PRESS);
  await expect(row.getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true })).toHaveValue('62.5');
  await expect(row.getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true })).toHaveValue('9');
  await expect(row.getByLabel(`Previous ${PRESS} set 1`, { exact: true })).toHaveText('60 kg × 8');
  await row.getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true }).fill('10');
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(focus.getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true })).toHaveValue('10');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  // Freeze only after the input is durable; the completion must add exactly one write.
  await page.clock.runFor(1000);
  await expect.poll(async () => (await logs(page))[0].reps).toBe(10);
  const before = await activeRecord(page);
  const complete = row.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true });
  await complete.scrollIntoViewIfNeeded();
  const box = (await complete.boundingBox())!;
  for (let tap = 0; tap < 10; tap++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(async () => (await logs(page)).map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  const completed = await activeRecord(page);
  expect(completed.version).toBe(before.version + 1);
  expect(completed.session.exercises[0].logs[0]).toEqual({ ...before.session.exercises[0].logs[0], done: true });
  expect(completed.session.exercises[0].logs.slice(1)).toEqual(before.session.exercises[0].logs.slice(1));
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect.poll(async () => (await logs(page))[0].done).toBe(false);
  expect((await logs(page))[0]).toEqual(before.session.exercises[0].logs[0]);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await row.getByRole('button', { name: `Ready for ${PRESS} set 1`, exact: true }).click();
  await row.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).click();
  await quickRow(page, PRESS, 2).getByRole('button', { name: `Complete ${PRESS} set 2`, exact: true }).click();
  await expect.poll(async () => (await logs(page)).map((log: { done: boolean }) => log.done)).toEqual([true, true, false]);
  const beforeRefresh = await activeRecord(page);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  expect(await activeRecord(page)).toEqual(beforeRefresh);
  const after = await read(page);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === initial.history.id).session).toEqual(initial.history);
  expect(after.profile).toEqual(initial.profile);
});

test('Quick Log shows appropriate previous metrics and permits corrections without duplicate records at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await seed(page);
  const beforeViewing = await activeRecord(page);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  expect(await activeRecord(page)).toEqual(beforeViewing);
  for (const [name, metric] of [['Plank', '45 sec'], ['Approach Jump', 'Maximum touch 315 cm'], ['Push-Up', '12 reps']]) {
    await expect(quickRow(page, name).getByLabel(`Previous ${name} set 1`, { exact: true })).toHaveText(metric);
  }
  const row = quickRow(page, PRESS);
  const weight = row.getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true });
  await expect(weight).toHaveAttribute('inputmode', 'decimal');
  await expect(row.getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true })).toHaveAttribute('inputmode', 'numeric');
  await row.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).click();
  await weight.fill('61,25');
  await row.getByRole('spinbutton', { name: `${PRESS} set 1 reps`, exact: true }).fill('7');
  await page.clock.runFor(1000);
  await expect.poll(async () => (await logs(page))[0]).toMatchObject({ kg: 61.25, reps: 7, rir: 2, done: true });
  expect((await read(page)).sessions).toHaveLength(2);
  const current = await activeRecord(page);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(focus.getByRole('textbox', { name: `${PRESS} set 1 weight in kilograms`, exact: true })).toHaveValue('61.25');
  expect(await activeRecord(page)).toEqual(current);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('equipment labels are optional, editable and do not relabel older workout history', async ({ page }) => {
  const initial = await seed(page);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const exercise = page.getByRole('region', { name: `Quick log ${PRESS}`, exact: true });
  await exercise.getByRole('button', { name: `Equipment for ${PRESS}`, exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Equipment label', exact: true });
  await editor.getByRole('textbox', { name: 'Machine or equipment label', exact: true }).fill('Matrix Chest Press');
  await editor.getByRole('button', { name: 'Save equipment label', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.clock.runFor(1000);
  await expect.poll(async () => (await activeRecord(page)).session.exercises[0].equipmentLabel).toBe('Matrix Chest Press');
  await expect(quickRow(page, PRESS).getByLabel(`Previous ${PRESS} set 1`, { exact: true })).toHaveText('—');
  const store = await read(page);
  expect(store.sessions.find((row: { session: { id: string } }) => row.session.id === initial.history.id).session).toEqual(initial.history);
  expect(store.profile).toEqual(initial.profile);
});
