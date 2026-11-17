import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders.ts';
import { startAlreadyWarmed } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-16';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

test('a real bodyweight workout starts with comparable prior reps, retaining zero added load in both log modes', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-16T10:00:00Z') });
  await page.goto('/');
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared' } });
  const exercise = { key: 'qa-pushup', exerciseId: 'push-up-plus', name: 'Push-Up Plus', group: 'Shoulder control',
    sets: 2, target: '10–12 reps', mode: 'bodyweight' as const, defaultKg: 0, rest: 60, perSide: false };
  profile.plan[0] = { ...profile.plan[0], name: 'QA bodyweight session', exercises: [exercise] };
  const prior = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-11-12', profile, []), 'completed'));
  prior.exercises[0].logs.forEach((log, index) => Object.assign(log, { kg: index ? 0 : null, reps: index ? 11 : 12, done: true }));
  await page.evaluate(({ profile, prior, reminders }) => localStorage.setItem('setline.gym.v1', JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: prior, version: 1 }],
    nutrition: [], activities: [], reminders,
  })), { profile, prior, reminders: defaultReminderState() });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await startAlreadyWarmed(page);
  const focus = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(focus.getByRole('spinbutton', { name: 'Push-Up Plus set 1 reps', exact: true })).toHaveValue('12');
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const second = page.getByRole('group', { name: 'Quick log Push-Up Plus set 2', exact: true });
  await expect(second.getByRole('spinbutton', { name: 'Push-Up Plus set 2 reps', exact: true })).toHaveValue('11');
  const snapshot = await read(page);
  const current = snapshot.sessions.find((row: { session: { status: string } }) => row.session.status === 'active').session;
  expect(current.date).toBe(DATE);
  expect(current.exercises[0].logs.map((log: { kg: number; reps: number; done: boolean }) => [log.kg, log.reps, log.done])).toEqual([[0, 12, false], [0, 11, false]]);
  expect(snapshot.profile.plan).toEqual(profile.plan);
  expect(snapshot.sessions.find((row: { session: { id: string } }) => row.session.id === prior.id).session).toEqual(prior);
});

test('Add one set keeps the completed load and reps, saves immediately, and survives Focus/Quick Log plus refresh', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.clock.install({ time: new Date('2026-11-16T10:00:00Z') });
  await page.goto('/');
  const profile = ProfileSchema.parse(structuredClone(DEFAULT_PROFILE));
  const plan = { ...profile.plan[0], name: 'QA strength', exercises: [{ key: 'qa-press', exerciseId: 'chest-press',
    name: 'Machine Chest Press', group: 'Chest', sets: 2, target: '6–8 reps', mode: 'weight' as const,
    rest: 120, perSide: false, defaultKg: 12.5 }] };
  const active = SessionSchema.parse(createSession(plan, 0, DATE, profile, []));
  Object.assign(active.exercises[0].logs[0], { kg: 60, reps: 8, rir: 2, done: true });
  Object.assign(active.exercises[0].logs[1], { kg: 62.5, reps: 7, inputSources: { kg: 'manual', reps: 'manual' } });
  await page.evaluate(({ profile, active, reminders }) => localStorage.setItem('setline.gym.v1', JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: active, version: 1 }],
    nutrition: [], activities: [], reminders,
  })), { profile, active, reminders: defaultReminderState() });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Options for Machine Chest Press', exact: true }).click();
  const options = page.getByRole('dialog', { name: 'Machine Chest Press', exact: true });
  await options.getByRole('button', { name: 'Adjust effort', exact: true }).click();
  const effort = page.getByRole('dialog', { name: 'Adjust effort', exact: true });
  await expect(effort).toBeVisible();
  await effort.getByRole('button', { name: 'Add one set', exact: true }).click();
  await expect(effort).not.toBeVisible();
  const saved = async () => (await read(page)).sessions.find((row: { session: { id: string } }) => row.session.id === active.id).session;
  await expect.poll(async () => (await saved()).exercises[0].logs.length).toBe(3);
  const snapshot = await saved();
  expect(snapshot.exercises[0].logs.slice(0, 2)).toEqual(active.exercises[0].logs);
  expect(snapshot.exercises[0].logs[2]).toMatchObject({ kg: 60, reps: 8, rir: null, done: false, inputSources: { kg: 'last-set', reps: 'last-set' } });
  await page.getByRole('button', { name: 'Quick Log', exact: true }).click();
  const third = page.getByRole('group', { name: 'Quick log Machine Chest Press set 3', exact: true });
  await expect(third.getByRole('textbox', { name: 'Machine Chest Press set 3 weight in kilograms', exact: true })).toHaveValue('60');
  await expect(third.getByRole('spinbutton', { name: 'Machine Chest Press set 3 reps', exact: true })).toHaveValue('8');
  await page.getByRole('button', { name: 'Focus', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  expect((await saved()).exercises[0].logs).toEqual(snapshot.exercises[0].logs);
  expect((await read(page)).profile).toEqual(profile);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
