import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-10-15';

async function tab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}

async function settings(page: Page) {
  await tab(page, 'More');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Your preferences', exact: true });
  await expect(sheet).toBeVisible();
  return sheet;
}

async function performance(page: Page) {
  await tab(page, 'Progress');
  await page.getByRole('button', { name: 'Performance details', exact: true }).click();
  return page.getByRole('region', { name: 'Performance details', exact: true });
}

async function logJump(page: Page, cm: string, measurement: 'height' | 'touch' = 'height', date = DATE) {
  await tab(page, 'Progress');
  await page.getByRole('button', { name: 'Log jump', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Log jump', exact: true });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('group', { name: 'Measurement', exact: true }).getByRole('button', {
    name: measurement === 'height' ? 'Jump height' : 'Highest touch', exact: true,
  }).click();
  await sheet.getByLabel(measurement === 'height' ? 'Jump height in centimetres' : 'Highest touch in centimetres', { exact: true }).fill(cm);
  await sheet.getByLabel('Date', { exact: true }).fill(date);
  await sheet.getByRole('button', { name: 'Save jump', exact: true }).click();
  await expect(sheet).not.toBeVisible();
}

async function checkIn(page: Page) {
  await tab(page, 'Train');
  await page.getByRole('button', { name: /^Mon / }).click();
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Your session', exact: true });
  await expect(sheet.getByRole('button', { name: 'Save check-in', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Low energy', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Save check-in', exact: true })).toBeDisabled();
  await sheet.getByRole('button', { name: 'high leg soreness', exact: true }).click();
  await sheet.getByRole('button', { name: 'Save check-in', exact: true }).click();
  await expect(sheet).not.toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${DATE}T10:00:00Z`) });
  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Today', exact: true })).toHaveAttribute('data-state', 'active');
});

test('logs jump height and highest touch separately, refreshes offline and confirms deletion', async ({ page, context }) => {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state), { timeout: 15_000 }).toBe('activated');
  await context.setOffline(true);
  await logJump(page, '67,5', 'height', '2026-10-14');
  let details = page.getByRole('region', { name: 'Performance details', exact: true });
  await expect(details.getByRole('region', { name: 'Approach jump height', exact: true })).toContainText('67.5');
  await logJump(page, '305.5', 'touch');
  await expect(details.getByRole('region', { name: 'Approach highest touch', exact: true })).toContainText('305.5');
  await expect(details.getByRole('region', { name: 'Approach jump height', exact: true })).toContainText('67.5');
  await page.reload({ waitUntil: 'domcontentloaded' });
  details = await performance(page);
  await expect(details.getByRole('region', { name: 'Approach jump height', exact: true })).toContainText('67.5');
  await expect(details.getByRole('region', { name: 'Approach highest touch', exact: true })).toContainText('305.5');
  await details.locator('summary').filter({ hasText: /^Recent jump entries$/ }).click();
  await details.getByRole('button', { name: 'Remove approach jump on 2026-10-14', exact: true }).click();
  await details.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(details.getByRole('region', { name: 'Approach jump height', exact: true })).toBeVisible();
  await details.getByRole('button', { name: 'Remove approach jump on 2026-10-14', exact: true }).click();
  await details.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(details.getByRole('region', { name: 'Approach jump height', exact: true })).toHaveCount(0);
  await expect(details.getByRole('region', { name: 'Approach highest touch', exact: true })).toContainText('305.5');
  await page.reload({ waitUntil: 'domcontentloaded' });
  details = await performance(page);
  await expect(details.getByRole('region', { name: 'Approach jump height', exact: true })).toHaveCount(0);
  const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
  expect(data.performance.jumps).toHaveLength(1);
  expect(data.performance.jumps[0]).toMatchObject({ type: 'approach', measurement: 'touch', cm: 305.5 });
});

test('dark appearance persists and narrow iPhone sheets remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--app-safe-area-top', '47px');
    document.documentElement.style.setProperty('--app-safe-area-bottom', '34px');
  });
  const preferences = await settings(page);
  await preferences.getByRole('group', { name: 'Appearance', exact: true }).getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(preferences.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const close = preferences.getByRole('button', { name: 'Close', exact: true });
  const bounds = await close.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  expect(bounds!.y).toBeGreaterThanOrEqual(47);
  expect(await close.evaluate(element => {
    const b = element.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return hit != null && element.contains(hit);
  })).toBe(true);
  await close.tap();
  for (const name of ['Today', 'Train', 'Progress', 'Nutrition', 'More']) {
    await tab(page, name);
    const size = await page.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth }));
    expect(size.content).toBeLessThanOrEqual(size.width);
  }
  const channels = await page.evaluate(() => getComputedStyle(document.body).backgroundColor.match(/\d+/g)?.slice(0, 3).map(Number));
  expect(channels).toBeDefined();
  expect(channels!.every(channel => channel > 0 && channel < 60)).toBe(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const restored = await settings(page);
  await expect(restored.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('readiness is explicit and jump records, appearance and active work survive backup restore', async ({ page }) => {
  await logJump(page, '68.2');
  await checkIn(page);
  await page.locator('.focused-movements > summary').click();
  await page.getByRole('button', { name: 'Train Machine Chest Press / Bench Press', exact: true }).click();
  await expect(page.locator('.progression-cue')).toContainText('Keep it easy today');
  let preferences = await settings(page);
  await preferences.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(preferences.getByRole('button', { name: 'Dark', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const downloadPromise = page.waitForEvent('download');
  await preferences.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  const backupText = await readFile((await download.path())!, 'utf8');
  const backup = JSON.parse(backupText);
  expect(backup.data.profile.appearance).toBe('dark');
  expect(backup.data.performance.jumps).toHaveLength(1);
  expect(backup.data.performance.readiness).toHaveLength(1);
  expect(backup.data.performance.readiness[0]).toMatchObject({ energy: 'low', soreness: 'high' });
  expect(backup.data.sessions[0].session.status).toBe('active');

  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    preferences.getByRole('button', { name: 'Delete all local data', exact: true }).click(),
  ]);
  preferences = await settings(page);
  page.once('dialog', dialog => dialog.accept());
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    preferences.getByLabel('Restore Setline backup', { exact: true }).setInputFiles({
      name: download.suggestedFilename(), mimeType: 'application/json', buffer: Buffer.from(backupText),
    }),
  ]);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const restored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
  expect(restored.performance).toEqual(backup.data.performance);
  expect(restored.sessions).toEqual(backup.data.sessions);
  expect(restored.profile.plan).toEqual(backup.data.profile.plan);
  expect(restored.nutrition).toEqual(backup.data.nutrition);
  await tab(page, 'Train');
  await page.getByRole('button', { name: 'Workout options', exact: true }).click();
  const readiness = page.getByRole('dialog', { name: 'Your session', exact: true });
  await expect(readiness.getByRole('button', { name: 'Low energy', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(readiness.getByRole('button', { name: 'high leg soreness', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('completion does not celebrate a record from another workout on the same day', async ({ page }) => {
  const profile = structuredClone(DEFAULT_PROFILE);
  profile.plan[0].exercises = [{ ...profile.plan[0].exercises[1], sets: 1 }];
  const completed = (date: string, kg: number, reps: number, hour: number) => {
    const session = SessionSchema.parse(createSession(profile.plan[0], 0, date, profile, []));
    session.startedAt = Date.parse(`${date}T${String(hour).padStart(2, '0')}:00:00Z`);
    session.finishedAt = session.startedAt + 30 * 60_000;
    session.elapsedMs = 30 * 60_000;
    session.runningSince = null;
    session.status = 'completed';
    Object.assign(session.exercises[0].logs[0], { kg, reps, done: true });
    return session;
  };
  const previous = completed('2026-10-05', 50, 8, 8);
  const earlier = completed('2026-10-12', 55, 8, 8);
  const current = SessionSchema.parse(createSession(profile.plan[0], 0, '2026-10-12', profile, []));
  current.startedAt = Date.parse('2026-10-12T12:00:00Z');
  current.runningSince = null;
  current.elapsedMs = 30 * 60_000;
  await page.evaluate(({ key, data }) => localStorage.setItem(key, JSON.stringify(data)), {
    key: STORE, data: { schemaVersion: 1, profile, profileVersion: 1, sessions: [current, earlier, previous].map(session => ({ session, version: 1 })), nutrition: [], activities: [] },
  });
  await page.reload();
  await tab(page, 'Train');
  const name = 'Machine Chest Press / Bench Press';
  const focused = page.getByRole('region', { name: 'Current exercise', exact: true });
  await focused.getByRole('textbox', { name: `${name} set 1 weight in kilograms`, exact: true }).fill('52.5');
  await focused.getByRole('spinbutton', { name: `${name} set 1 reps`, exact: true }).fill('6');
  await focused.getByRole('button', { name: `Complete ${name} set 1`, exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  const finish = page.getByRole('dialog', { name: 'Finish your workout', exact: true });
  await finish.getByRole('button', { name: 'Save completed workout', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Workout complete summary', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Workout complete');
  await expect(summary).toContainText('52.5 kg × 6');
  await expect(summary).toContainText('Volleyball tomorrow');
  await expect(summary.locator('.workout-completion__metrics--records')).toHaveCount(0);
  await expect(summary).not.toContainText('new record');
  await summary.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(summary).not.toBeVisible();
});
