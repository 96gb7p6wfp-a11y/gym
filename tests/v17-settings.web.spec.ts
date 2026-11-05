import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';

async function openSettings(page: Page) {
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  return page.getByRole('dialog', { name: 'Your preferences', exact: true });
}

async function group(page: Page, name: 'Training' | 'Appearance & Sound' | 'Data & Backup') {
  const sheet = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  const choices = sheet.getByRole('navigation', { name: 'Settings groups', exact: true });
  if (!await choices.isVisible()) await sheet.getByRole('button', { name: 'All settings', exact: true }).click();
  await choices.getByRole('button', { name, exact: true }).click();
  return sheet.getByRole('region', { name, exact: true });
}

async function state(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T10:00:00Z') });
  await page.goto('/');
});

test('settings groups separate explicit training saves from automatic appearance changes without losing drafts', async ({ page }) => {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE),
    customWorkouts: [{ ...structuredClone(DEFAULT_PROFILE.plan[0]), id: crypto.randomUUID(), name: 'Existing custom session' }],
  });
  const historical = SessionSchema.parse(stopSessionTimers(createSession(profile.plan[0], 0, '2026-11-01', profile, []), 'completed'));
  historical.exercises[0].logs[0] = { ...historical.exercises[0].logs[0], kg: 6, reps: 4, rir: 2, done: true };
  historical.notes = 'Existing recorded session';
  const active = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-11-02', profile, []));
  active.runningSince = null;
  active.exercises[0].logs[0] = { ...active.exercises[0].logs[0], kg: 7.5, reps: 4, rir: 3 };
  await page.evaluate(({ key, profile, historical, active }) => {
    const saved = JSON.parse(localStorage.getItem(key)!);
    localStorage.setItem(key, JSON.stringify({ ...saved, profile, profileVersion: 4,
      sessions: [{ session: historical, version: 3 }, { session: active, version: 2 }],
      nutrition: [{ id: 'existing-weight', date: '2026-11-01', version: 1, payload: { kind: 'weight', kg: 64.2 } }],
    }));
  }, { key: STORE, profile, historical, active });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  const before = await state(page);
  const sheet = await openSettings(page);
  const choices = sheet.getByRole('navigation', { name: 'Settings groups', exact: true });
  for (const name of ['Training', 'Appearance & Sound', 'Data & Backup']) {
    await expect(choices.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(sheet.getByRole('button', { name: 'Save training defaults', exact: true })).toHaveCount(0);
  const training = await group(page, 'Training');
  await training.getByLabel('Body weight · kg', { exact: true }).fill('71.5');
  await training.getByLabel('Default rest · seconds', { exact: true }).fill('105');
  expect((await state(page)).profile.bodyWeight).toBe(before.profile.bodyWeight);
  const appearance = await group(page, 'Appearance & Sound');
  await expect(appearance).toContainText('Appearance and sound changes save automatically.');
  await appearance.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.appearance).toBe('dark');
  await expect(sheet.getByRole('button', { name: 'Save training defaults', exact: true })).toHaveCount(0);
  expect((await state(page)).profile.bodyWeight).toBe(before.profile.bodyWeight);
  expect((await state(page)).profile.restSeconds).toBe(before.profile.restSeconds);
  await group(page, 'Training');
  await expect(training.getByLabel('Body weight · kg', { exact: true })).toHaveValue('71.5');
  await expect(training.getByLabel('Default rest · seconds', { exact: true })).toHaveValue('105');
  await training.getByRole('button', { name: 'Save training defaults', exact: true }).click();
  await expect.poll(async () => (await state(page)).profile.bodyWeight).toBe(71.5);
  const saved = await state(page);
  expect(saved.profile.restSeconds).toBe(105);
  expect(saved.profile.appearance).toBe('dark');
  expect(saved.profile).toEqual({ ...before.profile, bodyWeight: 71.5, restSeconds: 105, appearance: 'dark' });
  expect(saved.sessions).toEqual(before.sessions);
  expect(saved.nutrition).toEqual(before.nutrition);
  expect(saved.reminders).toEqual(before.reminders);
  await expect(sheet).toBeVisible();
  await expect(training.getByRole('button', { name: 'Save training defaults', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Close', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const restored = await state(page);
  expect(restored.profile).toEqual(saved.profile);
  expect(restored.sessions).toEqual(before.sessions);
  expect(restored.nutrition).toEqual(before.nutrition);
  expect(restored.reminders).toEqual(before.reminders);
});

test('backup deep link and restore preview remain available across settings groups without replacing data', async ({ page }) => {
  const before = await state(page);
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: 'Backup & data', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  const data = sheet.getByRole('region', { name: 'Data & Backup', exact: true });
  await expect(data).toBeVisible();
  await expect(sheet.getByRole('navigation', { name: 'Settings groups', exact: true })).toBeHidden();
  const download = page.waitForEvent('download');
  await data.getByRole('button', { name: 'Export backup', exact: true }).click();
  const file = await download;
  const text = await readFile((await file.path())!, 'utf8');
  const backup = JSON.parse(text);
  expect(backup.data.profile).toEqual(before.profile);
  expect(backup.data.sessions).toEqual(before.sessions);
  await data.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({
    name: 'review-only.json', mimeType: 'application/json', buffer: Buffer.from(text),
  });
  const preview = data.getByRole('region', { name: 'Backup restore preview', exact: true });
  await expect(preview).toBeVisible();
  await group(page, 'Appearance & Sound');
  await group(page, 'Data & Backup');
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: 'Cancel restore', exact: true }).click();
  expect(await state(page)).toEqual(before);
});

for (const theme of ['light', 'dark'] as const) {
  test(`settings group navigation remains readable and reachable at 320px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const before = await page.evaluate(key => localStorage.getItem(key), STORE);
    const sheet = await openSettings(page);
    const choices = sheet.getByRole('navigation', { name: 'Settings groups', exact: true });
    for (const button of await choices.getByRole('button').all()) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await button.focus();
      await expect(button).toBeFocused();
    }
    await choices.getByRole('button', { name: 'Training', exact: true }).click();
    await expect(sheet.getByRole('heading', { name: 'Training', exact: true })).toBeFocused();
    const weight = sheet.getByLabel('Body weight · kg', { exact: true });
    expect(await weight.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await sheet.getByRole('button', { name: 'All settings', exact: true }).click();
    await expect(choices).toBeFocused();
    expect(await sheet.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
  });
}
