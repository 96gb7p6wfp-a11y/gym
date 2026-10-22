import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, createSession, stopSessionTimers } from '../src/domain.js';
import { createVolleyballMasterPlan, MasterProgramSettingsSchema } from '../src/volleyball-master-plan';

const KEY = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), KEY);
async function seed(page: Page, kind: 'strength' | 'recovery' = 'strength') {
  await page.clock.install({ time: new Date('2026-10-19T10:00:00Z') });
  await page.goto('/');
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.plan[0] = kind === 'recovery' ? { name: 'Recovery', kind, minutes: 15, note: '', exercises: [] }
    : { ...profile.plan[0], name: 'Upper strength', goal: 'strength', exercises: profile.plan[0].exercises.slice(1, 3) };
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, profile, profileVersion: 0, sessions: [], nutrition: [], activities: [] })), { key: KEY, profile });
  await page.reload();
}
const gate = (page: Page) => page.getByRole('dialog', { name: 'Warm-up', exact: true });
async function completePreparation(page: Page) {
  const checks = gate(page).getByRole('checkbox');
  for (let index = 0; index < await checks.count(); index++) {
    await expect(checks.nth(index)).toBeEnabled();
    if (!await checks.nth(index).isChecked()) await checks.nth(index).check();
    await expect(checks.nth(index)).toBeChecked();
  }
  await expect(gate(page).getByRole('button', { name: 'Start main workout', exact: true })).toBeEnabled();
}

test('preparation is mandatory, survives refresh and starts the main clock only on explicit start', async ({ page }) => {
  await seed(page);
  const original = await read(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Workout preview', exact: true }).getByRole('listitem')).toHaveCount(2);
  expect(await read(page)).toEqual(original);
  await page.getByRole('dialog', { name: 'Workout preview', exact: true }).getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(gate(page)).toBeVisible();
  const start = gate(page).getByRole('button', { name: 'Start main workout', exact: true });
  await expect(start).toBeDisabled();
  expect((await read(page)).sessions).toEqual([]);
  await gate(page).getByRole('checkbox').first().check();
  await expect(gate(page).getByRole('status', { name: 'Warm-up progress', exact: true })).toContainText('1 of');
  await page.clock.fastForward(180_000);
  await page.reload();
  expect((await read(page)).sessions).toEqual([]);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(gate(page).getByRole('checkbox').first()).toBeChecked();
  await expect(start).toBeDisabled();
  await completePreparation(page);
  expect((await read(page)).sessions).toEqual([]);
  const startedAt = await page.evaluate(() => Date.now());
  await start.click();
  await expect(gate(page)).not.toBeVisible();
  const active = (await read(page)).sessions[0].session;
  expect(active.startedAt).toBeGreaterThanOrEqual(startedAt);
  expect(active.elapsedMs).toBe(0);
  expect(active.warmup.every((step: { done: boolean }) => step.done)).toBe(true);
  expect(active.warmupOverride).toBe(false);
  expect((await read(page)).profile.plan).toEqual(original.profile.plan);
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await current.getByRole('spinbutton', { name: /set 1 reps$/ }).fill('8');
  await current.getByRole('textbox', { name: /set 1 weight in kilograms$/ }).fill('12.5');
  await current.getByRole('button', { name: /^Complete .* set 1$/ }).click();
  await expect(page.getByRole('button', { name: 'Skip rest', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip rest', exact: true }).click();
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
});

test('recovery has gentle preparation and an explicit override never fabricates checked steps', async ({ page }) => {
  await seed(page, 'recovery');
  await page.getByRole('button', { name: 'Start recovery', exact: true }).click();
  await expect(gate(page)).toContainText('Easy Movement Preparation');
  await expect(gate(page)).not.toContainText('Low-Intensity Pogos');
  await expect(gate(page).getByRole('button', { name: 'Start main workout', exact: true })).toBeDisabled();
  await gate(page).getByRole('button', { name: 'Already warmed up', exact: true }).click();
  expect((await read(page)).sessions).toEqual([]);
  await gate(page).getByRole('button', { name: 'Start main workout', exact: true }).click();
  await expect(gate(page)).not.toBeVisible();
  const session = (await read(page)).sessions[0].session;
  expect(session.kind).toBe('recovery');
  expect(session.warmupOverride).toBe(true);
  expect(session.warmup.every((step: { done: boolean }) => !step.done)).toBe(true);
});

test('a safe warm-up substitution persists and closing preparation creates no session', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  const first = gate(page).getByRole('listitem').first();
  await first.locator('summary').click();
  const choice = first.locator('.warmup-flow__alternatives button').first();
  const name = await choice.locator('strong').innerText();
  await choice.click();
  await expect(first.getByRole('heading')).toHaveText(name);
  await gate(page).getByRole('checkbox').first().check();
  await gate(page).getByRole('button', { name: 'Close', exact: true }).click();
  expect((await read(page)).sessions).toEqual([]);
  await page.reload();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(gate(page).getByRole('listitem').first().getByRole('heading')).toHaveText(name);
  await expect(gate(page).getByRole('checkbox').first()).toBeChecked();
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
  await page.getByRole('button', { name: 'Edit today', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview).not.toContainText('Hurdle Hops');
  await expect(preview.getByRole('listitem').filter({ hasText: 'Approach Jump' })).toContainText('2 ×');
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await readiness.getByRole('button', { name: 'Red', exact: true }).click();
  await expect(page.locator('.session-card h2')).toHaveText('Recovery');
  expect((await read(page)).sessions).toEqual([]);
});

test('checked template steps cannot bypass preparation and a planned weight overrides the previous suggestion', async ({ page }) => {
  await seed(page);
  const state = await read(page);
  state.profile.plan[0].exercises[0].defaultKg = 12.5;
  state.profile.plan[0].warmup = [{ key: 'saved-preparation', name: 'Arm Circles', target: '6 each way', cue: 'Stay comfortable.', done: true }];
  const previous = createSession(state.profile.plan[0], 0, '2026-10-12', state.profile, []);
  previous.exercises[0].logs[0] = { ...previous.exercises[0].logs[0], kg: 30, reps: 8, done: true };
  state.sessions = [{ version: 1, session: stopSessionTimers(previous, 'completed') }];
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: KEY, state });
  await page.reload();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(gate(page).getByRole('button', { name: 'Start main workout', exact: true })).toBeDisabled();
  for (const check of await gate(page).getByRole('checkbox').all()) await expect(check).not.toBeChecked();
  await completePreparation(page);
  await gate(page).getByRole('button', { name: 'Start main workout', exact: true }).click();
  await expect(gate(page)).not.toBeVisible();
  const saved = await read(page);
  const active = saved.sessions.find((entry: { session: { status: string } }) => entry.session.status === 'active').session;
  expect(active.exercises[0].logs[0].kg).toBe(12.5);
  expect(saved.sessions.find((entry: { session: { status: string } }) => entry.session.status === 'completed')).toEqual(state.sessions[0]);
});
