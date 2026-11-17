import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const NAME = 'Machine Chest Press';
const DATE = '2026-11-02';

async function seed(page: Page) {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === NAME)!;
  const plan = { ...DEFAULT_PROFILE.plan[0], warmup: [], cooldown: [], exercises: [{ ...movement, key: 'chest-copy', exerciseId: 'chest-press', sets: 2 }] };
  const old = SessionSchema.parse(createSession(plan, 0, '2026-10-26', DEFAULT_PROFILE, []));
  old.startedAt = Date.parse('2026-10-26T10:00:00Z');
  const prior = SessionSchema.parse(stopSessionTimers(old, 'completed'));
  prior.exercises[0].logs = prior.exercises[0].logs.map((log, index) => ({ ...log, kg: index ? 0 : 12.5, reps: index ? 6 : 8, rir: 1, done: true }));
  const active = SessionSchema.parse(createSession(plan, 0, DATE, DEFAULT_PROFILE, []));
  active.startedAt = Date.parse(`${DATE}T10:00:00Z`);
  active.runningSince = null;
  await page.evaluate(({ key, profile, prior, active }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: prior, version: 1 }, { session: active, version: 1 }], nutrition: [], activities: [] })), { key: STORE, profile: DEFAULT_PROFILE, prior, active });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  return { prior, active };
}

async function saved(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions, STORE);
}

async function openEffort(page: Page) {
  const effort = page.getByRole('region', { name: 'Current exercise', exact: true }).locator('details.focused-effort');
  if (!await effort.evaluate(element => element.hasAttribute('open'))) await effort.locator(':scope > summary').click();
  return effort;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('one tap reuses only the current unfinished set, clears invalid drafts and preserves history through refresh', async ({ page }) => {
  const { prior, active } = await seed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  const weight = focus.getByRole('textbox', { name: `${NAME} set 1 weight in kilograms`, exact: true });
  const reps = focus.getByRole('spinbutton', { name: `${NAME} set 1 reps`, exact: true });
  await expect(weight).toHaveValue('');
  await expect(reps).toHaveValue('8');
  expect(active.exercises[0].logs[0].inputSources?.reps).toBe('default');
  await openEffort(page);
  await expect(focus.getByRole('button', { name: 'Clear reps in reserve', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await weight.fill('12kg');
  await expect(weight).toHaveAttribute('aria-invalid', 'true');
  await focus.getByRole('button', { name: `Reuse previous ${NAME} set 1 weights and reps`, exact: true }).click();
  await expect(weight).toHaveValue('12.5');
  await expect(weight).not.toHaveAttribute('aria-invalid', 'true');
  await expect(reps).toHaveValue('8');
  await expect.poll(async () => (await saved(page)).find((entry: any) => entry.session.id === active.id).session.exercises[0].logs[0].kg).toBe(12.5);
  const records = await saved(page);
  const current = records.find((entry: any) => entry.session.id === active.id).session;
  expect(current.exercises[0].logs[0]).toMatchObject({ kg: 12.5, reps: 8, rir: null, done: false, seconds: null });
  expect(current.exercises[0].logs[1]).toEqual(active.exercises[0].logs[1]);
  expect(records.find((entry: any) => entry.session.id === prior.id).session).toEqual(prior);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(weight).toHaveValue('12.5');
  await expect(reps).toHaveValue('8');
  await focus.getByRole('button', { name: `View ${NAME} set 2`, exact: true }).click();
  await focus.getByRole('button', { name: `Reuse previous ${NAME} set 2 weights and reps`, exact: true }).click();
  await expect(focus.getByRole('textbox', { name: `${NAME} set 2 weight in kilograms`, exact: true })).toHaveValue('0');
  await expect(focus.getByRole('spinbutton', { name: `${NAME} set 2 reps`, exact: true })).toHaveValue('6');
});

test('quick RIR is explicit, clearable and persists without completing a set or starting rest', async ({ page }) => {
  const { active } = await seed(page);
  await openEffort(page);
  const quick = page.getByRole('group', { name: 'Quick reps in reserve', exact: true });
  await expect(quick.getByRole('button', { name: 'Clear reps in reserve', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await quick.getByRole('button', { name: '2 reps in reserve', exact: true }).click();
  await expect(quick.getByRole('button', { name: '2 reps in reserve', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await saved(page)).find((entry: any) => entry.session.id === active.id).session.exercises[0].logs[0].rir).toBe(2);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await openEffort(page);
  await expect(quick.getByRole('button', { name: '2 reps in reserve', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await quick.getByRole('button', { name: '0 reps in reserve', exact: true }).click();
  await expect.poll(async () => (await saved(page)).find((entry: any) => entry.session.id === active.id).session.exercises[0].logs[0].rir).toBe(0);
  await quick.getByRole('button', { name: 'Clear reps in reserve', exact: true }).click();
  await expect.poll(async () => (await saved(page)).find((entry: any) => entry.session.id === active.id).session.exercises[0].logs[0].rir).toBe(null);
  const current = (await saved(page)).find((entry: any) => entry.session.id === active.id).session;
  expect(current.exercises[0].logs[0]).toEqual(active.exercises[0].logs[0]);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
});

// Optional effort controls must not push the primary logging action under the tabs.
test('Complete set stays above floating navigation on a narrow iPhone before scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await seed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  const complete = focus.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true });
  const bounds = await complete.boundingBox();
  const navigation = await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox();
  expect(bounds).not.toBeNull(); expect(navigation).not.toBeNull();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(navigation!.y);
});

test('effort stays secondary until requested and its value survives closing, switching layouts and refresh', async ({ page }) => {
  const { prior, active } = await seed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  const raw = () => page.evaluate(() => localStorage.getItem('setline.gym.v1'));
  const before = await raw();
  await expect(focus.getByRole('group', { name: 'Quick reps in reserve', exact: true })).toHaveCount(0);
  const effort = await openEffort(page);
  await expect(focus.getByRole('group', { name: 'Quick reps in reserve', exact: true })).toBeVisible();
  expect(await raw()).toBe(before, 'opening secondary information is read-only');
  await focus.getByRole('button', { name: '3 reps in reserve', exact: true }).click();
  await effort.locator(':scope > summary').click();
  await expect(effort.locator(':scope > summary')).toContainText('3 reps in reserve');
  await expect(focus.getByRole('group', { name: 'Quick reps in reserve', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(effort.locator(':scope > summary')).toContainText('3 reps in reserve');
  await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(effort.locator(':scope > summary')).toContainText('3 reps in reserve');
  const records = await saved(page), current = records.find((row: any) => row.session.id === active.id).session;
  expect(current.exercises[0].logs[0]).toEqual({ ...active.exercises[0].logs[0], rir: 3 });
  expect(records.find((row: any) => row.session.id === prior.id).session).toEqual(prior);
  await expect(page.locator('.rest-floating')).toHaveCount(0);
});

test('consecutive rest adjustments accumulate on the saved deadline and Skip survives refresh', async ({ page }) => {
  const { active } = await seed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  await focus.getByRole('textbox', { name: `${NAME} set 1 weight in kilograms`, exact: true }).fill('60');
  await focus.getByRole('spinbutton', { name: `${NAME} set 1 reps`, exact: true }).fill('8');
  await focus.getByRole('button', { name: `Complete ${NAME} set 1`, exact: true }).click();
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  const deadline = () => page.evaluate(() => JSON.parse(sessionStorage.getItem('setline.rest-deadline.v1') ?? 'null'));
  const originalDeadline = await deadline();
  const before = (await saved(page)).find((row: any) => row.session.id === active.id);
  await page.getByRole('button', { name: 'Add 15 seconds rest', exact: true }).evaluate(button => {
    for (let tap = 0; tap < 10; tap++) (button as HTMLButtonElement).click();
  });
  expect(await deadline()).toBe(originalDeadline + 150_000);
  await page.getByRole('button', { name: 'Reduce rest by 15 seconds', exact: true }).evaluate(button => {
    for (let tap = 0; tap < 10; tap++) (button as HTMLButtonElement).click();
  });
  expect(await deadline()).toBe(originalDeadline);
  await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  expect(await deadline()).toBe(originalDeadline);
  await expect(page.locator('.rest-floating')).toHaveCount(1);
  expect((await saved(page)).find((row: any) => row.session.id === active.id)).toEqual(before, 'adjusting rest does not mutate a logged set');
  await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  expect(await deadline()).toBe(null);
  await page.reload(); await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.locator('.rest-floating')).toHaveCount(0);
  expect(await deadline()).toBe(null);
});
