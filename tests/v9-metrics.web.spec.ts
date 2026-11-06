import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { type PerformanceData, type SprintEntry } from '../src/performance-data';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-06';
const PROTOCOL = 'Standing start to torso finish';
const CONDITIONS = 'Indoor court; same shoes';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

function sprint(date: string, seconds: number, timingMethod: SprintEntry['timingMethod'] = 'manual', distanceM: 5 | 10 = 5): SprintEntry {
  return { id: crypto.randomUUID(), date, distanceM, seconds, timingMethod, protocol: PROTOCOL, conditions: CONDITIONS };
}

async function seed(page: Page, options: { sprints?: SprintEntry[]; active?: boolean } = {}) {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete', appearance: 'light',
    trainingGuidance: { impact: 'restricted', heavyLifting: 'unknown' } });
  const historical = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed'));
  Object.assign(historical.exercises[0].logs[0], { kg: 6, reps: 3, done: true });
  const sessions = [{ session: historical, version: 3 }];
  if (options.active) {
    const active = SessionSchema.parse(createSession(profile.plan[0], 0, DATE, profile, []));
    active.runningSince = null;
    sessions.unshift({ session: active, version: 2 });
  }
  const performance: PerformanceData = {
    jumps: [{ id: crypto.randomUUID(), date: '2026-11-02', type: 'approach', measurement: 'height', cm: 68, notes: 'Preserved isolated measured result' }],
    readiness: [{ id: crypto.randomUUID(), date: DATE, energy: 'normal', soreness: 'low', joints: { knee: 'comfortable', achilles: 'sore' } }],
    ...(options.sprints ? { sprints: options.sprints } : {}),
  };
  const state = { schemaVersion: 1, profile, profileVersion: 3, sessions,
    nutrition: [{ id: 'retained-check-in', date: DATE, version: 1, payload: { kind: 'weight', kg: 70 } }],
    activities: [], reminders: { items: [], entries: [] }, performance, performanceVersion: 2 };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state });
  await page.reload();
  return state;
}

async function openMetrics(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  const metrics = page.getByRole('region', { name: 'Speed and joint readiness', exact: true });
  if (!await metrics.isVisible()) await page.getByRole('button', { name: 'Performance details', exact: true }).click();
  await expect(metrics).toBeVisible();
  await expect(metrics.getByRole('button', { name: 'Log sprint', exact: true })).toBeEnabled();
  return metrics;
}

function expectOtherRecords(saved: Awaited<ReturnType<typeof read>>, before: Awaited<ReturnType<typeof seed>>) {
  for (const field of ['profile', 'profileVersion', 'sessions', 'nutrition', 'activities', 'reminders'] as const) expect(saved[field]).toEqual(before[field]);
  expect(saved.performance.jumps).toEqual(before.performance.jumps);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

test('a measured sprint requires real timing details, supports decimal commas and never completes a workout', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const before = await seed(page);
  const metrics = await openMetrics(page);
  await expect(metrics).toContainText('No measured sprint times yet');
  expect((await read(page)).performance.sprints).toBeUndefined();
  await metrics.getByRole('button', { name: 'Log sprint', exact: true }).click();
  const form = metrics.getByRole('form', { name: 'Log measured sprint', exact: true });
  await form.getByRole('textbox', { name: 'Measured time · seconds', exact: true }).fill('1,85');
  await form.getByRole('button', { name: 'Save measured sprint', exact: true }).click();
  await expect(form).toBeVisible();
  await expect(metrics.getByRole('alert')).toBeVisible();
  expect(await read(page)).toEqual(before);
  await form.getByRole('combobox', { name: 'Timing method', exact: true }).selectOption('video');
  await form.getByRole('textbox', { name: 'Start & timing protocol', exact: true }).fill(PROTOCOL);
  await form.getByRole('button', { name: 'Save measured sprint', exact: true }).click();
  await expect(form).not.toBeVisible();
  const saved = await read(page);
  expect(saved.performance.sprints).toHaveLength(1);
  expect(saved.performance.sprints[0]).toMatchObject({ date: DATE, distanceM: 5, seconds: 1.85, timingMethod: 'video', protocol: PROTOCOL });
  expect(saved.performance.sprints[0].conditions).toBeUndefined();
  expectOtherRecords(saved, before);
  expect(saved.performance.readiness).toEqual(before.performance.readiness);
  await expect(metrics).toContainText('A second test date');
  await expect(metrics).toContainText('Surface, shoes and conditions were not recorded');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('sprint comparisons keep incompatible methods and distances separate while corrections and selective deletion persist', async ({ page }) => {
  const early = sprint('2026-10-09', 1.8), current = sprint(DATE, 1.7), electronic = sprint(DATE, 1.05, 'electronic'), longer = sprint(DATE, 3.05, 'manual', 10);
  const before = await seed(page, { sprints: [early, current, electronic, longer] });
  const metrics = await openMetrics(page);
  await metrics.getByRole('combobox', { name: 'Comparable sprint series', exact: true }).selectOption({ label: `5 m · Manual stopwatch · ${PROTOCOL} · ${CONDITIONS}` });
  await expect(metrics.locator('.sprint-performance__result dd').first()).toHaveText('1.7s');
  await expect(metrics).toContainText('2 recorded test days · 2 timed attempts');
  await expect(metrics).toContainText('0.1 seconds faster');
  await expect(metrics.getByRole('img', { name: /^5 metre measured sprint trend/ })).toHaveCount(1);
  await metrics.locator('.sprint-performance__records > summary').click();
  let record = metrics.locator('article').filter({ hasText: '5 m · 1.7 seconds' });
  await record.getByRole('button', { name: `Edit 5 metre sprint on ${DATE}`, exact: true }).click();
  const form = metrics.getByRole('form', { name: 'Edit measured sprint', exact: true });
  await form.getByRole('textbox', { name: 'Measured time · seconds', exact: true }).fill('1.65');
  await form.getByRole('button', { name: 'Save sprint correction', exact: true }).click();
  await expect(form).not.toBeVisible();
  const edited = await read(page);
  expect(edited.performance.sprints).toHaveLength(4);
  expect(edited.performance.sprints.find((entry: SprintEntry) => entry.id === current.id)).toEqual({ ...current, seconds: 1.65 });
  expect(edited.performance.sprints.find((entry: SprintEntry) => entry.id === electronic.id)).toEqual(electronic);
  record = metrics.locator('article').filter({ hasText: '5 m · 1.05 seconds' });
  await record.getByRole('button', { name: `Delete 5 metre sprint on ${DATE}`, exact: true }).click();
  await record.getByRole('button', { name: 'Keep sprint result', exact: true }).click();
  expect(await read(page)).toEqual(edited);
  await record.getByRole('button', { name: `Delete 5 metre sprint on ${DATE}`, exact: true }).click();
  await record.getByRole('button', { name: 'Confirm delete sprint result', exact: true }).click();
  await expect.poll(async () => (await read(page)).performance.sprints.length).toBe(3);
  const saved = await read(page);
  expect(saved.performance.sprints.some((entry: SprintEntry) => entry.id === electronic.id)).toBe(false);
  expect(saved.performance.sprints.find((entry: SprintEntry) => entry.id === longer.id)).toEqual(longer);
  expectOtherRecords(saved, before);
  await page.reload(); await openMetrics(page);
  expect((await read(page)).performance).toEqual(saved.performance);
});

test('joint observations survive the older workout check-in and offline refresh without changing guidance or training', async ({ page, context }) => {
  const timed = sprint(DATE, 1.7);
  const before = await seed(page, { sprints: [timed], active: true });
  const metrics = await openMetrics(page);
  const checkIn = metrics.locator('.sprint-readiness');
  await checkIn.locator(':scope > summary').click();
  await checkIn.getByRole('combobox', { name: 'Knee', exact: true }).selectOption('pain');
  await checkIn.getByRole('combobox', { name: 'Shoulder', exact: true }).selectOption('comfortable');
  await checkIn.getByRole('button', { name: 'Save joint check-in', exact: true }).click();
  await expect(checkIn.getByRole('status')).toContainText('No workout or medical guidance was changed');
  let saved = await read(page);
  expect(saved.performance.readiness[0].joints).toEqual({ knee: 'pain', achilles: 'sore', shoulder: 'comfortable' });
  expectOtherRecords(saved, before);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  const options = page.getByRole('dialog', { name: 'Your session', exact: true });
  await options.getByRole('button', { name: 'Low energy', exact: true }).click();
  await options.getByRole('button', { name: 'high leg soreness', exact: true }).click();
  await options.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(options).not.toBeVisible();
  saved = await read(page);
  expect(saved.performance.readiness[0]).toMatchObject({ energy: 'low', soreness: 'high', joints: { knee: 'pain', achilles: 'sore', shoulder: 'comfortable' } });
  expect(saved.performance.sprints).toEqual([timed]);
  expectOtherRecords(saved, before);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await context.setOffline(true); await page.reload(); await openMetrics(page);
  expect((await read(page)).performance).toEqual(saved.performance);
});
