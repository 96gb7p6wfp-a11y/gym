import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ExerciseSchema, PlanDaySchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const STORE = 'setline.gym.v1';
const DATE = '2026-11-09';
const TITLE = 'Upper A — Spike Power + Strength';
const NAMES = ['Machine Chest Press', 'Chest-Supported Row', 'Romanian Deadlift', 'Hack Squat', 'Lat Pulldown', 'Cable Crunch'];

async function finishFixture(page: Page, options: { appearance?: 'light' | 'dark'; baseline?: boolean; repeated?: boolean; large?: boolean } = {}) {
  await page.clock.install({ time: new Date(`${DATE}T12:00:00Z`) });
  await page.goto('/');
  const count = options.large ? 40 : 6;
  const exercises = Array.from({ length: count }, (_, index) => ExerciseSchema.parse({ key: `completion-movement-${index}`,
    name: options.large ? `Machine Chest Press · saved configuration ${index + 1}` : NAMES[index],
    group: 'Strength', sets: options.large ? 20 : 3, target: '8 reps', rest: 120, mode: 'weight', perSide: false,
    equipmentLabel: `QA machine ${index + 1}`, defaultKg: 55,
  }));
  const name = options.large ? 'Oberkörpertraining mit Schlagkraft und gezielter Schulterstabilität' : TITLE;
  const plan = PlanDaySchema.parse({ name, kind: 'strength', minutes: 90, note: 'Isolated visual QA workout', exercises, warmup: [], cooldown: [] });
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), presentationMode: 'athlete', appearance: options.appearance ?? 'light',
    plan: DEFAULT_PROFILE.plan.map((day, index) => index === 0 ? plan : day) });
  const previous = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, '2026-11-02', profile, []), 'completed'));
  previous.startedAt = Date.parse('2026-11-02T10:00:00Z');
  previous.finishedAt = previous.startedAt + 111 * 60_000;
  previous.elapsedMs = 111 * 60_000;
  previous.exercises.forEach(exercise => exercise.logs.forEach(log => Object.assign(log, { kg: 55, reps: 8, rir: 2, done: true })));
  const active = SessionSchema.parse(createSession(plan, 0, DATE, profile, []));
  active.startedAt = Date.parse(`${DATE}T08:00:00Z`); active.runningSince = null;
  active.elapsedMs = options.large ? (167 * 60 + 59) * 60_000 : 111 * 60_000;
  active.exercises.forEach(exercise => {
    exercise.logs = Array.from({ length: options.large ? 25 : 3 }, (_, index) => ({ ...exercise.logs[index % exercise.logs.length],
      id: crypto.randomUUID(), kg: options.repeated ? 55 : 60, reps: 8, rir: 2, done: true }));
  });
  const parsed = SessionSchema.parse(active);
  await page.evaluate(({ profile, active, previous, baseline }) => localStorage.setItem('setline.gym.v1', JSON.stringify({
    schemaVersion: 1, profile, profileVersion: 1, sessions: [...(!baseline ? [{ session: previous, version: 1 }] : []), { session: active, version: 1 }],
    nutrition: [], activities: [],
  })), { profile, active: parsed, previous, baseline: options.baseline ?? false });
  await page.reload();
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: 'Finish workout', exact: true }).click();
  await page.getByRole('dialog', { name: 'Finish your workout', exact: true })
    .getByRole('button', { name: 'Save completed workout', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Workout complete summary', exact: true });
  await expect(summary).toBeVisible();
  return { summary, previous, activeId: active.id };
}

async function metricsFit(page: Page) {
  const result = await page.locator('.workout-completion__metrics').evaluate(container => {
    const metrics = [...container.children] as HTMLElement[];
    const bounds = container.getBoundingClientRect();
    const overlaps: number[][] = [];
    const failures: string[] = [];
    for (let index = 0; index < metrics.length; index++) {
      const metric = metrics[index];
      const box = metric.getBoundingClientRect();
      if (box.left < bounds.left - 1 || box.right > bounds.right + 1) failures.push(`metric ${index} leaves container`);
      if (metric.scrollWidth > metric.clientWidth + 1) failures.push(`metric ${index} clips text`);
      const value = metric.querySelector('strong')!.getBoundingClientRect();
      const label = metric.querySelector('span')!.getBoundingClientRect();
      if (value.bottom > label.top + .5) failures.push(`value ${index} overlaps its label`);
      for (let other = index + 1; other < metrics.length; other++) {
        const next = metrics[other].getBoundingClientRect();
        if (Math.min(box.right, next.right) > Math.max(box.left, next.left) + 1
          && Math.min(box.bottom, next.bottom) > Math.max(box.top, next.top) + 1) overlaps.push([index, other]);
      }
    }
    return { failures, overlaps, documentFits: document.documentElement.scrollWidth <= innerWidth,
      durationOwnsRow: Math.abs(metrics[0].getBoundingClientRect().width - bounds.width) <= 1 };
  });
  expect(result).toEqual({ failures: [], overlaps: [], documentFits: true, durationOwnsRow: true });
}

for (const [width, appearance] of [[320, 'light'], [320, 'dark'], [390, 'light'], [430, 'dark']] as const) {
  test(`completion keeps duration and distinct records separated at ${width}px in ${appearance}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    const { summary, previous } = await finishFixture(page, { appearance });
    await expect(summary.getByRole('group', { name: 'Training duration', exact: true })).toContainText('1h 51m');
    await expect(summary.getByRole('group', { name: 'Completed sets', exact: true })).toContainText('18');
    await expect(summary.getByRole('group', { name: 'New personal records', exact: true })).toContainText('6');
    await expect(summary).toContainText(TITLE);
    await expect(summary).toContainText('+5 kg at the same 8 reps');
    await metricsFit(page);
    const done = summary.getByRole('button', { name: 'Done', exact: true });
    const cooldown = summary.getByRole('button', { name: 'Optional cooldown', exact: true });
    expect(await done.evaluate(element => element.classList.contains('btn'))).toBe(true);
    expect(await cooldown.evaluate(element => element.classList.contains('btn'))).toBe(false);
    expect(await done.evaluate(element => {
      const secondary = element.parentElement!.querySelector('.workout-completion__stretch')!;
      return Boolean(element.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await testInfo.attach(`completion-${width}-${appearance}`, { body: await page.screenshot(), contentType: 'image/png' });
    const before = await page.evaluate(key => localStorage.getItem(key), STORE);
    await done.click();
    await expect(summary).not.toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), STORE)).toBe(before);
    const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
    expect(saved.sessions.find((row: { session: { id: string } }) => row.session.id === previous.id).session).toEqual(previous);
  });
}

test('large text wraps long labels and values without clipping on a small dark phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const { summary } = await finishFixture(page, { appearance: 'dark' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await summary.locator('.workout-completion__metrics > div:first-child > span').evaluate(element => {
    element.textContent = 'Gesamte aufgezeichnete Trainingsdauer';
  });
  await summary.locator('.workout-completion__metrics > div:nth-child(2) > span').evaluate(element => {
    element.textContent = 'Vollständig abgeschlossene Trainingssätze';
  });
  await summary.locator('.workout-completion__metrics > div:nth-child(2) > strong').evaluate(element => {
    // Stress a future large-count presentation without changing any saved record.
    element.textContent = '1,234,567';
  });
  await metricsFit(page);
  await testInfo.attach('completion-large-text-320-dark', { body: await page.screenshot(), contentType: 'image/png' });
  await summary.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(summary).not.toBeVisible();
});

test('a long valid workout duration and one thousand completed sets remain legible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const { summary } = await finishFixture(page, { large: true });
  await expect(summary.getByRole('group', { name: 'Training duration', exact: true })).toContainText('167h 59m');
  await expect(summary.getByRole('group', { name: 'Completed sets', exact: true })).toContainText('1,000');
  await expect(summary.getByRole('group', { name: 'New personal records', exact: true })).toContainText('40');
  await metricsFit(page);
  await testInfo.attach('completion-long-duration-375-light', { body: await page.screenshot(), contentType: 'image/png' });
});

for (const repeated of [false, true]) {
  test(`completion labels ${repeated ? 'a matched best' : 'a first baseline'} without counting it as an improvement`, async ({ page }) => {
    const { summary } = await finishFixture(page, { baseline: !repeated, repeated });
    await expect(summary.getByRole('group', { name: 'New personal records', exact: true })).toHaveCount(0);
    await expect(summary).toContainText(repeated ? 'Personal best matched' : 'First recorded performance');
    await expect(summary.locator('.workout-completion__comparison')).toHaveCount(0);
    await summary.getByRole('button', { name: 'Optional cooldown', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Stretch routine', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Current exercise', exact: true })).toHaveCount(0);
  });
}
