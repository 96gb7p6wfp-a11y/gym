import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, ExerciseSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { openSection } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-02';
const NAMES = ['Machine Chest Press', 'Chest-Supported Row', 'Goblet Squat', 'Leg Curl', 'Cable Lateral Raise'];
const NOTE = 'Keep the saved controlled tempo. Stop if the shoulder is painful.';
const BENEFIT = 'Saved session-specific upper-body goal';

async function seed(page: Page, appearance: 'light' | 'dark' = 'light') {
  const exercises = NAMES.map((name, index) => ExerciseSchema.parse({
    key: `v17-preview-${index}`, name, group: 'Strength', sets: 3, target: '8–12 reps',
    mode: 'weight', rest: 90, perSide: false,
    ...(index === 0 ? { equipmentLabel: 'Matrix Chest Press', benefit: BENEFIT, cue: NOTE } : {}),
  }));
  const plan = { name: 'My saved strength session', kind: 'strength', goal: 'strength', minutes: 45,
    note: 'Keep the original exercise sequence.', exercises, warmup: [], cooldown: [] };
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), masterProgram: undefined, appearance,
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) });
  const previous = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-10-26', profile, []), 'completed'));
  previous.exercises[0].logs[0] = { ...previous.exercises[0].logs[0], kg: 62.5, reps: 8, done: true };
  await page.evaluate(({ key, profile, previous }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [{ session: previous, version: 1 }],
    nutrition: [], activities: [], reminders: { items: [], entries: [] },
  })), { key: STORE, profile, previous });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
});

for (const [width, appearance] of [[320, 'light'], [375, 'dark'], [390, 'light'], [430, 'dark']] as const) {
  test(`compact preview preserves saved prescriptions, instructions and data at ${width}px in ${appearance}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await seed(page, appearance);
    const before = await raw(page);
    await page.getByRole('button', { name: 'View workout', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
    const rows = preview.locator('.plan-preview__exercise');
    await expect(rows).toHaveCount(NAMES.length);
    expect(await rows.locator('.plan-preview__exercise-copy > strong').allTextContents()).toEqual(NAMES);
    await expect(rows.first()).toContainText('3 × 8–12 reps · 90 sec rest');
    await expect(rows.first()).toContainText('Matrix Chest Press');
    await expect(rows.first()).toContainText('Previous · 62.5 kg × 8');
    await expect(rows.first()).not.toContainText(BENEFIT);
    await expect(rows.first()).not.toContainText(NOTE);
    // Plain prescription rows keep the list compact while retaining a full tap target.
    const size = (await rows.nth(2).boundingBox())!;
    expect(size.height).toBeLessThanOrEqual(100);
    const details = rows.first().getByRole('button', { name: `Exercise details for ${NAMES[0]}`, exact: true });
    expect((await details.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await details.click();
    const guide = page.getByRole('dialog', { name: NAMES[0], exact: true });
    const saved = guide.getByRole('region', { name: 'Saved session details', exact: true });
    await expect(saved).toContainText(BENEFIT);
    await expect(saved).toContainText(NOTE);
    await expect(saved).toContainText('Matrix Chest Press');
    await expect(saved).toContainText('3 × 8–12 reps · 90 sec rest');
    await guide.getByRole('button', { name: 'Close', exact: true }).click();
    const start = preview.getByRole('button', { name: 'Start workout', exact: true });
    await start.scrollIntoViewIfNeeded();
    expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(52);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await preview.getByRole('button', { name: 'Close', exact: true }).click();
    await openSection(page, 'Train');
    await page.locator('.planned-preview > summary').click();
    const readOnly = page.getByRole('list', { name: 'Planned exercises', exact: true });
    await expect(readOnly.getByRole('button', { name: `Exercise details for ${NAMES[0]}`, exact: true })).toContainText('90 sec rest');
    expect(await raw(page)).toBe(before);
  });
}

test('Today keeps one main decision and shows the next saved practice without repeating today’s volleyball', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-03T10:00:00Z'));
  const profile = ProfileSchema.parse(structuredClone(DEFAULT_PROFILE));
  await page.evaluate(({ key, profile }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [], nutrition: [], activities: [], reminders: { items: [], entries: [] },
  })), { key: STORE, profile });
  await page.reload();
  const before = await raw(page);
  const today = page.getByRole('region', { name: 'Your day', exact: true });
  await expect(today.getByLabel('Session type', { exact: true })).toHaveText('On-court session');
  await expect(today.getByRole('button', { name: 'Start workout', exact: true })).toBeVisible();
  await expect(today).not.toContainText(/Setline V\d|V13\.1 is ready/);
  const next = page.getByRole('region', { name: 'Next training event', exact: true });
  await expect(next).toContainText('Fri');
  await expect(next).not.toContainText('Today');
  expect(await raw(page)).toBe(before);
});
