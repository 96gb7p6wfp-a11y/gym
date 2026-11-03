import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createReachJumpEntries } from '../src/performance-data.ts';

const STORE = 'setline.gym.v1';
const today = '2026-11-03';
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, records: Record<string, unknown> = {}) {
  await page.clock.install({ time: new Date(`${today}T13:00:00Z`) });
  await page.goto('/');
  await page.evaluate(({ key, profile, records }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [], activities: [], nutrition: [], ...records,
  })), { key: STORE, profile: DEFAULT_PROFILE, records });
  await page.reload();
}
async function details(page: Page) {
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Performance details', exact: true }).click();
  return page.getByRole('region', { name: 'Performance details', exact: true });
}

test('Approach Advantage uses the latest paired test instead of unrelated best measurements', async ({ page }) => {
  const first = createReachJumpEntries({ date: '2026-10-20', standingReachCm: 235, standingTouchCm: 300, approachTouchCm: 310 });
  const latest = createReachJumpEntries({ date: '2026-11-02', standingReachCm: 235, standingTouchCm: 305, approachTouchCm: 313 });
  const unrelated = { id: crypto.randomUUID(), date: today, type: 'approach', measurement: 'height', cm: 100, notes: '' };
  await seed(page, { performance: { jumps: [...first, ...latest, unrelated], readiness: [] }, performanceVersion: 1 });
  const before = await read(page);
  await page.setViewportSize({ width: 320, height: 568 });
  const view = await details(page);
  const advantage = view.getByRole('region', { name: 'Approach Advantage', exact: true });
  await expect(advantage).toContainText('+8');
  await expect(advantage).toContainText('+11.4');
  await expect(advantage).toContainText('-2');
  await expect(advantage).toContainText('2026-11-02 · 78 cm approach − 70 cm standing');
  await expect(advantage).toContainText('does not diagnose technique');
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 320);
  expect((await read(page)).performance).toEqual(before.performance);
  expect((await read(page)).sessions).toEqual([]);
  await page.reload();
  await details(page);
  await expect(page.getByRole('region', { name: 'Approach Advantage', exact: true })).toContainText('78 cm approach − 70 cm standing');
});

test('volleyball context separates counted, estimated, unspecified and missing contacts without changing history', async ({ page }) => {
  const completed = SessionSchema.parse(stopSessionTimers(createSession(DEFAULT_PROFILE.plan[1], 1, today, DEFAULT_PROFILE, []), 'completed'));
  const sessions = [
    { session: { ...completed, id: crypto.randomUUID(), trainingExposure: { hardJumpContacts: 12, contactSource: 'recorded' } }, version: 1 },
    { session: { ...completed, id: crypto.randomUUID(), trainingExposure: { hardJumpContacts: 20, contactSource: 'estimate' } }, version: 1 },
    { session: { ...completed, id: crypto.randomUUID(), trainingExposure: { hardJumpContacts: 15 } }, version: 1 },
    { session: { ...completed, id: crypto.randomUUID() }, version: 1 },
  ];
  await seed(page, { sessions });
  const before = await read(page);
  const view = await details(page);
  const context = view.locator('.performance-volleyball-context');
  await context.locator('summary').click();
  await expect(context).toContainText('Counted · volleyball / PE / other12 / 0 / 0');
  await expect(context).toContainText('Estimated sport contacts20');
  await expect(context).toContainText('Source unspecified15');
  await expect(context).toContainText('1 sport session has no contact count');
  expect((await read(page)).sessions).toEqual(before.sessions);
});

test('entering contacts leaves source unspecified until chosen and clearing removes the source', async ({ page }) => {
  const active = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[1], 1, today, DEFAULT_PROFILE, []));
  await seed(page, { sessions: [{ session: active, version: 1 }] });
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  const fields = page.locator('.sport-reflection .training-exposure-fields');
  await fields.locator('summary').click();
  await fields.getByLabel('Hard jump contacts', { exact: true }).fill('0');
  await expect(fields.getByLabel('Contact count', { exact: true })).toHaveValue('');
  await expect.poll(async () => (await read(page)).sessions[0].session.trainingExposure).toEqual({ sport: 'volleyball', hardJumpContacts: 0 });
  await fields.getByLabel('Contact count', { exact: true }).selectOption('recorded');
  await expect.poll(async () => (await read(page)).sessions[0].session.trainingExposure.contactSource).toBe('recorded');
  await fields.getByLabel('Hard jump contacts', { exact: true }).fill('');
  await expect.poll(async () => (await read(page)).sessions[0].session.trainingExposure).toEqual({ sport: 'volleyball' });
  expect((await read(page)).sessions[0].session.status).toBe('active');
});
