import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const NAME = 'Machine Chest Press';
const DATE = '2026-11-02';

async function seed(page: Page) {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === NAME)!;
  const plan = { ...DEFAULT_PROFILE.plan[0], warmup: [], cooldown: [], exercises: [{ ...movement, key: 'v16-all-sets-press', exerciseId: 'chest-press', sets: 3 }] };
  const session = SessionSchema.parse(createSession(plan, 0, DATE, DEFAULT_PROFILE, []));
  session.startedAt = Date.parse(`${DATE}T10:00:00Z`);
  session.runningSince = null;
  session.exercises[0].logs = session.exercises[0].logs.map((log, index) => ({ ...log, kg: 62.5 - index * 2.5, reps: 8 - index, rir: 2,
    inputSources: { kg: 'manual' as const, reps: 'manual' as const } }));
  await page.evaluate(({ key, profile, session }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session, version: 1 }], nutrition: [], activities: [],
  })), { key: STORE, profile: DEFAULT_PROFILE, session });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('region', { name: 'Current exercise', exact: true }).getByRole('button', { name: 'All sets', exact: true }).click();
  return session;
}

async function record(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions[0], STORE);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const activation of ['mouse', 'touch', 'pointer', 'keyboard'] as const) {
  test(`SL-001 All sets ten rapid ${activation} activations complete one immutable set once`, async ({ page }) => {
    const initial = await seed(page);
    const target = page.getByRole('checkbox', { name: `Complete ${NAME} set 1`, exact: true });
    await target.evaluate(element => element.scrollIntoView({ block: 'center' }));
    if (activation === 'keyboard') {
      await target.focus();
      for (let index = 0; index < 10; index++) await page.keyboard.press('Space');
    } else if (activation === 'pointer') {
      for (let index = 0; index < 10; index++) await target.evaluate(element => {
        element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'pen' }));
        element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'pen' }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    } else {
      const box = (await target.boundingBox())!;
      for (let index = 0; index < 10; index++) {
        if (activation === 'touch') await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      }
    }
    await expect.poll(async () => (await record(page)).session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
    const saved = await record(page);
    expect(saved.version).toBe(2);
    expect(saved.session.exercises[0].logs[0]).toEqual({ ...initial.exercises[0].logs[0], done: true });
    expect(saved.session.exercises[0].logs.slice(1)).toEqual(initial.exercises[0].logs.slice(1));
    await expect(target).toBeChecked();
    await expect(target).toBeDisabled();
    await expect(page.locator('.rest-floating')).toHaveCount(1);
    const deadline = await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'));
    expect(deadline).not.toBeNull();
    await target.dispatchEvent('click');
    expect((await record(page)).version).toBe(2);
    expect(await page.evaluate(() => sessionStorage.getItem('setline.rest-deadline.v1'))).toBe(deadline);
  });
}

test('All sets undo is a separate action, preserves entered values and permits deliberate next-set completion', async ({ page }) => {
  const initial = await seed(page);
  const complete = (number: number) => page.getByRole('checkbox', { name: `Complete ${NAME} set ${number}`, exact: true });
  await complete(1).check();
  const undo = page.getByRole('button', { name: `Undo ${NAME} set 1`, exact: true });
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect.poll(async () => (await record(page)).session.exercises[0].logs).toEqual(initial.exercises[0].logs);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await expect(undo).toBeDisabled();
  await complete(1).check();
  await complete(2).check();
  await expect.poll(async () => (await record(page)).session.exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, true, false]);
  expect((await record(page)).session.exercises[0].logs.slice(0, 2)).toEqual(initial.exercises[0].logs.slice(0, 2).map(log => ({ ...log, done: true })));
  const beforeRefresh = await record(page);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  expect(await record(page)).toEqual(beforeRefresh);
});
