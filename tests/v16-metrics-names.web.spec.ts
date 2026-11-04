import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { finishWarmup, openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-10-19';
const TITLE = 'Upper B — Athletic Physique + Spike Power';

const readStore = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page) {
  const exercise = (key: string, name: string, extra = {}) => ExerciseSchema.parse({
    key, name, group: 'Training', sets: 2, target: '8 reps', mode: 'weight', rest: 60, perSide: false, ...extra,
  });
  const plan = { name: TITLE, kind: 'strength', minutes: 45, note: 'Keep the saved title.', exercises: [
    exercise('press', 'Machine Chest Press'),
    exercise('plank', 'Plank', { mode: 'timed', target: '45 sec' }),
    exercise('approach', 'Approach Jump', { mode: 'bodyweight', measurement: 'touch', target: '1 rep' }),
    exercise('cmj', 'Countermovement Jump', { mode: 'bodyweight', measurement: 'height', target: '1 rep' }),
    exercise('pushup', 'Push-Up', { mode: 'bodyweight', target: '12 reps' }),
    exercise('split', 'Split Squat', { perSide: true }),
    exercise('carry', 'Suitcase Carry', { perSide: true, quantityUnit: 'm', target: '30 m' }),
    exercise('unrecorded', 'Mobility Hold', { mode: 'timed', target: '30 sec' }),
  ] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), masterProgram: undefined, sessionDrafts: [],
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) });
  const history = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-10-12', profile, []), 'completed'));
  const metrics = [
    { kg: 60, reps: 8 }, { seconds: 45 }, { measurementCm: 315, reps: 1 },
    { measurementCm: 65, reps: 1 }, { reps: 12 }, { kg: 20, reps: 8 }, { kg: 20, reps: 30 },
  ];
  metrics.forEach((metric, index) => Object.assign(history.exercises[index].logs[0], { kg: null, reps: null, seconds: null, measurementCm: null, done: true }, metric));
  await page.evaluate(({ key, profile, history }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: history, version: 1 }],
    nutrition: [{ id: 'nutrition-preserved', date: '2026-10-18', version: 1, payload: { kind: 'weight', kg: 64.2 } }], activities: [],
  })), { key: STORE, profile, history });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
  await seed(page);
});

test('previews and focused logging show exercise-specific previous metrics without changing saved records', async ({ page }) => {
  const before = await readStore(page);
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  for (const [name, label] of [
    ['Machine Chest Press', '60 kg × 8'], ['Plank', '45 sec'], ['Approach Jump', 'Maximum touch 315 cm'],
    ['Countermovement Jump', 'Jump height 65 cm'], ['Push-Up', '12 reps'], ['Split Squat', '20 kg × 8 per side'],
    ['Suitcase Carry', '20 kg × 30 m per side'],
  ]) {
    await expect(preview.getByRole('button', { name: `Exercise details for ${name}`, exact: true }))
      .toContainText(`Previous · ${label} · 2026-10-12`);
  }
  await expect(preview.getByRole('button', { name: 'Exercise details for Mobility Hold', exact: true }).locator('.plan-preview__previous')).toHaveCount(0);
  await expect(preview).not.toContainText('No comparable working');
  await expect(preview.locator('.plan-preview__previous')).toHaveCount(7);
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  expect(await readStore(page)).toEqual(before);

  await openSection(page, 'Train');
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  const current = page.getByRole('region', { name: 'Current exercise', exact: true });
  for (const [name, metric] of [['Plank', '45 sec'], ['Approach Jump', 'Maximum touch 315 cm'], ['Push-Up', '12 reps'], ['Mobility Hold', undefined]]) {
    const movements = page.locator('.focused-movements');
    if (!await movements.evaluate(element => (element as HTMLDetailsElement).open)) await movements.locator(':scope > summary').click();
    await movements.getByRole('button', { name: `Train ${name}`, exact: true }).click();
    if (metric) await expect(current.locator('.focused-exercise__previous')).toContainText(metric);
    else await expect(current.locator('.focused-exercise__previous')).toHaveCount(0);
  }
  const after = await readStore(page);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  expect(after.profile).toEqual(before.profile);
  expect(after.nutrition).toEqual(before.nutrition);
});

test('the saved workout title stays consistent across Today, Train, preview, active session and history', async ({ page }) => {
  const before = await readStore(page);
  await expect(page.getByRole('region', { name: 'Your day', exact: true }).getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
  await preview.getByRole('button', { name: 'Close', exact: true }).click();
  await openSection(page, 'Train');
  await expect(page.getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await finishWarmup(page);
  await expect(page.getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
  await openSection(page, 'Today');
  await expect(page.getByRole('region', { name: 'Your day', exact: true }).getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
  await openSection(page, 'You');
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const card = page.locator('.history-card').filter({ has: page.getByRole('heading', { name: TITLE, exact: true }) });
  await expect(card).toHaveCount(1);
  await card.click();
  const history = page.getByRole('dialog', { name: TITLE, exact: true });
  await expect(history).toBeVisible();
  const after = await readStore(page);
  expect(after.sessions.find((row: { session: { id: string } }) => row.session.id === before.sessions[0].session.id)).toEqual(before.sessions[0]);
  expect(after.profile.plan).toEqual(before.profile.plan);
});

for (const appearance of ['light', 'dark']) {
  test(`long saved titles keep the start action reachable on a small iPhone in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.evaluate(({ key, appearance }) => {
      const store = JSON.parse(localStorage.getItem(key)!); store.profile.appearance = appearance;
      localStorage.setItem(key, JSON.stringify(store));
    }, { key: STORE, appearance });
    await page.reload();
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--app-safe-area-top', '47px');
      document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
    });
    for (const destination of ['Today', 'Train']) {
      await openSection(page, destination);
      await expect(page.getByRole('heading', { name: TITLE, exact: true })).toBeVisible();
      const start = page.getByRole('button', { name: 'Start workout', exact: true });
      const nav = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
      const box = (await start.boundingBox())!;
      expect(await page.evaluate(() => scrollY)).toBe(0);
      expect(box.y).toBeGreaterThanOrEqual(47);
      expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
      expect(await start.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        return hit != null && element.contains(hit);
      })).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
