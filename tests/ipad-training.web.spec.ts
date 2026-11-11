import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-11';
const PRESS = 'Machine Chest Press';
const ROW = 'Chest-Supported Row';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const weight = (page: Page, name: string, number = 1) => page.getByRole('textbox', { name: `${name} set ${number} weight in kilograms`, exact: true });
const reps = (page: Page, name: string, number = 1) => page.getByRole('spinbutton', { name: `${name} set ${number} reps`, exact: true });
const navigator = (page: Page) => page.getByRole('navigation', { name: 'Workout exercises', exact: true });

async function seed(page: Page, appearance: 'light' | 'dark' = 'light') {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
  const movements = [
    ExerciseSchema.parse({ key: 'ipad-press', exerciseId: 'machine-chest-press', name: PRESS, group: 'Strength', mode: 'weight', sets: 3, target: '8 reps', rest: 120, perSide: false, equipmentLabel: 'QA machine A' }),
    ExerciseSchema.parse({ key: 'ipad-row', exerciseId: 'chest-supported-row', name: ROW, group: 'Strength', mode: 'weight', sets: 3, target: '10 reps', rest: 90, perSide: false, equipmentLabel: 'QA supported machine' }),
  ];
  const plan = { ...DEFAULT_PROFILE.plan[2], name: 'QA iPad strength', warmup: [], cooldown: [], exercises: movements };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance, presentationMode: 'athlete',
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 2 ? plan : day) });
  const history = SessionSchema.parse(stopSessionTimers(createSession(plan, 2, '2026-11-04', profile, []), 'completed'));
  history.exercises.forEach((exercise, index) => exercise.logs.forEach(log => Object.assign(log, { kg: index ? 35 : 55, reps: index ? 10 : 8, rir: 2, done: true })));
  const active = SessionSchema.parse(createSession(plan, 2, DATE, profile, [history]));
  active.runningSince = null;
  active.exercises.forEach((exercise, index) => exercise.logs.forEach(log => Object.assign(log, { kg: index ? 37.5 : 60, reps: index ? 10 : 8, done: false })));
  const state = { schemaVersion: 1, profile, profileVersion: 3, sessions: [{ session: history, version: 2 }, { session: active, version: 1 }],
    nutrition: [{ id: 'ipad-preserved-check-in', date: DATE, version: 1, payload: { kind: 'weight', kg: 70 } }], activities: [] };
  await page.evaluate(state => localStorage.setItem('setline.gym.v1', JSON.stringify(state)), state);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  return { ...state, active, history };
}

test('wide exercise selection preserves entered sets, Quick Log state, rest ownership and history through a narrow resize', async ({ page }) => {
  await page.setViewportSize({ width: 1194, height: 834 });
  const before = await seed(page);
  await expect(navigator(page)).toBeVisible();
  const navBox = (await navigator(page).boundingBox())!;
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  const currentBox = (await current.boundingBox())!;
  expect(navBox.x + navBox.width).toBeLessThan(currentBox.x);
  await weight(page, PRESS).fill('62,5');
  await reps(page, PRESS).fill('7');
  await navigator(page).getByRole('button', { name: `Select ${ROW}`, exact: true }).click();
  await expect(current.getByRole('heading', { name: ROW, exact: true })).toBeVisible();
  await weight(page, ROW).fill('40');
  await navigator(page).getByRole('button', { name: `Select ${PRESS}`, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(weight(page, PRESS)).toHaveValue('62.5');
  await expect(reps(page, PRESS)).toHaveValue('7');
  await expect(current.locator('.focused-exercise__previous')).toContainText('55 kg × 8');
  await current.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true }).evaluate(button => {
    for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
  });
  const session = async () => (await read(page)).sessions.find((record: { session: { id: string } }) => record.session.id === before.active.id).session;
  await expect.poll(async () => (await session()).exercises[0].logs.map((log: { done: boolean }) => log.done)).toEqual([true, false, false]);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const restBefore = await page.evaluate(() => ({ deadline: sessionStorage.getItem('setline.rest-deadline.v1'), owner: sessionStorage.getItem('setline.rest-owner.v16') }));
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const quick = page.getByRole('region', { name: 'Quick Log workout', exact: true });
  await expect(quick.getByRole('button', { name: `Completed ${PRESS} set 1`, exact: true })).toBeDisabled();
  await navigator(page).getByRole('button', { name: `Select ${ROW}`, exact: true }).click();
  await expect(weight(page, ROW)).toHaveValue('40');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(navigator(page)).not.toBeVisible();
  await expect(quick).toBeVisible();
  await expect(weight(page, PRESS)).toHaveValue('62.5');
  await expect(weight(page, ROW)).toHaveValue('40');
  expect(await page.evaluate(() => ({ deadline: sessionStorage.getItem('setline.rest-deadline.v1'), owner: sessionStorage.getItem('setline.rest-owner.v16') }))).toEqual(restBefore);
  await quick.getByRole('button', { name: 'Undo last set', exact: true }).click();
  expect((await session()).exercises[0].logs[0]).toMatchObject({ kg: 62.5, reps: 7, done: false });
  await page.setViewportSize({ width: 1194, height: 834 });
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(navigator(page)).toBeVisible();
  await expect(weight(page, PRESS)).toHaveValue('62.5');
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const saved = await read(page);
  expect(saved.profile).toEqual(before.profile);
  expect(saved.nutrition).toEqual(before.nutrition);
  expect(saved.sessions).toHaveLength(2);
  expect(saved.sessions.find((record: { session: { id: string } }) => record.session.id === before.history.id)).toEqual(before.sessions[0]);
  expect((await session()).exercises[0].logs[0]).toMatchObject({ kg: 62.5, reps: 7, done: false });
  expect((await session()).exercises[1].logs[0]).toMatchObject({ kg: 40, reps: 10, done: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the wide selector keeps an invalid Focus draft mounted until explicitly corrected', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  const before = await seed(page, 'dark');
  await weight(page, PRESS).fill('62..5');
  await navigator(page).getByRole('button', { name: `Select ${ROW}`, exact: true }).click();
  await expect(weight(page, PRESS)).toHaveValue('62..5');
  await expect(weight(page, PRESS)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true }).getByRole('heading', { name: PRESS, exact: true })).toBeVisible();
  await weight(page, PRESS).fill('62.5');
  await navigator(page).getByRole('button', { name: `Select ${ROW}`, exact: true }).click();
  await expect(weight(page, ROW)).toHaveValue('37.5');
  const after = await read(page);
  expect(after.sessions.find((record: { session: { id: string } }) => record.session.id === before.history.id)).toEqual(before.sessions[0]);
  expect(after.sessions.find((record: { session: { id: string } }) => record.session.id === before.active.id).session.exercises.every((exercise: { logs: { done: boolean }[] }) => exercise.logs.every(log => !log.done))).toBe(true);
});

for (const size of [{ width: 768, height: 1024 }, { width: 820, height: 1180 }, { width: 1024, height: 768 }, { width: 1366, height: 1024 }]) {
  test(`active workout responds to actual ${size.width}×${size.height} window width and enlarged text without overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await seed(page, size.width === 1024 ? 'dark' : 'light');
    if (size.width < 1024) await expect(navigator(page)).not.toBeVisible();
    else await expect(navigator(page)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`workout-${size.width}-${size.height}.png`), fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await expect(navigator(page)).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const complete = page.getByRole('button', { name: `Complete ${PRESS} set 1`, exact: true });
    await complete.scrollIntoViewIfNeeded();
    expect(await complete.evaluate(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.height >= 44 && box.width >= 44 && !!hit && element.contains(hit);
    })).toBe(true);
  });
}
