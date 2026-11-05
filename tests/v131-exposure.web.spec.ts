import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';
import { openDisclosure } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, active = false) {
  await page.clock.install({ time: new Date('2026-11-03T13:00:00Z') });
  await page.goto('/');
  const session = active ? SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[1], 1, '2026-11-03', DEFAULT_PROFILE, [])) : undefined;
  await page.evaluate(({ key, profile, session }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: session ? [{ session, version: 1 }] : [], activities: [], nutrition: [],
  })), { key: STORE, profile: DEFAULT_PROFILE, session });
  await page.reload();
}

test('volleyball observations remain optional, persist and do not complete a scheduled sport session', async ({ page }) => {
  await seed(page, true);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const fields = page.locator('.sport-reflection .training-exposure-fields');
  await expect(fields).not.toHaveAttribute('open');
  await fields.locator('summary').click();
  await fields.getByLabel('Hard jump contacts', { exact: true }).fill('24');
  await fields.getByLabel('Contact count', { exact: true }).selectOption('estimate');
  await fields.getByLabel('Session RPE · 0–10', { exact: true }).fill('7.5');
  await fields.getByLabel('Shoulder soreness', { exact: true }).selectOption('mild');
  await fields.getByLabel('Knee soreness', { exact: true }).selectOption('none');
  await fields.getByLabel('Achilles soreness', { exact: true }).selectOption('none');
  await expect.poll(async () => (await read(page)).sessions[0].session.trainingExposure).toEqual({
    sport: 'volleyball', hardJumpContacts: 24, contactSource: 'estimate', sessionRpe: 7.5,
    shoulderSoreness: 'mild', kneeSoreness: 'none', achillesSoreness: 'none',
  });
  expect((await read(page)).sessions[0].session.status).toBe('active');
  expect((await read(page)).sessions[0].session.exercises.every((exercise: any) => exercise.logs.every((log: any) => !log.done))).toBe(true);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await fields.locator('summary').click();
  await expect(fields.getByLabel('Hard jump contacts', { exact: true })).toHaveValue('24');
  await expect(fields.getByLabel('Contact count', { exact: true })).toHaveValue('estimate');
});

test('custom sports are not recorded as volleyball when entering jump load', async ({ page }) => {
  await seed(page, true);
  await page.evaluate(key => {
    const store = JSON.parse(localStorage.getItem(key)!);
    store.sessions[0].session.name = 'Basketball practice';
    localStorage.setItem(key, JSON.stringify(store));
  }, STORE);
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const fields = page.locator('.sport-reflection .training-exposure-fields');
  await fields.locator('summary').click();
  await expect(fields.getByLabel('Training type', { exact: true })).toHaveValue('other');
  await fields.getByLabel('Hard jump contacts', { exact: true }).fill('12');
  await expect.poll(async () => (await read(page)).sessions[0].session.trainingExposure).toEqual({
    sport: 'other', hardJumpContacts: 12,
  });
});

test('school PE can record counted contacts independently from gym and volleyball', async ({ page }) => {
  await seed(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await openDisclosure(page, 'Session tools');
  await openDisclosure(page, 'Activities');
  await page.getByRole('region', { name: 'Extra activities', exact: true }).getByRole('button', { name: 'Add activity', exact: true }).click();
  const entry = page.getByRole('dialog', { name: 'Add activity', exact: true });
  await entry.getByLabel('Activity', { exact: true }).selectOption('other');
  await entry.getByLabel('Activity name', { exact: true }).fill('School PE');
  await entry.getByLabel('Duration · minutes', { exact: true }).fill('110');
  await entry.locator('.training-exposure-fields > summary').click();
  await entry.getByLabel('Training type', { exact: true }).selectOption('pe');
  await entry.getByLabel('Hard jump contacts', { exact: true }).fill('9');
  await entry.getByLabel('Contact count', { exact: true }).selectOption('recorded');
  await entry.getByLabel('Session RPE · 0–10', { exact: true }).fill('6');
  await entry.getByRole('button', { name: 'Save activity', exact: true }).click();
  await expect(entry).not.toBeVisible();
  const saved = await read(page);
  expect(saved.activities[0].activity).toMatchObject({ name: 'School PE', durationMinutes: 110,
    trainingExposure: { sport: 'pe', hardJumpContacts: 9, contactSource: 'recorded', sessionRpe: 6 } });
  expect(saved.sessions).toEqual([]);
  await page.reload();
  expect((await read(page)).activities).toEqual(saved.activities);
});

test('jump test conditions are saved alongside reach and touch without adding workout history', async ({ page }) => {
  await seed(page);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('group', { name: 'Chart metric', exact: true }).getByRole('button', { name: 'Jump', exact: true }).click();
  await page.getByRole('button', { name: 'Log jump', exact: true }).click();
  const entry = page.getByRole('dialog', { name: 'Log jump', exact: true });
  await entry.getByLabel('Standing reach in centimetres', { exact: true }).fill('235');
  await entry.getByLabel('Approach-jump touch in centimetres', { exact: true }).fill('315');
  await entry.getByText('Add a note', { exact: true }).click();
  await entry.getByLabel('Jump test conditions', { exact: true }).fill('Same shoes, indoor court, after a short warm-up.');
  await entry.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(entry).not.toBeVisible();
  const saved = await read(page);
  expect(saved.performance.jumps[0]).toMatchObject({ type: 'approach', cm: 80, conditions: 'Same shoes, indoor court, after a short warm-up.' });
  expect(saved.sessions).toEqual([]);
});
