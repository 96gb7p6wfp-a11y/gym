import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const PRESS = 'Machine Chest Press';

const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const rest = (page: Page) => page.evaluate(() => ({
  deadline: sessionStorage.getItem('setline.rest-deadline.v1'),
  owner: JSON.parse(sessionStorage.getItem('setline.rest-owner.v16')!),
}));

/** Scroll to a control, then check the actual hit target above fixed overlays. */
async function reachableByTouch(control: Locator) {
  await control.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect.poll(() => control.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    return bounds.width >= 44 && bounds.height >= 44 && bounds.top >= 0 && bounds.bottom <= innerHeight
      && hit !== null && element.contains(hit);
  })).toBe(true);
}

test('320px Quick Log keeps suggested inputs and completion touchable while rest is active', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
  const movement = ExerciseSchema.parse({ key: 'v18-small-press', exerciseId: 'chest-press', name: PRESS,
    group: 'Strength', sets: 3, target: '8 reps', mode: 'weight', rest: 120, perSide: false });
  const plan = { ...DEFAULT_PROFILE.plan[0], name: 'Small-screen strength', warmup: [], cooldown: [], exercises: [movement] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance: 'light', presentationMode: 'athlete',
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) });
  const historical = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-10-26', profile, []), 'completed'));
  historical.exercises[0].logs.forEach(log => Object.assign(log, { kg: 55, reps: 8, done: true }));
  const active = SessionSchema.parse(createSession(plan, 0, DATE, profile, []));
  active.runningSince = null;
  Object.assign(active.exercises[0].logs[0], { kg: 60, reps: 8, rir: 2 });
  await page.evaluate(({ key, profile, active, historical }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 3,
    sessions: [{ session: historical, version: 2 }, { session: active, version: 1 }], nutrition: [], activities: [],
  })), { key: STORE, profile, active, historical });
  await page.reload();
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  await page.getByRole('tab', { name: 'Train', exact: true }).tap();
  await page.getByRole('button', { name: 'Quick Log', exact: true }).tap();
  const quick = page.getByRole('region', { name: 'Quick Log workout', exact: true });
  const completeFirst = quick.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true });
  await reachableByTouch(completeFirst);
  await completeFirst.tap();
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const firstRest = await rest(page);
  expect(firstRest.owner).toEqual({ sessionId: active.id, exerciseKey: movement.key, setId: active.exercises[0].logs[0].id });
  const remaining = await page.evaluate(() => Number(sessionStorage.getItem('setline.rest-deadline.v1')) - Date.now());
  expect(remaining).toBeGreaterThan(115_000);
  expect(remaining).toBeLessThanOrEqual(120_000);
  const secondRow = quick.getByRole('group', { name: `Quick log ${PRESS} set 2`, exact: true });
  const weight = secondRow.getByRole('textbox', { name: `${PRESS} set 2 weight in kilograms`, exact: true });
  const reps = secondRow.getByRole('spinbutton', { name: `${PRESS} set 2 reps`, exact: true });
  await expect(weight).toHaveValue('60');
  await expect(reps).toHaveValue('8');
  await reachableByTouch(weight);
  await weight.tap();
  await weight.fill('62,5');
  await reachableByTouch(reps);
  await reps.tap();
  await reps.fill('7');
  await reps.press('Enter');
  expect(await rest(page)).toEqual(firstRest);
  const completeSecond = secondRow.getByRole('button', { name: `Complete ${PRESS} set 2`, exact: true });
  await reachableByTouch(completeSecond);
  await completeSecond.tap();
  await expect.poll(async () => {
    const saved = await read(page);
    return saved.sessions.find((record: { session: { id: string } }) => record.session.id === active.id).session.exercises[0].logs.map((log: { done: boolean }) => log.done);
  }).toEqual([true, true, false]);
  const saved = await read(page);
  const current = saved.sessions.find((record: { session: { id: string } }) => record.session.id === active.id).session;
  expect(current.exercises[0].logs[1]).toEqual({ ...active.exercises[0].logs[1], kg: 62.5, reps: 7, done: true,
    inputSources: { kg: 'manual', reps: 'manual' } });
  expect(current.exercises[0].logs[2]).toEqual({ ...active.exercises[0].logs[2], kg: 62.5, reps: 7,
    inputSources: { kg: 'last-set', reps: 'last-set' } });
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  expect((await rest(page)).owner).toEqual({ sessionId: active.id, exerciseKey: movement.key, setId: active.exercises[0].logs[1].id });
  expect(saved.sessions).toHaveLength(2);
  expect(saved.sessions.find((record: { session: { id: string } }) => record.session.id === historical.id)).toEqual({ session: historical, version: 2 });
  expect(saved.profile).toEqual(profile);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
