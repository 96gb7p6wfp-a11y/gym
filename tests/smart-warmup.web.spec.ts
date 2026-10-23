import { expect, test, type Locator, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { createVolleyballMasterPlan, MasterProgramSettingsSchema } from '../src/volleyball-master-plan';

const KEY = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
async function seed(page: Page, kind: 'strength' | 'recovery' = 'strength', appearance: 'light' | 'dark' = 'light') {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.goto('/');
  const profile = { ...structuredClone(DEFAULT_PROFILE), appearance };
  profile.plan[0] = kind === 'recovery' ? { name: 'Recovery', kind, minutes: 15, note: '', exercises: [] }
    : { ...profile.plan[0], name: 'Upper strength', goal: 'strength', exercises: profile.plan[0].exercises.slice(1, 3) };
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 0, sessions: [], nutrition: [], activities: [] })), { key: KEY, profile });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}
const preparation = (page: Page) => page.getByRole('dialog', { name: 'Warm-up', exact: true });
const rows = (page: Page) => preparation(page).getByRole('list', { name: 'Quick warm-up exercises', exact: true }).locator(':scope > li');
const start = (page: Page) => preparation(page).getByRole('button', { name: 'Start workout', exact: true });
async function openPreparation(page: Page) {
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(preparation(page)).toBeVisible();
}
async function expectOnScreen(page: Page, control: Locator) {
  await expect(control).toBeVisible();
  await expect.poll(async () => {
    const box = await control.boundingBox();
    return !!box && box.y >= 47 && box.y + box.height <= (page.viewportSize()!.height - 34);
  }).toBe(true);
}

test('quick preparation is optional and the main session starts only on the explicit Start workout tap', async ({ page }) => {
  await seed(page);
  const original = await read(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('list', { name: 'Scheduled exercises', exact: true }).getByRole('listitem')).toHaveCount(2);
  expect(await read(page)).toEqual(original);
  await preview.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(preparation(page)).toBeVisible();
  const count = await rows(page).count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(4);
  await expect(start(page)).toBeEnabled();
  for (const check of await rows(page).getByRole('checkbox').all()) await expect(check).not.toBeChecked();
  expect((await read(page)).sessions).toEqual([]);
  const startedAt = await page.evaluate(() => Date.now());
  await start(page).click();
  await expect(preparation(page)).not.toBeVisible();
  const active = (await read(page)).sessions[0].session;
  expect(active.startedAt).toBeGreaterThanOrEqual(startedAt);
  expect(active.elapsedMs).toBe(0);
  expect(active.warmupStatus).toBe('not-recorded');
  expect(active.warmupCompletedAt).toBeUndefined();
  expect(active.warmupOverride).toBe(false);
  expect(active.warmup.every((step: { done: boolean }) => !step.done)).toBe(true);
  expect((await read(page)).profile.plan).toEqual(original.profile.plan);
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('spinbutton', { name: /set 1 reps$/ }).fill('8');
  await current.getByRole('textbox', { name: /set 1 weight in kilograms$/ }).fill('12.5');
  await current.getByRole('button', { name: /^Complete .* set 1$/ }).click();
  await expect(page.locator('.rest-floating').getByRole('button', { name: 'Skip rest', exact: true })).toBeVisible();
  await page.locator('.rest-floating').getByRole('button', { name: 'Skip rest', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByLabel('Workout duration · minutes', { exact: true }).fill('20');
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Workout complete summary', exact: true })).toBeVisible();
  await page.reload();
  const saved = (await read(page)).sessions[0].session;
  expect(saved.status).toBe('completed');
  expect(saved.exercises[0].logs[0]).toMatchObject({ done: true, kg: 12.5, reps: 8 });
  expect(saved.warmup).toEqual(active.warmup);
  expect(saved.warmupStatus).toBe('not-recorded');
});

test('one-tap completion checks only the quick selection and survives refresh without creating history', async ({ page }) => {
  await seed(page);
  const original = await read(page);
  await openPreparation(page);
  const quickCount = await rows(page).count();
  await preparation(page).getByRole('button', { name: 'Mark warm-up complete', exact: true }).click();
  for (const check of await rows(page).getByRole('checkbox').all()) await expect(check).toBeChecked();
  const draft = (await read(page)).profile.sessionDrafts[0];
  expect(draft.plan.warmup.filter((step: { done: boolean }) => step.done)).toHaveLength(quickCount);
  expect(draft.plan.warmup.some((step: { done: boolean }) => !step.done)).toBe(true);
  expect((await read(page)).sessions).toEqual([]);
  expect((await read(page)).profile.plan).toEqual(original.profile.plan);
  await page.clock.fastForward(180_000);
  await page.reload();
  await openPreparation(page);
  await expect(rows(page)).toHaveCount(quickCount);
  for (const check of await rows(page).getByRole('checkbox').all()) await expect(check).toBeChecked();
  expect((await read(page)).sessions).toEqual([]);
  await start(page).click();
  await expect(preparation(page)).not.toBeVisible();
  const active = (await read(page)).sessions[0].session;
  expect(active.warmupStatus).toBe('prepared');
  expect(active.warmupCompletedAt).toBeGreaterThanOrEqual(active.startedAt);
  expect(active.warmup.filter((step: { done: boolean }) => step.done)).toHaveLength(quickCount);
  expect(active.warmup.some((step: { done: boolean }) => !step.done)).toBe(true);
  await page.reload();
  expect((await read(page)).sessions[0].session.warmup).toEqual(active.warmup);
  expect((await read(page)).sessions[0].session.warmupStatus).toBe('prepared');
});

test('recovery remains gentle and Already warmed up never fabricates checked steps', async ({ page }) => {
  await seed(page, 'recovery');
  await page.getByRole('button', { name: 'Start recovery', exact: true }).click();
  await expect(preparation(page)).toBeVisible();
  expect(await rows(page).count()).toBeLessThanOrEqual(3);
  await expect(preparation(page).getByRole('list', { name: 'Quick warm-up exercises', exact: true })).not.toContainText(/Pogo|Jump Ramp-Up/);
  await expect(start(page)).toBeEnabled();
  await preparation(page).getByRole('button', { name: 'Already warmed up', exact: true }).click();
  expect((await read(page)).sessions).toEqual([]);
  await start(page).click();
  await expect(preparation(page)).not.toBeVisible();
  const session = (await read(page)).sessions[0].session;
  expect(session.kind).toBe('recovery');
  expect(session.warmupOverride).toBe(true);
  expect(session.warmupStatus).toBe('elsewhere');
  expect(session.warmupCompletedAt).toBeGreaterThanOrEqual(session.startedAt);
  expect(session.warmup.every((step: { done: boolean }) => !step.done)).toBe(true);
});

test('a safe quick-prep substitution and individual check persist without starting the session', async ({ page }) => {
  await seed(page);
  await openPreparation(page);
  const first = rows(page).first();
  await first.locator('summary').click();
  const choice = first.locator('.warmup-flow__alternatives button').first();
  const name = await choice.locator('strong').innerText();
  await choice.click();
  await expect(first.getByRole('heading')).toHaveText(name);
  await first.getByRole('checkbox').check();
  await expect(first.getByRole('checkbox')).toBeChecked();
  await preparation(page).getByRole('button', { name: 'Close', exact: true }).click();
  expect((await read(page)).sessions).toEqual([]);
  await page.reload();
  await openPreparation(page);
  await expect(rows(page).first().getByRole('heading')).toHaveText(name);
  await expect(rows(page).first().getByRole('checkbox')).toBeChecked();
  await expect(start(page)).toBeEnabled();
});

test('a saved day draft still respects later Saturday readiness changes', async ({ page }) => {
  await seed(page);
  const state = await read(page);
  const plan = createVolleyballMasterPlan();
  state.profile.plan = plan;
  state.profile.masterProgram = MasterProgramSettingsSchema.parse({ version: 1, startDate: '2026-10-19', matchWeeks: [], readiness: [{ date: '2026-10-24', status: 'green' }] });
  state.profile.sessionDrafts = [{ date: '2026-10-24', slot: 'main', plan: structuredClone(plan[5]), readiness: 'green' }];
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: KEY, state });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Reactive + Hard Lower B');
  await page.locator('.master-readiness > summary').click();
  const readiness = page.getByRole('group', { name: 'Program readiness', exact: true });
  await readiness.getByRole('button', { name: 'Yellow', exact: true }).click();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview).not.toContainText('Hurdle Hops');
  await expect(preview.getByRole('listitem').filter({ hasText: 'Approach Jump' })).toContainText('2 ×');
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await readiness.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Recovery');
  expect((await read(page)).sessions).toEqual([]);
});

test('a fresh session never inherits checked template steps and keeps its planned decimal weight', async ({ page }) => {
  await seed(page);
  const state = await read(page);
  state.profile.plan[0].exercises[0].defaultKg = 12.5;
  state.profile.plan[0].warmup = [{ key: 'saved-preparation', name: 'Arm Circles', target: '6 each way', cue: 'Stay comfortable.', done: true }];
  const previous = createSession(state.profile.plan[0], 0, '2026-10-12', state.profile, []);
  previous.exercises[0].logs[0] = { ...previous.exercises[0].logs[0], kg: 30, reps: 8, done: true };
  state.sessions = [{ version: 1, session: stopSessionTimers(previous, 'completed') }];
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: KEY, state });
  await page.reload();
  await openPreparation(page);
  await expect(start(page)).toBeEnabled();
  for (const check of await rows(page).getByRole('checkbox').all()) await expect(check).not.toBeChecked();
  await start(page).click();
  await expect(preparation(page)).not.toBeVisible();
  const saved = await read(page);
  const active = saved.sessions.find((entry: { session: { status: string } }) => entry.session.status === 'active').session;
  expect(active.exercises[0].logs[0].kg).toBe(12.5);
  expect(active.warmupStatus).toBe('not-recorded');
  expect(active.warmupCompletedAt).toBeUndefined();
  expect(saved.sessions.find((entry: { session: { status: string } }) => entry.session.status === 'completed')).toEqual(state.sessions[0]);
});

for (const appearance of ['light', 'dark'] as const) {
  for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
    test(`quick prep stays one clean screen at ${viewport.width}px in ${appearance}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await seed(page, 'strength', appearance);
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
        document.documentElement.style.setProperty('--app-safe-area-top', '47px');
        document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
      });
      await openPreparation(page);
      expect(await rows(page).count()).toBeLessThanOrEqual(4);
      await expect(start(page)).toBeEnabled();
      await expectOnScreen(page, preparation(page).getByRole('button', { name: 'Close', exact: true }));
      await expectOnScreen(page, start(page));
      if (viewport.width >= 390) {
        for (const row of await rows(page).all()) await expectOnScreen(page, row);
      } else {
        await rows(page).last().scrollIntoViewIfNeeded();
        await expect(rows(page).last()).toBeVisible();
        await expectOnScreen(page, start(page));
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await preparation(page).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      expect((await read(page)).sessions).toEqual([]);
      await page.screenshot({ path: `/tmp/setline-quick-${appearance}-${viewport.width}.png` });
    });
  }
}
