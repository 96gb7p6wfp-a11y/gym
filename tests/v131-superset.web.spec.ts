import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, createSession } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';

const STORE = 'setline.gym.v1';
const current = (page: Page) => page.getByRole('region', { name: 'Current exercise', exact: true });
const completed = async (page: Page, name: string, set: number) => {
  const button = current(page).getByRole('button', { name: `Complete ${name} set ${set}`, exact: true });
  if (await button.isDisabled()) await current(page).getByRole('button', { name: `Ready for ${name} set ${set}`, exact: true }).click();
  await button.tap();
};

async function seed(page: Page, appearance: 'light' | 'dark') {
  await page.clock.install({ time: new Date('2026-11-05T12:00:00Z') });
  await page.goto('/');
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), appearance });
  const exercise = (name: string, key: string, sets: number, id: string, label: string, order: 1 | 2, rounds: number) => ({
    ...toPlanExercise(findLibraryExercise(name)!), name, key, sets, rest: 75,
    superset: { id, label, order, rounds, restAfterRound: 75 },
  });
  const plan = { name: 'Upper B — paired work', kind: 'strength', minutes: 30, note: '', exercises: [
    exercise('Reverse Pec Deck', 'rear', 3, 'shoulders', 'A', 2, 2),
    exercise('Cable Lateral Raise', 'lateral', 2, 'shoulders', 'A', 1, 2),
    exercise('Incline Dumbbell Curl', 'curl', 3, 'arms', 'B', 1, 3),
    exercise('Rope Triceps Extension', 'rope', 3, 'arms', 'B', 2, 3),
  ] };
  const session = createSession(plan, 3, '2026-11-05', profile, []);
  for (const movement of session.exercises) for (const log of movement.logs) Object.assign(log, { kg: 5, reps: 12 });
  await page.evaluate(({ profile, session, key }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session, version: 1 }], nutrition: [], activities: [],
  })), { profile, session, key: STORE });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
}

for (const appearance of ['light', 'dark'] as const) test(`V13.1 paired sets keep their complete doses and sensible rests in ${appearance}`, async ({ page }) => {
  if (appearance === 'dark') await page.setViewportSize({ width: 320, height: 568 });
  await seed(page, appearance);
  const pairA = page.getByRole('group', { name: 'Superset A', exact: true });
  await expect(pairA).toContainText('Round 1 of 2');
  await expect(current(page).getByRole('heading', { name: 'Cable Lateral Raise', exact: true })).toBeVisible();
  for (let round = 1; round <= 2; round++) {
    await completed(page, 'Cable Lateral Raise', round);
    await expect(current(page).getByRole('heading', { name: 'Reverse Pec Deck', exact: true })).toBeVisible();
    await expect(page.locator('.rest-floating')).toHaveCount(0);
    await completed(page, 'Reverse Pec Deck', round);
    await expect(page.locator('.rest-floating')).toContainText(/01:1[45]/);
  }
  await expect(current(page)).toContainText('Extra standalone set');
  await expect(current(page).getByRole('button', { name: 'Complete Reverse Pec Deck set 3', exact: true })).toBeVisible();
  await completed(page, 'Reverse Pec Deck', 3);
  const pairB = page.getByRole('group', { name: 'Superset B', exact: true });
  await expect(pairB).toContainText('Round 1 of 3');
  for (let round = 1; round <= 3; round++) {
    await completed(page, 'Incline Dumbbell Curl', round);
    await expect(current(page).getByRole('heading', { name: 'Rope Triceps Extension', exact: true })).toBeVisible();
    await expect(page.locator('.rest-floating')).toHaveCount(0);
    await completed(page, 'Rope Triceps Extension', round);
    await expect(page.locator('.rest-floating')).toContainText(/01:1[45]/);
  }
  await expect.poll(async () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions[0].session.exercises
    .map((movement: any) => movement.logs.filter((log: any) => log.done).length), STORE)).toEqual([3, 2, 3, 3]);
  await page.reload();
  const logs = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).sessions[0].session.exercises
    .map((movement: any) => movement.logs.map((log: any) => [log.kg, log.reps, log.done])), STORE);
  expect(logs).toEqual([Array(3).fill([5, 12, true]), Array(2).fill([5, 12, true]), Array(3).fill([5, 12, true]), Array(3).fill([5, 12, true])]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
