import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { defaultReminderState } from '../src/reminders';
import { openQuickWarmup } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const preparation = (page: Page) => page.getByRole('dialog', { name: 'Warm-up', exact: true });
const rows = (page: Page) => preparation(page).getByRole('list', { name: 'Quick warm-up exercises', exact: true }).locator(':scope > li');
async function state(page: Page) { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE); }

async function seed(page: Page, appearance: 'light' | 'dark' = 'light') {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance,
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0
      ? { ...day, name: 'Upper strength', goal: 'strength', exercises: day.exercises.slice(1, 3) } : day) });
  const history = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-10-26', profile, []), 'completed'));
  Object.assign(history.exercises[0].logs[0], { kg: 12.5, reps: 8, rir: 2, done: true });
  const saved = { schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: history, version: 1 }],
    nutrition: [{ id: 'preserved-body-weight', date: '2026-10-26', version: 1, payload: { kind: 'weight', kg: 64.5 } }],
    activities: [], reminders: defaultReminderState() };
  await page.goto('/');
  await page.evaluate(({ key, saved }) => localStorage.setItem(key, JSON.stringify(saved)), { key: STORE, saved });
  await page.reload();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await openQuickWarmup(page);
  await expect(preparation(page)).toBeVisible();
  return saved;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
});

test('warm-up has two clear start actions and skipping preserves real partial preparation without inventing completion', async ({ page }) => {
  const original = await seed(page);
  const warmup = preparation(page);
  await expect(warmup.locator('.warmup-flow__actions').getByRole('button')).toHaveText(['Start workout', 'Skip warm-up']);
  await expect(warmup.getByRole('button', { name: 'Mark warm-up complete', exact: true })).toHaveCount(0);
  await expect(warmup.getByRole('button', { name: 'Already warmed up', exact: true })).toHaveCount(0);
  await expect(warmup.getByRole('button', { name: 'I warmed up elsewhere', exact: true })).not.toBeVisible();
  const first = rows(page).first();
  // The title is part of the same native checkbox label, not a second action.
  await first.getByRole('heading').click();
  await expect(first.getByRole('checkbox')).toBeChecked();
  await expect(first.locator('.warmup-flow__done')).toHaveText('Done');
  await expect(warmup.getByRole('status', { name: 'Warm-up progress', exact: true })).toHaveText(`1 of ${await rows(page).count()} completed`);
  const draft = (await state(page)).profile.sessionDrafts[0].plan.warmup;
  await warmup.getByRole('button', { name: 'Skip warm-up', exact: true }).click();
  await expect(warmup).not.toBeVisible();
  const saved = await state(page);
  const active = saved.sessions.find((record: { session: { status: string } }) => record.session.status === 'active').session;
  expect(active.warmup).toEqual(draft);
  expect(active.warmupStatus).toBe('not-recorded');
  expect(active.warmupOverride).toBe(false);
  expect(active.warmupCompletedAt).toBeUndefined();
  expect(active.warmup.filter((step: { done: boolean }) => step.done)).toHaveLength(1);
  expect(active.exercises.every((exercise: { logs: { done: boolean }[] }) => exercise.logs.every(log => !log.done))).toBe(true);
  expect(saved.profile.plan).toEqual(original.profile.plan);
  expect(saved.sessions.find((record: { session: { id: string } }) => record.session.id === original.sessions[0].session.id)).toEqual(original.sessions[0]);
  expect(saved.nutrition).toEqual(original.nutrition);
  expect(saved.reminders).toEqual(original.reminders);
  await page.reload();
  const resumed = (await state(page)).sessions.find((record: { session: { status: string } }) => record.session.status === 'active').session;
  expect(resumed.id).toBe(active.id);
  expect(resumed.warmup).toEqual(active.warmup);
  expect(resumed.exercises.map((exercise: { logs: unknown[] }) => exercise.logs)).toEqual(active.exercises.map((exercise: { logs: unknown[] }) => exercise.logs));
});

test('checking performed drills records preparation and keeps every saved additional instruction available', async ({ page }) => {
  const original = await seed(page);
  const warmup = preparation(page);
  const drafted = (await state(page)).profile.sessionDrafts[0].plan.warmup;
  await warmup.locator('.warmup-flow__full > summary').click();
  const allNames = [...await rows(page).getByRole('heading').allTextContents(), ...await warmup.getByRole('list', { name: 'Additional preparation exercises', exact: true }).getByRole('heading').allTextContents()];
  expect(allNames).toHaveLength(drafted.length);
  expect(allNames).toEqual(expect.arrayContaining(drafted.map((step: { name: string }) => step.name)));
  const first = rows(page).first();
  const name = await first.getByRole('heading').innerText();
  await first.locator('summary').click();
  await expect(first.getByText(drafted.find((step: { name: string }) => step.name === name).cue, { exact: true })).toBeVisible();
  for (const check of await rows(page).getByRole('checkbox').all()) await check.check();
  await expect(warmup.getByRole('status', { name: 'Warm-up progress', exact: true })).toHaveText('Quick prep complete');
  await expect(warmup.getByRole('button', { name: 'Skip warm-up', exact: true })).toHaveCount(0);
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(warmup).not.toBeVisible();
  const saved = await state(page);
  const active = saved.sessions.find((record: { session: { status: string } }) => record.session.status === 'active').session;
  expect(active.warmupStatus).toBe('prepared');
  expect(active.warmupOverride).toBe(false);
  expect(active.warmupCompletedAt).toBeGreaterThanOrEqual(active.startedAt);
  expect(active.warmup.map(({ done, ...step }: { done: boolean }) => step)).toEqual(drafted.map(({ done, ...step }: { done: boolean }) => step));
  expect(saved.profile.plan).toEqual(original.profile.plan);
});

test('preparation elsewhere is an explicit optional statement and never checks drills automatically', async ({ page }) => {
  await seed(page);
  const warmup = preparation(page);
  await warmup.locator('.warmup-flow__full > summary').click();
  await warmup.getByRole('button', { name: 'I warmed up elsewhere', exact: true }).click();
  for (const check of await rows(page).getByRole('checkbox').all()) await expect(check).not.toBeChecked();
  await expect(warmup.getByRole('status', { name: 'Warm-up progress', exact: true })).toHaveText('Warmed up elsewhere');
  await warmup.getByRole('button', { name: 'Start workout', exact: true }).click();
  const active = (await state(page)).sessions.find((record: { session: { status: string } }) => record.session.status === 'active').session;
  expect(active.warmupOverride).toBe(true);
  expect(active.warmupStatus).toBe('elsewhere');
  expect(active.warmup.every((step: { done: boolean }) => !step.done)).toBe(true);
});

for (const appearance of ['light', 'dark'] as const) test(`warm-up checks have comfortable targets and readable type at 375px in ${appearance}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, appearance);
  const warmup = preparation(page);
  for (const row of await rows(page).all()) {
    const check = row.getByRole('checkbox');
    const box = (await check.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await check.focus();
    await page.keyboard.press('Space');
    await expect(check).toBeChecked();
    await page.keyboard.press('Space');
    await expect(check).not.toBeChecked();
  }
  for (const selector of ['.warmup-flow__target', '.warmup-flow__technique', '.warmup-flow__progress', '.warmup-flow__skip']) {
    for (const element of await warmup.locator(selector).all()) expect(await element.evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(12);
  }
  await expect(warmup.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
  expect(await warmup.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`warmup-v17-375-${appearance}.png`), fullPage: true });
});
