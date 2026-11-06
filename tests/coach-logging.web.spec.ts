import { expect, test } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
test('new history suggestions yield to this workout, manual edits survive both views, and compact steppers work at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.clock.install({ time: new Date('2026-11-06T10:00:00Z') });
  await page.goto('/');
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: createV9VolleyballMasterPlan(),
    appearance: 'dark', presentationMode: 'athlete', masterProgram: { version: 1, revision: '9', startDate: '2026-11-02',
      matchWeeks: [], dailyReadiness: [{ date: '2026-11-06', feeling: 'normal' }], clearance: { impact: 'cleared', heavyLifting: 'cleared' } },
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA profile, not real medical guidance.' } });
  const plan = { ...profile.plan[2], warmup: [], exercises: [{ ...profile.plan[2].exercises.find(exercise => exercise.name === 'Hack Squat')!,
    key: 'coach-hack', group: 'Strength', sets: 3, equipmentLabel: 'QA Machine A', target: '4–6 reps', defaultKg: 40 }] };
  const prior = SessionSchema.parse(stopSessionTimers(createSession(plan, 2, '2026-11-04', profile, []), 'completed'));
  prior.exercises[0].logs = prior.exercises[0].logs.map(log => ({ ...log, kg: 70, reps: 6, rir: 2, done: true }));
  const active = SessionSchema.parse(createSession(plan, 2, '2026-11-06', profile, [prior]));
  active.exercises[0].logs[2] = { ...active.exercises[0].logs[2], kg: 75, reps: 5, inputSources: { kg: 'manual', reps: 'manual' } };
  await page.evaluate(({ profile, prior, active, reminders }) => localStorage.setItem('setline.gym.v1', JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: prior, version: 1 }, { session: active, version: 1 }],
    activities: [], nutrition: [], reminders, performance: { jumps: [], readiness: [] }, performanceVersion: 1,
  })), { profile, prior, active, reminders: defaultReminderState() });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const focused = page.getByRole('region', { name: 'Current exercise', exact: true });
  const weight = focused.getByRole('textbox', { name: 'Hack Squat set 1 weight in kilograms', exact: true });
  await expect(weight).toHaveValue('70');
  await weight.fill('60');
  await focused.getByRole('spinbutton', { name: 'Hack Squat set 1 reps', exact: true }).fill('8');
  await focused.getByRole('button', { name: 'Complete Hack Squat set 1', exact: true }).evaluate(button => {
    for (let index = 0; index < 10; index++) (button as HTMLButtonElement).click();
  });
  const saved = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).sessions.find((row: {session:{id:string}}) => row.session.id === id).session,
    { key: STORE, id: active.id });
  await expect.poll(async () => (await saved()).exercises[0].logs.map((log: {done:boolean}) => log.done)).toEqual([true, false, false]);
  await expect.poll(async () => (await saved()).exercises[0].logs[1].kg).toBe(60);
  expect((await saved()).exercises[0].logs[1].reps).toBe(8);
  expect((await saved()).exercises[0].logs[2]).toMatchObject({ kg: 75, reps: 5, done: false });
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const row = page.getByRole('group', { name: 'Quick log Hack Squat set 2', exact: true });
  await row.getByRole('button', { name: 'Previous Hack Squat set 2', exact: true }).click();
  const increase = row.getByRole('button', { name: 'Increase Hack Squat set 2 weight by 2.5 kg', exact: true });
  await increase.scrollIntoViewIfNeeded();
  expect((await increase.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await increase.click();
  await row.getByRole('button', { name: 'Increase Hack Squat set 2 reps', exact: true }).click();
  await expect.poll(async () => (await saved()).exercises[0].logs[1].kg).toBe(62.5);
  expect((await saved()).exercises[0].logs[1].reps).toBe(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await expect(focused.getByRole('textbox', { name: 'Hack Squat set 2 weight in kilograms', exact: true })).toHaveValue('62.5');
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Current exercise', exact: true }).getByRole('textbox', { name: 'Hack Squat set 2 weight in kilograms', exact: true })).toHaveValue('62.5');
  const snapshot = await saved();
  expect(snapshot.exercises[0].logs.map((log: {done:boolean}) => log.done)).toEqual([true, false, false]);
  const history = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).sessions.find((row: {session:{id:string}}) => row.session.id === id).session,
    { key: STORE, id: prior.id });
  expect(history).toEqual(prior);
});
