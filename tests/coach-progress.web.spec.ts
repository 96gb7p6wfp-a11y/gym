import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-master-plan';
import { COACH_STORE, COACH_TODAY, coachRaw, coachRead, seedCoach } from './helpers/coach';

async function seedProgress(page: Page, options: { fewerReps?: boolean; empty?: boolean } = {}) {
  await seedCoach(page);
  const state = await coachRead(page);
  const completed = (date: string, kg: number, reps: number, equipmentLabel = 'Matrix QA Hack Squat') => {
    const plan = structuredClone(createV9VolleyballMasterPlan()[2]);
    const hack = plan.exercises.find(exercise => exercise.name === 'Hack Squat')!;
    hack.equipmentLabel = equipmentLabel;
    const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 2, date, DEFAULT_PROFILE, []), 'completed'));
    session.exercises.find(exercise => exercise.name === 'Hack Squat')!.logs.forEach(log => Object.assign(log, { kg, reps, rir: 2, done: true }));
    return { session, version: 1 };
  };
  state.sessions = options.empty ? [] : [completed('2026-08-20', 65, 6), completed('2026-10-20', 70, 6),
    completed('2026-11-02', 75, 6), completed('2026-11-04', 90, 6, 'Other QA Hack Squat'),
    ...(options.fewerReps ? [completed('2026-11-05', 80, 3)] : [])];
  const testId = () => crypto.randomUUID();
  state.performance = options.empty ? { jumps: [], readiness: [] } : {
    ...state.performance, jumps: [
      { id: testId(), date: '2026-10-20', type: 'standing', measurement: 'height', cm: 65, standingReachCm: 235, touchCm: 300, source: 'measured', conditions: 'Same QA indoor court', notes: '' },
      { id: testId(), date: '2026-10-20', type: 'approach', measurement: 'height', cm: 70, standingReachCm: 235, touchCm: 305, source: 'measured', conditions: 'Same QA indoor court', notes: '' },
      { id: testId(), date: '2026-11-02', type: 'standing', measurement: 'height', cm: 67, standingReachCm: 235, touchCm: 302, source: 'measured', conditions: 'Same QA indoor court', notes: '' },
      { id: testId(), date: '2026-11-02', type: 'approach', measurement: 'height', cm: 73, standingReachCm: 235, touchCm: 308, source: 'measured', conditions: 'Same QA indoor court', notes: '' },
      { id: testId(), date: '2026-11-05', type: 'approach', measurement: 'touch', cm: 315, source: 'measured', conditions: 'Different QA setup', notes: '' },
      { id: testId(), date: '2026-11-06', type: 'approach', measurement: 'height', cm: 99, source: 'video-estimate', conditions: 'Unverified estimated QA attempt', notes: '' },
    ],
  };
  state.nutrition = options.empty ? [] : [
    { id: 'qa-weight-1', date: '2026-10-26', version: 1, payload: { kind: 'weight', kg: 69.5 } },
    { id: 'qa-weight-2', date: '2026-11-02', version: 1, payload: { kind: 'weight', kg: 70 } },
    { id: 'qa-weight-3', date: '2026-11-05', version: 1, payload: { kind: 'weight', kg: 70.2 } },
    { id: 'qa-weight-4', date: COACH_TODAY, version: 1, payload: { kind: 'weight', kg: 70.1 } },
  ];
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: COACH_STORE, state });
  await page.reload();
  await page.getByRole('tab', { name: 'Progress', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Progress overview', exact: true })).toBeVisible();
  return state;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${COACH_TODAY}T10:00:00Z`) });
  await page.goto('/');
});

test('strength compares the same machine, reps and effort and its chart period changes only presentation', async ({ page }) => {
  await seedProgress(page);
  const saved = await coachRaw(page);
  const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
  await overview.getByRole('group', { name: 'Chart metric', exact: true }).getByRole('button', { name: 'Strength', exact: true }).click();
  await expect(overview.getByRole('combobox', { name: 'Strength exercise', exact: true })).toContainText('Matrix QA Hack Squat');
  const trend = overview.getByRole('region', { name: 'Strength trend', exact: true });
  await expect(trend.getByRole('img', { name: 'Hack Squat strength trend: 70 to 75 kilograms at 6 reps', exact: true })).toBeVisible();
  await expect(trend).toContainText(/70\s*kg/);
  await expect(trend).toContainText(/75\s*kg/);
  await expect(overview.locator('.progress-lens-comparison')).toContainText('+5 kg');
  await expect(overview.locator('.progress-lens-comparison')).toContainText('RIR 2 matched');
  await expect(trend).not.toContainText('90 kg');
  const periods = overview.getByRole('group', { name: 'Chart period', exact: true });
  await periods.getByRole('button', { name: 'All time', exact: true }).click();
  await expect(trend).toContainText('3 comparable recorded days');
  await expect(periods.getByRole('button', { name: 'All time', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await periods.getByRole('button', { name: '12 weeks', exact: true }).click();
  await expect(trend).toContainText('3 comparable recorded days');
  await periods.getByRole('button', { name: '4 weeks', exact: true }).click();
  await expect(trend.getByRole('img', { name: 'Hack Squat strength trend: 70 to 75 kilograms at 6 reps', exact: true })).toBeVisible();
  await expect(trend).toContainText('2 comparable recorded days');
  expect(await coachRaw(page)).toBe(saved);
});

test('a larger weight at fewer repetitions is a new baseline rather than a fabricated strength gain', async ({ page }) => {
  await seedProgress(page, { fewerReps: true });
  const saved = await coachRaw(page);
  const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
  await overview.getByRole('group', { name: 'Chart metric', exact: true }).getByRole('button', { name: 'Strength', exact: true }).click();
  await expect(overview.getByRole('region', { name: 'Strength trend', exact: true })).toContainText('One comparable Hack Squat day recorded');
  await expect(overview.locator('.progress-lens-comparison')).not.toContainText('+');
  await expect(overview).not.toContainText('improved across three');
  expect(await coachRaw(page)).toBe(saved);
});

test('jump and weight summaries show real comparable measurements and empty progress offers recording actions', async ({ page }) => {
  await seedProgress(page);
  const saved = await coachRaw(page);
  const overview = page.getByRole('region', { name: 'Progress overview', exact: true });
  const volleyball = overview.getByRole('region', { name: 'Volleyball progress', exact: true });
  await expect(volleyball.getByRole('button', { name: 'View standing vertical jump', exact: true })).toContainText('67');
  await expect(volleyball.getByRole('button', { name: 'View approach vertical jump', exact: true })).toContainText('73');
  await expect(volleyball).toContainText('Approach Advantage');
  await expect(volleyball).toContainText('6 cm');
  await expect(volleyball).not.toContainText('315');
  await expect(volleyball).not.toContainText('99');
  await volleyball.getByRole('button', { name: 'View approach vertical jump', exact: true }).click();
  const jump = overview.getByRole('region', { name: 'Jump performance', exact: true });
  await expect(jump).toContainText('Personal best 73 cm');
  await expect(jump).toContainText('Previous 70 cm');
  await expect(jump).not.toContainText('315');
  await expect(jump).not.toContainText('99');
  await overview.getByRole('group', { name: 'Chart metric', exact: true }).getByRole('button', { name: 'Body weight', exact: true }).click();
  await expect(overview.getByLabel('Weekly body weight', { exact: true })).toContainText('70.1 kg');
  await expect(overview.getByLabel('Weekly body weight', { exact: true })).toContainText('single-day changes can be fluid');
  expect(await coachRaw(page)).toBe(saved);
  await seedProgress(page, { empty: true });
  const empty = page.getByRole('region', { name: 'Progress overview', exact: true });
  await expect(empty).not.toContainText('Personal best');
  await expect(empty).not.toContainText('improved');
  await expect(empty.getByRole('button', { name: /Record.*jump|Log.*jump|Add.*jump/i })).toBeVisible();
});
