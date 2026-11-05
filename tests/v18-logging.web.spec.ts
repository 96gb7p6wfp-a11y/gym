import { expect, test, type Locator, type Page } from '@playwright/test';
import type { z } from 'zod';
import { DEFAULT_PROFILE, ExerciseSchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const PRESS = 'Machine Chest Press';
const ROW = 'Chest-Supported Row';
type Session = z.infer<typeof SessionSchema>;
type Layout = 'Focus' | 'Quick Log' | 'All sets';
type Activation = 'mouse' | 'touch' | 'pointer' | 'keyboard';
interface SavedState {
  profile: unknown;
  sessions: { session: Session; version: number }[];
  nutrition: unknown[];
}

const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as SavedState, STORE);
async function activeRecord(page: Page) {
  return (await read(page)).sessions.find(record => record.session.status === 'active')!;
}
const weight = (page: Page, number: number, name = PRESS) => page.getByRole('textbox', { name: `${name} set ${number} weight in kilograms`, exact: true });
const reps = (page: Page, number: number, name = PRESS) => page.getByRole('spinbutton', { name: `${name} set ${number} reps`, exact: true });
const quickRow = (page: Page, number: number, name = PRESS) => page.getByRole('group', { name: `Quick log ${name} set ${number}`, exact: true });

async function seed(page: Page, options: { pair?: boolean; protectedDrafts?: boolean; historyIncomplete?: boolean } = {}) {
  const movement = (key: string, name: string, extra = {}) => ExerciseSchema.parse({
    key, exerciseId: name === PRESS ? 'chest-press' : 'chest-supported-row', name, group: 'Strength',
    sets: options.protectedDrafts ? 4 : 3, target: '8 reps', mode: 'weight', rest: 120,
    perSide: false, equipmentLabel: 'Saved gym machine', ...extra,
  });
  const first = movement('v18-press', PRESS, options.pair
    ? { superset: { id: 'v18-pair', label: 'A', order: 1, rounds: 3, restAfterRound: 90 } } : {});
  const second = movement('v18-row', ROW, { superset: { id: 'v18-pair', label: 'A', order: 2, rounds: 3, restAfterRound: 90 } });
  const plan = { ...DEFAULT_PROFILE.plan[0], name: 'Personal strength session', warmup: [], cooldown: [],
    exercises: options.pair ? [first, second] : [first] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance: 'light', presentationMode: 'athlete',
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) });
  const historical = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-10-26', profile, []), 'completed'));
  historical.name = 'Earlier completed strength';
  historical.startedAt = Date.parse('2026-10-26T10:00:00Z');
  historical.exercises.forEach(exercise => exercise.logs.forEach((log, index) => {
    Object.assign(log, options.historyIncomplete && index > 0
      ? { kg: null, reps: null, done: false } : { kg: 55, reps: 7, done: true });
    delete log.inputSources;
  }));
  const active = SessionSchema.parse(createSession(plan, 0, DATE, profile, []));
  active.startedAt = Date.parse(`${DATE}T10:00:00Z`); active.runningSince = null;
  active.exercises.forEach(exercise => exercise.logs.forEach(log => {
    Object.assign(log, { kg: null, reps: null, seconds: null, rir: null, done: false });
    delete log.inputSources;
  }));
  Object.assign(active.exercises[0].logs[0], { kg: 60, reps: 8, rir: 2 });
  if (options.pair) Object.assign(active.exercises[1].logs[0], { kg: 35, reps: 10, rir: 3 });
  if (options.protectedDrafts) {
    Object.assign(active.exercises[0].logs[1], { kg: 0, reps: 5, inputSources: { kg: 'planned', reps: 'planned' } });
    Object.assign(active.exercises[0].logs[2], { inputSources: { kg: 'manual', reps: 'manual' } });
  }
  await page.evaluate(({ key, profile, active, historical }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 3,
    sessions: [{ session: historical, version: 2 }, { session: active, version: 1 }],
    nutrition: [{ id: 'preserved-weight', date: '2026-10-26', version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: { items: [], entries: [] },
  })), { key: STORE, profile, active, historical });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  return { profile, active, historical };
}

async function showLayout(page: Page, layout: Layout) {
  if (layout === 'Quick Log') await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  if (layout === 'All sets') {
    await page.getByRole('region', { name: 'Current exercise', exact: true }).getByRole('button', { name: 'All sets', exact: true }).click();
  }
}

function completion(page: Page, layout: Layout, number = 1, name = PRESS) {
  return page.getByRole(layout === 'All sets' ? 'checkbox' : 'button', { name: `Complete ${name} set ${number}`, exact: true });
}

async function rapidActivation(page: Page, control: Locator, kind: Activation) {
  await control.scrollIntoViewIfNeeded();
  if (kind === 'keyboard') {
    await control.focus();
    for (let index = 0; index < 10; index++) await page.keyboard.press('Space');
  } else if (kind === 'pointer') {
    // Keep the same DOM target while allowing React to render between requests.
    const element = (await control.elementHandle())!;
    for (let index = 0; index < 10; index++) await element.evaluate(button => {
      button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 18, pointerType: 'pen' }));
      button.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 18, pointerType: 'pen' }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  } else {
    const bounds = (await control.boundingBox())!;
    for (let index = 0; index < 10; index++) {
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      if (kind === 'touch') await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
    }
  }
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const layout of ['Focus', 'Quick Log', 'All sets'] as const) {
  for (const activation of ['mouse', 'touch', 'pointer', 'keyboard'] as const) {
    test(`${layout}: ten ${activation} activations record one set and create one editable next-set suggestion atomically`, async ({ page }) => {
      const initial = await seed(page);
      await showLayout(page, layout);
      const target = completion(page, layout);
      const element = (await target.elementHandle())!;
      await rapidActivation(page, target, activation);
      await expect.poll(async () => (await activeRecord(page)).session.exercises[0].logs.map(log => log.done)).toEqual([true, false, false]);
      const saved = await activeRecord(page);
      expect(saved.version).toBe(2);
      expect(saved.session.exercises[0].logs[0]).toEqual({ ...initial.active.exercises[0].logs[0], done: true });
      expect(saved.session.exercises[0].logs[1]).toEqual({ ...initial.active.exercises[0].logs[1], kg: 60, reps: 8,
        inputSources: { kg: 'last-set', reps: 'last-set' } });
      expect(saved.session.exercises[0].logs[2]).toEqual(initial.active.exercises[0].logs[2]);
      await expect(page.locator('.rest-floating')).toHaveCount(1);
      const deadline = await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
      expect(deadline).not.toBeNull();
      await element.dispatchEvent('click');
      expect((await activeRecord(page)).version).toBe(2);
      expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);
      const state = await read(page);
      expect(state.sessions).toHaveLength(2);
      expect(state.sessions.find(record => record.session.id === initial.historical.id)?.session).toEqual(initial.historical);
      expect(state.profile).toEqual(initial.profile);
      if (layout === 'Focus') await expect(completion(page, layout, 2)).toBeDisabled();
      if (layout === 'Quick Log') await expect(quickRow(page, 2).getByLabel(`${PRESS} set 2 suggestion`, { exact: true })).toHaveText('Last-set suggestion · editable');
    });
  }
}

test('suggestions stay editable and share the same durable session across Focus, Quick Log, All sets and offline refresh', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const initial = await seed(page);
  await expect(page.locator('.focused-exercise__previous')).toContainText('55 kg × 7');
  const beforeBounds = (await completion(page, 'Focus').boundingBox())!;
  await completion(page, 'Focus').click();
  await expect(weight(page, 2)).toHaveValue('60');
  await expect(reps(page, 2)).toHaveValue('8');
  await expect(page.getByLabel('Current set suggestion', { exact: true })).toHaveText('Last-set suggestion · editable');
  const afterBounds = (await completion(page, 'Focus', 2).boundingBox())!;
  expect(Math.abs(afterBounds.y - beforeBounds.y)).toBeLessThanOrEqual(2);
  await expect(completion(page, 'Focus', 2)).toBeDisabled();
  await weight(page, 2).fill('62,5');
  await reps(page, 2).fill('7');
  await completion(page, 'Focus', 2).click();
  await expect(weight(page, 3)).toHaveValue('62.5');
  await expect(reps(page, 3)).toHaveValue('7');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  await expect(quickRow(page, 3).getByRole('textbox', { name: `${PRESS} set 3 weight in kilograms`, exact: true })).toHaveValue('62.5');
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.getByRole('button', { name: 'All sets', exact: true }).click();
  await expect(weight(page, 3)).toHaveValue('62.5');
  await expect(reps(page, 3)).toHaveValue('7');
  const beforeRefresh = await activeRecord(page);
  expect(beforeRefresh.session.exercises[0].logs.map(log => log.done)).toEqual([true, true, false]);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(weight(page, 3)).toHaveValue('62.5');
  expect(await activeRecord(page)).toEqual(beforeRefresh);
  expect((await read(page)).sessions.find(record => record.session.id === initial.historical.id)?.session).toEqual(initial.historical);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('planned zero and manual blanks survive completion and refresh; explicit copy fixes invalid input with the truthful source ordinal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const initial = await seed(page, { protectedDrafts: true });
  await showLayout(page, 'Quick Log');
  await completion(page, 'Quick Log').click();
  let saved = await activeRecord(page);
  expect(saved.session.exercises[0].logs[1]).toEqual(initial.active.exercises[0].logs[1]);
  expect(saved.session.exercises[0].logs[2]).toEqual(initial.active.exercises[0].logs[2]);
  await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click(); await showLayout(page, 'Quick Log');
  await expect(weight(page, 2)).toHaveValue('0'); await expect(reps(page, 2)).toHaveValue('5');
  await expect(weight(page, 3)).toHaveValue(''); await expect(reps(page, 3)).toHaveValue('');
  await weight(page, 2).fill('12..5');
  await expect(weight(page, 2)).toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: `Copy last completed ${PRESS} set 1 to set 2`, exact: true }).click();
  await expect(weight(page, 2)).toHaveValue('60'); await expect(reps(page, 2)).toHaveValue('8');
  await expect(weight(page, 2)).not.toHaveAttribute('aria-invalid', 'true');
  await completion(page, 'Quick Log', 2).click();
  saved = await activeRecord(page);
  expect(saved.session.exercises[0].logs[2]).toEqual(initial.active.exercises[0].logs[2]);
  await page.getByRole('button', { name: `Copy last completed ${PRESS} set 2 to set 3`, exact: true }).click();
  await expect(weight(page, 3)).toHaveValue('60'); await expect(reps(page, 3)).toHaveValue('8');
  await completion(page, 'Quick Log', 3).click();
  await expect(weight(page, 4)).toHaveValue('60'); await expect(reps(page, 4)).toHaveValue('8');
  expect((await activeRecord(page)).session.exercises[0].logs.map(log => log.done)).toEqual([true, true, true, false]);
  expect((await read(page)).sessions).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Undo preserves entered values and a corrected completion updates only untouched generated drafts', async ({ page }) => {
  await seed(page);
  await completion(page, 'Focus').click();
  await expect(weight(page, 2)).toHaveValue('60');
  await page.getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect(weight(page, 1)).toHaveValue('60'); await expect(reps(page, 1)).toHaveValue('8');
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await weight(page, 1).fill('62.5'); await reps(page, 1).fill('7');
  await completion(page, 'Focus').click();
  await expect(weight(page, 2)).toHaveValue('62.5'); await expect(reps(page, 2)).toHaveValue('7');
  await weight(page, 2).fill(''); await reps(page, 2).fill(''); await page.clock.runFor(1000);
  await page.getByRole('button', { name: 'Undo last set', exact: true }).click();
  await weight(page, 1).fill('65'); await reps(page, 1).fill('6');
  await completion(page, 'Focus').click();
  await expect(weight(page, 2)).toHaveValue(''); await expect(reps(page, 2)).toHaveValue('');
  const saved = await activeRecord(page);
  expect(saved.session.exercises[0].logs[1].inputSources).toEqual({ kg: 'manual', reps: 'manual' });
  expect(saved.session.exercises[0].logs.map(log => log.done)).toEqual([true, false, false]);
});

test('Focus keeps previous-workout reuse separate from the last completed set and neither action records work or rest', async ({ page }) => {
  const initial = await seed(page, { protectedDrafts: true });
  await completion(page, 'Focus').click();
  await expect(weight(page, 2)).toHaveValue('0'); await expect(reps(page, 2)).toHaveValue('5');
  const prior = page.getByRole('button', { name: `Reuse previous ${PRESS} set 2 weights and reps`, exact: true });
  const latest = page.getByRole('button', { name: `Copy last completed ${PRESS} set 1 to set 2`, exact: true });
  await expect(prior).toBeVisible(); await expect(latest).toBeVisible();
  await expect(page.locator('.focused-exercise__previous')).toContainText('55 kg × 7');
  const deadline = await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
  await prior.click();
  await expect(weight(page, 2)).toHaveValue('55'); await expect(reps(page, 2)).toHaveValue('7');
  await latest.click();
  await expect(weight(page, 2)).toHaveValue('60'); await expect(reps(page, 2)).toHaveValue('8');
  await page.clock.runFor(1000);
  const saved = await activeRecord(page);
  expect(saved.session.exercises[0].logs.map(log => log.done)).toEqual([true, false, false, false]);
  expect(saved.session.exercises[0].logs[1].inputSources).toEqual({ kg: 'manual', reps: 'manual' });
  expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);
  expect((await read(page)).sessions.find(record => record.session.id === initial.historical.id)?.session).toEqual(initial.historical);
});

test('paired completion prepares the same movement’s later round without changing its partner or prescribed rest', async ({ page }) => {
  const initial = await seed(page, { pair: true });
  await completion(page, 'Focus').click();
  await expect(page.getByRole('heading', { name: ROW, exact: true })).toBeVisible();
  let saved = await activeRecord(page);
  expect(saved.session.exercises[0].logs[1]).toMatchObject({ kg: 60, reps: 8, done: false });
  expect(saved.session.exercises[1]).toEqual(initial.active.exercises[1]);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await page.getByRole('button', { name: `Ready for ${ROW} set 1`, exact: true }).click();
  await completion(page, 'Focus', 1, ROW).click();
  saved = await activeRecord(page);
  expect(saved.session.exercises[1].logs[1]).toMatchObject({ kg: 35, reps: 10, done: false });
  expect(saved.session.exercises[0].superset).toEqual(initial.active.exercises[0].superset);
  expect(saved.session.exercises[1].superset).toEqual(initial.active.exercises[1].superset);
  expect(saved.session.exercises[0].rest).toBe(120);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const remaining = await page.evaluate(() => Number(sessionStorage.getItem('setline.rest-deadline.v1')) - Date.now());
  expect(remaining).toBeGreaterThan(85_000);
  expect(remaining).toBeLessThanOrEqual(90_000);
});

test('editing completed history keeps its unfinished sets and a separate active workout unchanged', async ({ page }) => {
  const initial = await seed(page, { historyIncomplete: true });
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'View history', exact: true }).click();
  await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'Earlier completed strength', exact: true }) }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Edit this log', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done editing', exact: true })).toBeVisible();
  await page.getByRole('button', { name: `View ${PRESS} set 1, complete`, exact: true }).click();
  await weight(page, 1).fill('57.5'); await reps(page, 1).fill('8');
  await page.clock.runFor(1000);
  await page.getByRole('button', { name: `Undo ${PRESS} set 1`, exact: true }).click();
  await page.getByRole('button', { name: `Ready for ${PRESS} set 1`, exact: true }).click();
  await completion(page, 'Focus').click();
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  const state = await read(page);
  const historical = state.sessions.find(record => record.session.id === initial.historical.id)!.session;
  expect(historical.exercises[0].logs[0]).toMatchObject({ kg: 57.5, reps: 8, done: true });
  expect(historical.exercises[0].logs.slice(1)).toEqual(initial.historical.exercises[0].logs.slice(1));
  expect(state.sessions.find(record => record.session.id === initial.active.id)).toEqual({ session: initial.active, version: 1 });
  expect(state.profile).toEqual(initial.profile);
});
