import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import type { ReportSession } from '../src/weekly-report';

const STORE = 'setline.gym.v1';
const DATE = '2026-10-15';
const MACHINE = 'Machine Chest Press';

function workout(date: string, options: { key: string; name?: string; canonical?: string; mode?: 'weight' | 'bodyweight'; measurement?: 'height' | 'touch'; kg?: number | null; reps?: number; cm?: number; active?: boolean }): ReportSession {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === MACHINE)!;
  const plan = { ...DEFAULT_PROFILE.plan[0], name: `Fixture ${date}`, warmup: [], cooldown: [], exercises: [{ ...movement, key: options.key, exerciseId: options.canonical ?? 'chest-press', name: options.name ?? MACHINE, mode: options.mode ?? 'weight', sets: 2, target: '8–12 reps', ...(options.measurement ? { measurement: options.measurement } : {}) }] };
  const started = SessionSchema.parse(createSession(plan, 3, date, DEFAULT_PROFILE, []));
  started.startedAt = new Date(`${date}T10:00:00Z`).getTime();
  started.elapsedMs = 30 * 60_000;
  started.runningSince = null;
  const finished = options.active ? started : SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + started.elapsedMs));
  finished.exercises[0].logs = finished.exercises[0].logs.map(log => ({ ...log, kg: options.kg === undefined ? 40 : options.kg, reps: options.reps ?? 12, rir: 2, done: !options.active, ...(options.cm === undefined ? {} : { measurementCm: options.cm }) }));
  return SessionSchema.parse(finished);
}

async function seed(page: Page, sessions: ReportSession[]) {
  await page.evaluate(({ key, records, profile }) => {
    const state = JSON.parse(localStorage.getItem(key) ?? 'null') ?? { schemaVersion: 1, profile, profileVersion: 0, sessions: [], nutrition: [], activities: [] };
    state.sessions = records.map(session => ({ session, version: 1 }));
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORE, records: sessions, profile: DEFAULT_PROFILE });
  await page.reload();
}

async function records(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions, STORE);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto(process.env.SETLINE_TEST_BASE_URL ?? '/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

test('progression waits for an explicit tap, updates only the current unfinished set and survives refresh', async ({ page }) => {
  const before = workout('2026-10-01', { key: 'chest-press' });
  const recent = workout('2026-10-08', { key: 'copied-chest-prior' });
  const active = workout(DATE, { key: 'unique-chest-today', active: true, reps: 10 });
  active.exercises[0].logs[0].done = true;
  active.exercises[0].logs.push({ ...active.exercises[0].logs[1], id: crypto.randomUUID(), kg: 42, reps: 8 });
  active.exercises[0].sets = 3;
  await seed(page, [active, recent, before]);
  const originalRecords = await records(page);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const focused = page.getByRole('region', { name: 'Current exercise', exact: true });
  const weight = focused.getByRole('textbox', { name: `${MACHINE} set 2 weight in kilograms`, exact: true });
  const reps = focused.getByRole('spinbutton', { name: `${MACHINE} set 2 reps`, exact: true });
  await expect(weight).toHaveValue('40');
  await expect(reps).toHaveValue('10');
  await expect(focused.locator('.progression-cue > summary')).toContainText('41 kg × 8');
  // Merely showing a recommendation cannot rewrite the workout or its history.
  expect(await records(page)).toEqual(originalRecords);
  await focused.locator('.progression-cue > summary').click();
  await expect(weight).toHaveValue('40');
  await focused.getByRole('button', { name: 'Use suggestion', exact: true }).click();
  await expect(weight).toHaveValue('41');
  await expect(reps).toHaveValue('8');
  await expect.poll(async () => (await records(page)).find((record: any) => record.session.id === active.id).session.exercises[0].logs[1].kg).toBe(41);
  let saved = await records(page);
  const changed = saved.find((record: any) => record.session.id === active.id).session.exercises[0].logs;
  expect(changed[0]).toEqual(active.exercises[0].logs[0]);
  expect(changed[2]).toEqual(active.exercises[0].logs[2]);
  expect(changed[1]).toMatchObject({ kg: 41, reps: 8, done: false });
  expect(saved.filter((record: any) => record.session.id !== active.id)).toEqual(originalRecords.filter((record: any) => record.session.id !== active.id));
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await expect(weight).toHaveValue('41');
  await expect(reps).toHaveValue('8');
  saved = await records(page);
  expect(saved.find((record: any) => record.session.id === active.id).session.exercises[0].logs[0]).toEqual(active.exercises[0].logs[0]);
});

test('strength history groups canonical copies and separates renamed, mode and jump-measurement variants', async ({ page }) => {
  const chestA = workout('2026-10-01', { key: 'chest-instance-a', kg: 40 });
  const chestB = workout('2026-10-08', { key: 'chest-instance-b', kg: 41 });
  const renamed = workout('2026-09-25', { key: 'renamed-copy', name: 'Custom Incline Press', kg: 65, reps: 8 });
  const bodyweight = workout('2026-09-20', { key: 'bodyweight-copy', mode: 'bodyweight', kg: null, reps: 15 });
  const jumpA = workout('2026-10-11', { key: 'jump-height-a', name: 'Approach Jump', canonical: 'approach-jump', mode: 'bodyweight', measurement: 'height', kg: null, reps: 3, cm: 54 });
  const jumpB = workout('2026-10-12', { key: 'jump-height-b', name: 'Approach Jump', canonical: 'approach-jump', mode: 'bodyweight', measurement: 'height', kg: null, reps: 3, cm: 56 });
  const touch = workout('2026-10-04', { key: 'jump-touch', name: 'Approach Jump', canonical: 'approach-jump', mode: 'bodyweight', measurement: 'touch', kg: null, reps: 3, cm: 305 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page, [chestA, chestB, renamed, bodyweight, jumpA, jumpB, touch]);
  const original = await records(page);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Strength history', exact: true }).click();
  const picker = page.getByRole('combobox', { name: 'Movement', exact: true });
  const history = page.locator('.movement-history');
  async function choose(prefix: RegExp, variant = 0) {
    await picker.click();
    await page.getByRole('option').filter({ hasText: prefix }).nth(variant).click();
  }
  await choose(/^Machine Chest Press/);
  await expect(history.locator('button')).toHaveCount(2);
  await expect(history).toContainText('40 kg × 12');
  await expect(history).toContainText('41 kg × 12');
  await expect(history).not.toContainText('65 kg');
  await choose(/^Custom Incline Press/);
  await expect(history.locator('button')).toHaveCount(1);
  await expect(history).toContainText('65 kg × 8');
  await choose(/^Machine Chest Press/, 1);
  await expect(page.locator('.progress-panel .panel-heading')).toContainText('Total reps');
  await expect(history.locator('button')).toHaveCount(1);
  await expect(history).toContainText('30 reps');
  await choose(/^Approach Jump/);
  await expect(page.locator('.progress-panel .panel-heading')).toContainText('Jump height');
  await expect(history.locator('button')).toHaveCount(2);
  await expect(history).toContainText('54 cm');
  await expect(history).toContainText('56 cm');
  await expect(history).not.toContainText('305 cm');
  await choose(/^Approach Jump/, 1);
  await expect(page.locator('.progress-panel .panel-heading')).toContainText('Highest touch');
  await expect(history.locator('button')).toHaveCount(1);
  await expect(history).toContainText('305 cm');
  expect(errors).toEqual([]);
  expect(await records(page)).toEqual(original);
});
