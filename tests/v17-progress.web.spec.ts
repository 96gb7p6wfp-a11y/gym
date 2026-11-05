import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { createNewProfile } from '../src/onboarding';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const read = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);

async function seed(page: Page, profile = ProfileSchema.parse(DEFAULT_PROFILE), sessions: { session: unknown; version: number }[] = []) {
  await page.goto('/');
  await page.evaluate(({ key, profile, sessions, reminders }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions, nutrition: [], activities: [], reminders,
  })), { key: STORE, profile, sessions, reminders: profile.onboarding?.installation === 'new' ? { items: [], entries: [] } : defaultReminderState() });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

async function progress(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  return page.getByRole('region', { name: 'Progress overview', exact: true });
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
});

test('Strength empty state starts the saved strength flow, never body-weight logging', async ({ page }) => {
  await seed(page);
  const before = await read(page);
  const overview = await progress(page);
  await overview.getByRole('button', { name: 'Strength', exact: true }).click();
  const strength = overview.getByRole('region', { name: 'Strength trend', exact: true });
  await expect(strength).toContainText('two different days');
  await expect(strength).toContainText('equipment and rep target');
  await expect(overview.getByRole('button', { name: 'Log body weight', exact: true })).toHaveCount(0);
  await expect(overview.getByRole('button', { name: 'Log jump', exact: true })).toHaveCount(0);
  await strength.getByRole('button', { name: 'Start a strength workout', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Train', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('heading', { name: 'Upper Power + Muscle', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Weight check-in', exact: true })).toHaveCount(0);
  expect(await read(page)).toBe(before);
  await page.getByRole('button', { name: 'Back to Progress', exact: true }).click();
  await expect(overview.getByRole('button', { name: 'Strength', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('body-weight action names the measurement and preserves Progress return context', async ({ page }) => {
  await seed(page);
  const before = await read(page);
  const overview = await progress(page);
  await overview.getByRole('button', { name: 'Body weight', exact: true }).click();
  await overview.getByRole('button', { name: 'Log body weight', exact: true }).click();
  const checkIn = page.getByRole('dialog', { name: 'Weight check-in', exact: true });
  await expect(checkIn).toBeVisible();
  await expect(checkIn.getByLabel('Body weight · kg', { exact: true })).toHaveValue('');
  await expect(checkIn.getByLabel('Body weight · kg', { exact: true })).toHaveAttribute('placeholder', '64');
  expect(await read(page)).toBe(before);
  await checkIn.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(overview.getByRole('button', { name: 'Body weight', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await read(page)).toBe(before);
});

test('a saved body-weight check-in returns to the selected chart without changing the plan', async ({ page }) => {
  await seed(page);
  const before = JSON.parse((await read(page))!);
  const overview = await progress(page);
  await overview.getByRole('button', { name: 'Body weight', exact: true }).click();
  await overview.getByRole('button', { name: 'Log body weight', exact: true }).click();
  const checkIn = page.getByRole('dialog', { name: 'Weight check-in', exact: true });
  await checkIn.getByLabel('Body weight · kg', { exact: true }).fill('64.2');
  await checkIn.getByRole('button', { name: 'Save weight', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(overview.getByRole('button', { name: 'Body weight', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const after = JSON.parse((await read(page))!);
  expect(after.profile).toEqual(before.profile);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.nutrition).toHaveLength(1);
  expect(after.nutrition[0].payload).toEqual({ kind: 'weight', kg: 64.2 });
});

test('strength action resumes the existing workout without changing its entered values or creating another session', async ({ page }) => {
  const profile = ProfileSchema.parse(DEFAULT_PROFILE);
  const active = SessionSchema.parse(createSession(profile.plan[0], 0, DATE, profile, []));
  active.runningSince = null;
  active.exercises[0].logs[0] = { ...active.exercises[0].logs[0], kg: 7.5, reps: 4, rir: 2 };
  await seed(page, profile, [{ session: active, version: 1 }]);
  const before = await read(page);
  const overview = await progress(page);
  await overview.getByRole('button', { name: 'Strength', exact: true }).click();
  await overview.locator('.progress-empty-action').click();
  await expect(page.getByRole('tab', { name: 'Train', exact: true })).toHaveAttribute('data-state', 'active');
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  await expect(current.getByRole('textbox', { name: `${active.exercises[0].name} set 1 weight in kilograms`, exact: true })).toHaveValue('7.5');
  await expect(current.getByRole('spinbutton', { name: `${active.exercises[0].name} set 1 reps`, exact: true })).toHaveValue('4');
  await expect(page.getByRole('dialog', { name: 'Warm-up', exact: true })).toHaveCount(0);
  expect(await read(page)).toBe(before);
});

for (const appearance of ['light', 'dark'] as const) {
  test(`neutral Simple progress stays honest and readable on a small phone in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const profile = ProfileSchema.parse({ ...createNewProfile(), appearance, onboarding: { version: 16, status: 'skipped', installation: 'new' } });
    await seed(page, profile);
    const before = await read(page);
    const overview = await progress(page);
    await expect(overview.getByRole('button', { name: 'Strength', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(overview.getByRole('button', { name: 'Start a strength workout', exact: true })).toBeVisible();
    await expect(overview.getByRole('img')).toHaveCount(0);
    await expect(overview.getByRole('button', { name: 'Log body weight', exact: true })).toHaveCount(0);
    await overview.getByRole('button', { name: 'Body weight', exact: true }).click();
    const action = overview.getByRole('button', { name: 'Log body weight', exact: true });
    await expect(action).toBeVisible();
    expect(await action.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(52);
    await expect(overview).not.toContainText(/64 kg|0 kg|Log jump/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await read(page)).toBe(before);
  });
}
