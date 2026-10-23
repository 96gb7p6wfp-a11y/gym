import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession } from '../src/domain.js';
import { findLibraryExercise, toPlanExercise } from '../src/exercise-library';
import { finishWarmup } from './helpers/navigation';

const STORE = 'setline.gym.v1';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);

async function seed(page: Page, activeDate?: string) {
  const profile = ProfileSchema.parse({
    ...structuredClone(DEFAULT_PROFILE), masterProgram: undefined, appearance: 'light',
    plan: DAYS.map((day, index) => ({
      name: `${day} Session`, kind: 'strength', goal: 'strength', minutes: 40 + index,
      note: `Preparation for ${day.toLowerCase()}.`,
      exercises: [{ ...toPlanExercise(findLibraryExercise(index === 5 ? 'Goblet Squat' : 'Hack Squat')!), sets: 3, target: '6–8 reps', defaultKg: 40 + index, rest: 90 }],
    })),
  });
  const history = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-10-12', profile, []));
  history.status = 'completed'; history.runningSince = null;
  history.finishedAt = history.startedAt + 30 * 60_000; history.elapsedMs = 30 * 60_000;
  const sessions = [{ session: history, version: 1 }];
  if (activeDate) sessions.push({ session: SessionSchema.parse(createSession(profile.plan[5], 5, activeDate, profile, [])), version: 1 });
  await page.evaluate(({ key, profile, sessions }) => localStorage.setItem(key, JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions, nutrition: [], activities: [],
  })), { key: STORE, profile, sessions });
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
}

async function openTrain(page: Page, day: string) {
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${day} `) }).click();
}

async function preview(page: Page) {
  await page.getByRole('button', { name: 'View workout', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe('Today and training-calendar dates are independent', () => {
  // The app's calendar is Berlin even when the browser uses a different zone.
  test.use({ timezoneId: 'UTC' });

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-22T10:00:00Z') });
    await page.goto('/');
  });

  test('browsing Saturday leaves Thursday Today, its next event and both previews intact', async ({ page }) => {
    await seed(page);
    const before = await read(page);
    await openTrain(page, 'Sat');
    await expect(page.locator('.session-card h2')).toHaveText('Saturday Session');
    const trainPreview = await preview(page);
    await expect(trainPreview).toContainText('Saturday Session');
    await expect(trainPreview).toContainText('24 Oct');
    await expect(trainPreview.getByRole('list', { name: 'Scheduled exercises', exact: true })).toContainText('Goblet Squat');
    await trainPreview.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(page.locator('.page-header')).toContainText(/Thursday,? 22 October/);
    await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Thursday Session');
    await expect(page.getByRole('region', { name: 'Next training event', exact: true })).toContainText('Fri');
    const todayPreview = await preview(page);
    await expect(todayPreview).toContainText('Thursday Session');
    await expect(todayPreview).toContainText('22 Oct');
    await expect(todayPreview.getByRole('list', { name: 'Scheduled exercises', exact: true })).toContainText('Hack Squat');
    await todayPreview.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Sat / })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.session-card h2')).toHaveText('Saturday Session');
    expect(await read(page)).toEqual(before);
    await expect(page.locator('.rest-floating')).toHaveCount(0);
  });

  test('editing the selected Train day persists without starting a session or changing Today or history', async ({ page }) => {
    await seed(page);
    const before = await read(page);
    await openTrain(page, 'Sat');
    let sheet = await preview(page);
    await sheet.getByRole('button', { name: 'Options for Goblet Squat', exact: true }).click();
    const menu = page.getByRole('dialog', { name: 'Goblet Squat', exact: true });
    await menu.getByRole('button', { name: 'Sets, reps & rest', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit exercise', exact: true });
    await edit.getByLabel('Sets', { exact: true }).fill('2');
    await edit.getByRole('textbox', { name: 'Goblet Squat planned weight in kilograms', exact: true }).fill('12.5');
    await edit.getByRole('button', { name: 'Save for this day', exact: true }).click();
    await expect(edit).not.toBeVisible();
    await expect(sheet).toContainText('2 × 6–8 reps · 12.5 kg');
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    const saved = await read(page);
    expect(saved.profile.sessionDrafts).toHaveLength(1);
    expect(saved.profile.sessionDrafts[0].date).toBe('2026-10-24');
    expect(saved.profile.plan).toEqual(before.profile.plan);
    expect(saved.sessions).toEqual(before.sessions);
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    sheet = await preview(page);
    await expect(sheet).toContainText('Thursday Session');
    await expect(sheet).toContainText('3 × 6–8 reps · 43 kg');
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await openTrain(page, 'Sat');
    sheet = await preview(page);
    await expect(sheet).toContainText('2 × 6–8 reps · 12.5 kg');
    expect((await read(page)).sessions).toEqual(before.sessions);
  });

  test('an active Saturday session does not replace the actual Thursday plan on Today', async ({ page }) => {
    await seed(page, '2026-10-24');
    const before = await read(page);
    await expect(page.locator('.page-header')).toContainText(/Thursday,? 22 October/);
    await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Thursday Session');
    const sheet = await preview(page);
    await expect(sheet).toContainText('Thursday Session');
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.locator('.session-card h2')).toHaveText('Saturday Session');
    expect((await read(page)).sessions).toEqual(before.sessions);
  });

  test('an activity added from Today uses Thursday after browsing Saturday', async ({ page }) => {
    await seed(page);
    const before = await read(page);
    await openTrain(page, 'Sat');
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await page.getByRole('button', { name: 'Add activity', exact: true }).click();
    const activities = page.getByRole('dialog', { name: 'Today’s activities', exact: true });
    await expect(activities).toContainText(/Thursday,? 22 October 2026/);
    await activities.getByRole('button', { name: 'Add activity', exact: true }).click();
    const entry = page.getByRole('dialog', { name: 'Add activity', exact: true });
    await expect(entry.getByLabel('Activity date', { exact: true })).toHaveValue('2026-10-22');
    await entry.getByLabel('Duration · minutes', { exact: true }).fill('25');
    await entry.getByRole('button', { name: 'Save activity', exact: true }).click();
    await expect(entry).not.toBeVisible();
    await activities.getByRole('button', { name: 'Close', exact: true }).click();
    const saved = await read(page);
    expect(saved.activities[0].activity.date).toBe('2026-10-22');
    expect(saved.sessions).toEqual(before.sessions);
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Sat / })).toHaveAttribute('aria-pressed', 'true');
  });

  test('starting from Today preview creates Thursday execution after browsing Saturday in Train', async ({ page }) => {
    await seed(page);
    await openTrain(page, 'Sat');
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    const sheet = await preview(page);
    await sheet.getByRole('button', { name: 'Start workout', exact: true }).click();
    expect((await read(page)).sessions).toHaveLength(1);
    await finishWarmup(page);
    await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toBeVisible();
    await expect.poll(async () => (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active')?.session.date).toBe('2026-10-22');
    const active = (await read(page)).sessions.find((row: { session: { status: string } }) => row.session.status === 'active').session;
    expect(active.name).toBe('Thursday Session');
    expect(active.exercises[0].name).toBe('Hack Squat');
    expect(active.exercises[0].logs[0].kg).toBe(43);
  });

  test('Berlin date is used after local midnight even while the browser calendar is still Thursday', async ({ page }) => {
    await page.clock.setSystemTime(new Date('2026-10-22T22:30:00Z'));
    await seed(page);
    await expect(page.locator('.page-header')).toContainText(/Friday,? 23 October/);
    await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Friday Session');
    await expect(page.getByRole('region', { name: 'Next training event', exact: true })).toContainText('Today');
  });

  test('midnight crossing a month boundary updates Today while the selected Train date stays put', async ({ page }) => {
    await page.clock.pauseAt(new Date('2026-10-31T22:59:59Z'));
    await seed(page);
    await openTrain(page, 'Sat');
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await expect(page.locator('.page-header')).toContainText(/Saturday,? 31 October/);
    await page.clock.runFor(2000);
    await expect(page.locator('.page-header')).toContainText(/Sunday,? 1 November/);
    await expect(page.getByRole('region', { name: 'Your day', exact: true })).toContainText('Sunday Session');
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.locator('.session-card')).toContainText('31 Oct');
    await expect(page.locator('.session-card h2')).toHaveText('Saturday Session');
  });

  test('resuming the PWA after midnight refreshes Today without waiting for a timer tick', async ({ page }) => {
    await page.clock.pauseAt(new Date('2026-10-31T22:50:00Z'));
    await seed(page);
    await openTrain(page, 'Sat');
    await page.getByRole('tab', { name: 'Today', exact: true }).click();
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.setSystemTime(new Date('2026-11-01T00:10:00Z'));
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.page-header')).toContainText(/Sunday,? 1 November/);
    const sheet = await preview(page);
    await expect(sheet).toContainText('Sunday Session');
    await expect(sheet).toContainText('1 Nov');
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('tab', { name: 'Train', exact: true }).click();
    await expect(page.locator('.session-card h2')).toHaveText('Saturday Session');
  });
});
