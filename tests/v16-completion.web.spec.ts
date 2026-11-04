import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const NAME = 'Machine Chest Press';
const DATE = '2026-11-02';

async function seed(page: Page) {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === NAME)!;
  const plan = { ...DEFAULT_PROFILE.plan[0], warmup: [], cooldown: [], exercises: [{ ...movement, key: 'v16-press', exerciseId: 'chest-press', sets: 3 }] };
  const active = SessionSchema.parse(createSession(plan, 0, DATE, DEFAULT_PROFILE, []));
  active.startedAt = Date.parse(`${DATE}T10:00:00Z`);
  active.runningSince = null;
  active.exercises[0].logs = active.exercises[0].logs.map((log, index) => ({ ...log, kg: 62.5 - index * 2.5, reps: 8 - index, rir: 2 }));
  await page.evaluate(({ key, profile, active }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: active, version: 1 }], nutrition: [], activities: [] })), { key: STORE, profile: DEFAULT_PROFILE, active });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  return active;
}

async function stored(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions, STORE);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const activation of ['mouse', 'touch', 'pointer', 'keyboard'] as const) {
  test(`SL-001 ten rapid ${activation} activations complete one set, never another set`, async ({ page }) => {
    const initial = await seed(page);
    const complete = page.locator('.focused-complete-set');
    await complete.scrollIntoViewIfNeeded();
    if (activation === 'keyboard') {
      await complete.focus();
      for (let index = 0; index < 10; index++) await page.keyboard.press('Enter');
    } else if (activation === 'pointer') {
      // Include a React render between requests: this covers stale handlers and
      // the newly rendered next-set handler, rather than only one JS event loop.
      for (let index = 0; index < 10; index++) {
        await complete.evaluate(element => {
          element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'pen' }));
          element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'pen' }));
          element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }
    } else {
      const box = (await complete.boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      for (let index = 0; index < 10; index++) {
        if (activation === 'touch') await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
      }
    }
    await expect.poll(async () => (await stored(page))[0].session.exercises[0].logs.filter((log: { done: boolean }) => log.done).length).toBe(1);
    const records = await stored(page);
    expect(records).toHaveLength(1);
    expect(records[0].version).toBe(2);
    expect(records[0].session.exercises[0].logs[0]).toEqual({ ...initial.exercises[0].logs[0], done: true });
    expect(records[0].session.exercises[0].logs.slice(1)).toEqual(initial.exercises[0].logs.slice(1));
    await expect(page.locator('.rest-floating')).toHaveCount(1);
    await expect(complete).toBeDisabled();
    const deadline = await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
    expect(deadline).not.toBeNull();
    await complete.dispatchEvent('click');
    expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);
    expect((await stored(page))[0].version).toBe(2);
  });
}

test('undo, intentional next-set completion and refresh preserve the same session and entered values', async ({ page }) => {
  const initial = await seed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  await focus.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).click();
  await expect(focus.getByRole('button', { name: `Complete ${NAME} set 2`, exact: true })).toBeDisabled();
  await focus.getByRole('button', { name: 'Undo last set', exact: true }).click();
  await expect.poll(async () => (await stored(page))[0].session.exercises[0].logs[0].done).toBe(false);
  expect((await stored(page))[0].session.exercises[0].logs).toEqual(initial.exercises[0].logs);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await focus.getByRole('button', { name: `View ${NAME} set 1`, exact: true }).click();
  await focus.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).click();
  await focus.getByRole('button', { name: `Ready for ${NAME} set 2`, exact: true }).click();
  await focus.getByRole('button', { name: `Complete ${NAME} set 2`, exact: true }).click();
  await expect.poll(async () => (await stored(page))[0].session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, true, false]);
  const before = await stored(page);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const after = await stored(page);
  expect(after).toEqual(before);
  expect(after[0].session.id).toBe(initial.id);
  await expect(focus.getByRole('button', { name: `Complete ${NAME} set 3`, exact: true })).toBeEnabled();
});

test('SL-001 timed auto-advance never prefills or rearms the next set during a ten-tap burst', async ({ page }) => {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === 'Pogo Jump')!;
  const plan = { ...DEFAULT_PROFILE.plan[0], warmup: [], cooldown: [], exercises: [{ ...movement, key: 'v16-pogo', sets: 3 }] };
  const initial = SessionSchema.parse(createSession(plan, 0, DATE, DEFAULT_PROFILE, []));
  initial.startedAt = Date.parse(`${DATE}T10:00:00Z`);
  initial.runningSince = null;
  initial.exercises[0].logs[0].seconds = 10;
  await page.evaluate(({ key, profile, active }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: active, version: 1 }], nutrition: [], activities: [] })), { key: STORE, profile: DEFAULT_PROFILE, active: initial });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const complete = page.locator('.focused-complete-set');
  for (let index = 0; index < 10; index++) await complete.dispatchEvent('click');
  await expect.poll(async () => (await stored(page))[0].session.exercises[0].logs.filter((log: { done: boolean }) => log.done).length).toBe(1);
  const saved = (await stored(page))[0];
  expect(saved.version).toBe(2);
  expect(saved.session.exercises[0].logs.slice(1)).toEqual(initial.exercises[0].logs.slice(1));
  await expect(complete).toBeDisabled();
  await expect(page.getByRole('spinbutton', { name: 'Pogo Jump set 2 seconds', exact: true })).toHaveValue('');
  // Explicitly reviewing the next set allows its normal duration preset again.
  await page.getByRole('button', { name: 'Ready for Pogo Jump set 2', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Pogo Jump set 2 seconds', exact: true })).toHaveValue('10');
  await expect(complete).toBeEnabled();
});
