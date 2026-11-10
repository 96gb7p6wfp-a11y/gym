import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, PlanDaySchema, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const TODAY = '2026-11-10';
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
async function seedHome(page: Page, options: { appearance?: 'light' | 'dark'; empty?: boolean; simple?: boolean } = {}) {
  const profile = ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), bodyWeight: 64,
    appearance: options.appearance ?? 'light', presentationMode: options.simple ? 'simple' : 'athlete',
    plan: createV9VolleyballMasterPlan(), masterMatchWeekend: createV9VolleyballMasterPlan(true).slice(5),
    masterProgram: { version: 1, revision: '9', startDate: '2026-11-02', matchWeeks: [], calendarMatches: [], dailyReadiness: [],
      clearance: { impact: 'cleared', heavyLifting: 'cleared' } },
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'Isolated QA fixture only.' } });
  const completed = (date: string, kg: number) => {
    const hack = profile.plan[2].exercises.find(exercise => exercise.name === 'Hack Squat')!;
    const plan = PlanDaySchema.parse({ name: 'Recorded QA strength', kind: 'strength', minutes: 60, note: '',
      exercises: [{ ...hack, equipmentLabel: 'QA Matrix Hack Squat', sets: 3 }] });
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, profile, []), 'completed'));
    session.exercises[0].logs.forEach(log => Object.assign(log, { kg, reps: 6, rir: 2, done: true }));
    return { session, version: 1 };
  };
  const jump = (date: string, type: 'standing' | 'approach', cm: number) => ({
    id: crypto.randomUUID(), date, type, measurement: 'height', source: 'measured', cm, standingReachCm: 235,
    touchCm: 235 + cm, conditions: 'QA same wall and shoes', notes: '',
  });
  const activity = (date: string, sport: 'volleyball' | 'pe') => ({ version: 1, activity: {
    id: crypto.randomUUID(), date, type: 'other', name: sport === 'volleyball' ? 'Volleyball' : 'School PE', durationMinutes: 120,
    distanceKm: null, intensity: 'moderate', bodyWeightKg: 64, watchCalories: null, notes: '',
    createdAt: Date.parse(`${date}T10:00:00Z`), deletedAt: null, trainingExposure: { sport },
  } });
  const state = { schemaVersion: 1, profile, profileVersion: 1,
    sessions: options.empty ? [] : [completed('2026-11-02', 70), completed('2026-11-09', 75)],
    nutrition: options.empty ? [] : [
      ['2026-10-26', 69], ['2026-10-29', 69.2], ['2026-10-30', 69.4],
      ['2026-11-02', 70], ['2026-11-05', 70.2], ['2026-11-06', 70.4],
    ].map(([date, kg], index) => ({ id: `qa-home-weight-${index}`, version: 1, date, payload: { kind: 'weight', kg } })),
    activities: options.empty ? [] : [activity('2026-11-09', 'volleyball'), activity(TODAY, 'pe'), activity('2026-11-13', 'volleyball')],
    performance: { jumps: options.empty ? [] : [jump('2026-11-02', 'approach', 70), jump('2026-11-09', 'approach', 72),
      jump('2026-11-02', 'standing', 65), jump('2026-11-09', 'standing', 67)], readiness: [] }, performanceVersion: 1,
    reminders: defaultReminderState(),
  };
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORE, state });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return state;
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('Today has the actual session, comparable recorded progress, actual consistency and one supported next step', async ({ page }) => {
  await seedHome(page);
  const before = await raw(page);
  await expect(page.locator('.page-header')).toContainText(/Tuesday,? 10 November/);
  const hero = page.getByRole('region', { name: 'Your day', exact: true });
  await expect(hero.getByRole('heading', { name: 'Volleyball + Approach Technique', exact: true })).toBeVisible();
  await expect(hero).toContainText('20:00–22:00');
  const progress = page.getByRole('region', { name: 'Your progress', exact: true });
  await expect(progress).toContainText('Hack Squat');
  await expect(progress).toContainText('+5');
  await expect(progress).toContainText('70 → 75 kg · QA Matrix Hack Squat');
  await expect(progress).toContainText('at the same 6 reps · RIR 2');
  await expect(progress).toContainText('Approach jump');
  await expect(progress).toContainText('70 → 72 cm · same recorded setup');
  await expect(progress).toContainText('Standing vertical');
  await expect(progress).toContainText('Weekly average');
  await expect(progress).toContainText('70.2');
  await expect(progress).not.toContainText('64 kg');
  const consistency = page.getByRole('region', { name: 'Training progress', exact: true });
  await expect(consistency).toContainText('1 / 4');
  await expect(consistency).toContainText('1 volleyball day recorded');
  await expect(consistency.getByRole('listitem', { name: /gym workout recorded/ })).toHaveCount(1);
  await expect(consistency.getByRole('listitem')).toHaveCount(7);
  await expect(consistency.locator('[data-recorded="true"]')).toHaveCount(2);
  await expect(page.getByRole('region', { name: 'Today’s coaching insight', exact: true })).toContainText('You logged +5 kg on Hack Squat');
  await expect(page.getByRole('region', { name: 'Daily readiness', exact: true })).toHaveCount(0);
  await expect(page.locator('.coach-today-readiness')).toHaveCount(0);
  await progress.getByRole('button', { name: 'View your progress', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Progress', exact: true })).toHaveAttribute('data-state', 'active');
  expect(await raw(page)).toBe(before);
  await page.getByRole('tab', { name: 'Train', exact: true }).click();
  await page.getByRole('button', { name: /^Sat / }).click();
  await page.getByRole('tab', { name: 'Today', exact: true }).click();
  await expect(hero.getByRole('heading', { name: 'Volleyball + Approach Technique', exact: true })).toBeVisible();
  await expect(page.locator('.page-header')).toContainText(/Tuesday,? 10 November/);
  expect(await raw(page)).toBe(before);
});

test('empty Simple progress has one useful route and no owner weight, fabricated improvement or scheduled attendance', async ({ page }) => {
  await seedHome(page, { empty: true, simple: true });
  const before = await raw(page);
  const progress = page.getByRole('region', { name: 'Your progress', exact: true });
  await expect(progress).toContainText('A clear baseline comes first.');
  await expect(progress.locator('.today-progress__metric')).toHaveCount(0);
  await expect(progress).not.toContainText('64');
  await expect(progress).not.toContainText('+');
  const consistency = page.getByRole('region', { name: 'Training progress', exact: true });
  await expect(consistency).toContainText('0 / 4');
  await expect(consistency.locator('[data-recorded="true"]')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Today’s coaching insight', exact: true })).toContainText('record the sets you actually complete');
  await progress.getByRole('button', { name: 'View your progress', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Progress overview', exact: true })).toBeVisible();
  expect(await raw(page)).toBe(before);
});

for (const { width, height, appearance } of [
  { width: 320, height: 568, appearance: 'light' as const },
  { width: 390, height: 844, appearance: 'dark' as const },
  { width: 430, height: 932, appearance: 'light' as const },
]) {
  test(`Today keeps its main action clear and real metrics contained at ${width}px in ${appearance}, including enlarged text`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await seedHome(page, { appearance });
    const before = await raw(page);
    const hero = page.getByRole('region', { name: 'Your day', exact: true });
    const action = hero.getByRole('button', { name: 'Log activity', exact: true });
    const nav = (await page.getByRole('tablist', { name: 'Main navigation', exact: true }).boundingBox())!;
    const bounds = (await action.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.y + bounds.height).toBeLessThan(nav.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`today-${width}-${appearance}.png`), fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const progress = page.getByRole('region', { name: 'Your progress', exact: true });
    await progress.scrollIntoViewIfNeeded();
    const overlapping = await progress.locator('.today-progress__metric').evaluateAll(metrics => metrics.some(metric => {
      const description = metric.querySelector('.today-progress__description')!.getBoundingClientRect();
      const value = metric.querySelector('.today-progress__value')!.getBoundingClientRect();
      return Math.min(description.right, value.right) > Math.max(description.left, value.left) + 1
        && Math.min(description.bottom, value.bottom) > Math.max(description.top, value.top) + 1;
    }));
    expect(overlapping).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`today-${width}-${appearance}-large-text.png`), fullPage: true });
    expect(await raw(page)).toBe(before);
  });
}
