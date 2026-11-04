import { expect, test } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';

test('chart engine loads on demand and first-use detail screens work offline without changing records', async ({ page, context }) => {
  const sessions = ['2026-10-12', '2026-10-19'].map((date, index) => {
    const session = SessionSchema.parse(stopSessionTimers(createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []), 'completed'));
    session.exercises.forEach(exercise => {
      exercise.logs[0] = { ...exercise.logs[0], done: true, kg: 20 + index * 5, reps: 8 };
    });
    return { session: SessionSchema.parse(session), version: 1 };
  });
  await page.addInitScript(({ key, profile, sessions }) => {
    if (!localStorage.getItem(key) || JSON.parse(localStorage.getItem(key)!).profileVersion === 0) localStorage.setItem(key, JSON.stringify({
      schemaVersion: 1, profile, profileVersion: 1, sessions, nutrition: [], activities: [],
    }));
  }, { key: STORE, profile: DEFAULT_PROFILE, sessions });
  const loadedCharts: string[] = [];
  page.on('request', request => { if (/StrengthChart-.*\.js/.test(request.url())) loadedCharts.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  // Precache fetches run in the worker. They do not load the chart engine into the page.
  expect(await page.evaluate(() => performance.getEntriesByType('resource').some(entry => /StrengthChart-.*\.js/.test(entry.name)))).toBe(false);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15000 }).toBe('activated');
  const before = await page.evaluate(key => localStorage.getItem(key), STORE);
  await context.setOffline(true);
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Strength history', exact: true }).click();
  await expect(page.locator('.chart-wrap .recharts-surface')).toBeVisible();
  expect(loadedCharts.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await page.getByRole('button', { name: 'Performance details', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Performance details', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'You', exact: true }).click();
  await page.getByRole('button', { name: /Nutrition/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Nutrition', exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
});
