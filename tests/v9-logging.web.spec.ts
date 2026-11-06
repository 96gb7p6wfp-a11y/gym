import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan, createVolleyballMasterPlan, masterJumpContacts } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-04';
const HOLD = 'DB Suitcase Carry / Static Hold';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const current = (page: Page) => page.getByRole('region', { name: 'Current exercise', exact: true });
const active = async (page: Page) => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active');
const rest = (page: Page) => page.evaluate(() => ({
  deadline: sessionStorage.getItem('setline.rest-deadline.v1'),
  owner: JSON.parse(sessionStorage.getItem('setline.rest-owner.v16')!),
}));

async function seed(page: Page, target: 'sprint' | 'complex' | 'hold' | 'strength' = 'sprint') {
  const plan = createV9VolleyballMasterPlan();
  const guidance = { impact: 'cleared', heavyLifting: 'cleared' };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance: 'light', presentationMode: 'athlete',
    plan, trainingGuidance: guidance,
    masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', v9EffectiveDate: '2026-11-02', matchWeeks: [], clearance: guidance },
    masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
  });
  const historical = SessionSchema.parse(stopSessionTimers(createSession(createVolleyballMasterPlan()[2], 2, '2026-10-28', profile, []), 'completed'));
  historical.exercises.forEach(exercise => exercise.logs.forEach(log => {
    if (exercise.mode === 'weight') Object.assign(log, { kg: 55, reps: 6, rir: 2, done: true });
  }));
  const session = SessionSchema.parse(stopSessionTimers(createSession(plan[2], 2, DATE, profile, []), 'active'));
  const targetName = target === 'complex' ? 'Hack Squat' : target === 'hold' ? HOLD : target === 'strength' ? 'Romanian Deadlift' : '5 m Acceleration';
  const targetIndex = session.exercises.findIndex(exercise => exercise.name === targetName);
  for (const [index, exercise] of session.exercises.entries()) {
    exercise.logs.forEach(log => {
      Object.assign(log, { kg: null, reps: exercise.prescribedDistanceM ?? null, seconds: null, rir: null, done: index < targetIndex });
      if (exercise.prescribedDistanceM != null) log.inputSources = { reps: 'planned' };
      else delete log.inputSources;
      if (index < targetIndex) Object.assign(log, exercise.mode === 'timed' ? { seconds: 20 } : { reps: exercise.prescribedDistanceM ?? 2, kg: exercise.mode === 'weight' ? 6 : null });
    });
  }
  if (target === 'complex') Object.assign(session.exercises[targetIndex].logs[0], { kg: 70, reps: 5, rir: 2 });
  if (target === 'strength') Object.assign(session.exercises[targetIndex].logs[0], { kg: 60, reps: 6, rir: 2 });
  const state = { schemaVersion: 1, profile, profileVersion: 3,
    sessions: [{ session: historical, version: 2 }, { session, version: 1 }], nutrition: [], activities: [], reminders: defaultReminderState(),
  };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(current(page).getByRole('heading', { name: targetName, exact: true })).toBeVisible();
  return state;
}

async function complete(page: Page, name: string, number: number) {
  const button = current(page).getByRole('button', { name: `Complete ${name} set ${number}`, exact: true });
  if (await button.isDisabled()) await current(page).getByRole('button', { name: `Ready for ${name} set ${number}`, exact: true }).click();
  await button.click();
}

async function expectRest(page: Page, seconds: number, exerciseKey: string, setId: string) {
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const saved = await rest(page);
  expect(saved.owner).toMatchObject({ exerciseKey, setId });
  const remaining = await page.evaluate(() => Number(sessionStorage.getItem('setline.rest-deadline.v1')) - Date.now());
  expect(remaining).toBeGreaterThan(seconds * 1000 - 5000);
  expect(remaining).toBeLessThanOrEqual(seconds * 1000);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('V9 sprint distance and genuinely measured optional time share one session across Focus and Quick Log', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const initial = await seed(page);
  const name = '5 m Acceleration';
  await expect(current(page).getByRole('spinbutton', { name: `${name} set 1 distance in metres`, exact: true })).toHaveValue('5');
  await expect(current(page).getByRole('textbox', { name: /weight in kilograms/ })).toHaveCount(0);
  await expect(current(page).getByRole('spinbutton', { name: /reps in reserve/ })).toHaveCount(0);
  const notes = current(page).locator('.focused-training-notes');
  await notes.locator(':scope > summary').click();
  const seconds = notes.getByRole('spinbutton', { name: `${name} set 1 measured sprint seconds`, exact: true });
  await expect(seconds).toHaveValue('');
  expect((await active(page)).session.exercises[0].logs[0].seconds).toBeNull();
  await seconds.fill('1.23');
  await complete(page, name, 1);
  const record = await active(page);
  expect(record.session.exercises[0].logs[0]).toMatchObject({ kg: null, reps: 5, seconds: 1.23, done: true });
  expect(record.session.exercises[0].logs[1]).toMatchObject({ kg: null, reps: 5, seconds: null, done: false });
  const firstRest = await rest(page);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const row = page.getByRole('group', { name: `Quick log ${name} set 2`, exact: true });
  await expect(row.getByRole('spinbutton', { name: `${name} set 2 distance in metres`, exact: true })).toHaveValue('5');
  await expect(row.getByRole('textbox', { name: /weight in kilograms/ })).toHaveCount(0);
  await row.getByRole('spinbutton', { name: `${name} set 2 distance in metres`, exact: true }).fill('4');
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(current(page).getByRole('spinbutton', { name: `${name} set 2 distance in metres`, exact: true })).toHaveValue('4');
  expect(await rest(page)).toEqual(firstRest);
  await page.clock.runFor(1000);
  const beforeRefresh = await active(page);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  expect(await active(page)).toEqual(beforeRefresh);
  expect((await read(page)).profile).toEqual(initial.profile);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('V9 suitcase hold records seconds and optional actual load without creating repetitions', async ({ page }) => {
  const initial = await seed(page, 'hold');
  await expect(current(page).getByRole('spinbutton', { name: `${HOLD} set 1 reps`, exact: true })).toHaveCount(0);
  const seconds = current(page).getByRole('spinbutton', { name: `${HOLD} set 1 seconds`, exact: true });
  await seconds.fill('30');
  await current(page).getByRole('button', { name: `Add weight to ${HOLD}`, exact: true }).click();
  await current(page).getByRole('textbox', { name: `${HOLD} set 1 weight in kilograms`, exact: true }).fill('20');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const row = page.getByRole('group', { name: `Quick log ${HOLD} set 1`, exact: true });
  await expect(row.getByRole('spinbutton', { name: `${HOLD} set 1 seconds`, exact: true })).toHaveValue('30');
  await expect(row.getByRole('textbox', { name: `${HOLD} set 1 weight in kilograms`, exact: true })).toHaveValue('20');
  await row.getByRole('button', { name: `Complete ${HOLD} set 1`, exact: true }).click();
  const record = await active(page);
  const exercise = record.session.exercises.find((entry: { name: string }) => entry.name === HOLD);
  expect(exercise.logs[0]).toMatchObject({ kg: 20, seconds: 30, reps: null, done: true });
  expect(exercise.logs[1]).toMatchObject({ reps: null, done: false });
  expect((await read(page)).sessions.find((row: { session: { id: string } }) => row.session.id === initial.sessions[0].session.id)).toEqual(initial.sessions[0]);
});

test('real V9 complex has exactly three Hack sets and three CMJ sets with the correct alternating rests', async ({ page }) => {
  const initial = await seed(page, 'complex');
  const session = initial.sessions[1].session;
  const hack = session.exercises.find(exercise => exercise.name === 'Hack Squat')!;
  const cmj = session.exercises.find(exercise => exercise.name === 'Countermovement Jump')!;
  expect(hack.logs).toHaveLength(3); expect(cmj.logs).toHaveLength(3);
  const beforeLayout = await active(page);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const sequence = page.getByRole('note', { name: 'Complex pair A sequence', exact: true });
  await expect(sequence).toContainText('3 rounds');
  await expect(sequence).toContainText('Hack Squat');
  await expect(sequence).toContainText('Countermovement Jump');
  await expect(sequence).toContainText('180–240');
  expect(await active(page)).toEqual(beforeLayout);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(current(page).getByRole('group', { name: 'Complex pair A', exact: true })).toContainText('Round 1');
  for (let round = 1; round <= 3; round++) {
    await expect(current(page).getByRole('heading', { name: 'Hack Squat', exact: true })).toBeVisible();
    await complete(page, 'Hack Squat', round);
    await expectRest(page, 240, hack.key, hack.logs[round - 1].id);
    await expect(current(page).getByRole('heading', { name: 'Countermovement Jump', exact: true })).toBeVisible();
    if (round === 1) {
      const deadline = await rest(page);
      await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click();
      await expect(current(page).getByRole('heading', { name: 'Countermovement Jump', exact: true })).toBeVisible();
      expect(await rest(page)).toEqual(deadline);
    }
    await current(page).getByRole('spinbutton', { name: `Countermovement Jump set ${round} reps`, exact: true }).fill('2');
    await complete(page, 'Countermovement Jump', round);
    await expectRest(page, 180, cmj.key, cmj.logs[round - 1].id);
  }
  await expect(current(page).getByRole('heading', { name: 'Romanian Deadlift', exact: true })).toBeVisible();
  const record = await active(page);
  expect(record.session.exercises.filter((exercise: { name: string }) => exercise.name === 'Hack Squat')).toHaveLength(1);
  for (const name of ['Hack Squat', 'Countermovement Jump']) {
    expect(record.session.exercises.find((exercise: { name: string }) => exercise.name === name).logs.map((log: { done: boolean }) => log.done)).toEqual([true, true, true]);
  }
  expect(record.session.exercises.find((exercise: { name: string }) => exercise.name === 'Romanian Deadlift').logs.every((log: { done: boolean }) => !log.done)).toBe(true);
  expect((await read(page)).profile).toEqual(initial.profile);
});

test('V9 rapid repeated completion records one real strength set and Undo retains entered values', async ({ page }) => {
  const initial = await seed(page, 'strength');
  await current(page).getByRole('button', { name: 'Reuse previous Romanian Deadlift set 1 weights and reps', exact: true }).click();
  const weight = current(page).getByRole('textbox', { name: 'Romanian Deadlift set 1 weight in kilograms', exact: true });
  await expect(weight).toHaveValue('55');
  await weight.fill('60');
  const target = current(page).getByRole('button', { name: 'Complete Romanian Deadlift set 1', exact: true });
  await target.evaluate(button => { for (let index = 0; index < 10; index++) button.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
  let record = await active(page);
  const rdl = record.session.exercises.find((exercise: { name: string }) => exercise.name === 'Romanian Deadlift');
  expect(rdl.logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  expect(rdl.logs[1]).toMatchObject({ kg: 60, reps: 6, done: false, inputSources: { kg: 'last-set', reps: 'last-set' } });
  expect(record.version).toBe(2);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo last set', exact: true }).click();
  record = await active(page);
  expect(record.session.exercises.find((exercise: { name: string }) => exercise.name === 'Romanian Deadlift').logs[0])
    .toMatchObject({ kg: 60, reps: 6, rir: 2, done: false });
  expect((await read(page)).sessions).toHaveLength(2);
  expect((await read(page)).sessions.find((row: { session: { id: string } }) => row.session.id === initial.sessions[0].session.id)).toEqual(initial.sessions[0]);
  expect((await read(page)).profile).toEqual(initial.profile);
});

test('V9 jump contacts are actual completed work and do not become invented measured height', async ({ page }) => {
  const initial = await seed(page, 'complex');
  const before = await active(page);
  const expectedBefore = masterJumpContacts(initial.profile.plan[2], before.session);
  expect(expectedBefore.planned).toBe(24);
  await complete(page, 'Hack Squat', 1);
  await current(page).getByRole('spinbutton', { name: 'Countermovement Jump set 1 reps', exact: true }).fill('2');
  await complete(page, 'Countermovement Jump', 1);
  const record = await active(page);
  const contacts = masterJumpContacts(initial.profile.plan[2], record.session);
  expect(contacts.completed).toBe(expectedBefore.completed + 2);
  const jump = record.session.exercises.find((exercise: { name: string }) => exercise.name === 'Countermovement Jump');
  expect(jump.logs[0].measurementCm ?? null).toBeNull();
  expect(record.session.status).toBe('active');
  expect(record.session.exercises.filter((exercise: { name: string }) => exercise.name === 'Hack Squat')).toHaveLength(1);
});
