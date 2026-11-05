import { expect, test, type Page } from '@playwright/test';
import { DEFAULT_PROFILE, ProfileSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { applyMasterClearance, createVolleyballMasterPlan } from '../src/volleyball-master-plan';
import { defaultReminderState } from '../src/reminders';

const STORE = 'setline.gym.v1';
const SAFETY_COPY = 'setline.gym.pre-restore.v1';
const DATE = '2026-11-04';
const NOW = Date.parse(`${DATE}T10:00:00Z`);
const REVIEW_TITLE = 'Review this date’s reset';

const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORE);
const raw = (page: Page) => page.evaluate(key => localStorage.getItem(key), STORE);
const safety = (page: Page) => page.evaluate(key => localStorage.getItem(key), SAFETY_COPY);
const workingSets = (plan: { exercises: { sets: number; optionalWork?: boolean }[] }) => plan.exercises
  .filter(exercise => !exercise.optionalWork).reduce((sum, exercise) => sum + exercise.sets, 0);

async function seed(page: Page) {
  const plan = createVolleyballMasterPlan();
  // The athlete has since recorded cleared guidance, but an intentional rest
  // edit saved the older preparation prescription as this date's custom draft.
  const frozen = applyMasterClearance(structuredClone(plan[2]), { impact: 'restricted', heavyLifting: 'unknown' });
  frozen.exercises.find(exercise => exercise.name === 'Hack Squat')!.rest = 135;
  const profile = ProfileSchema.parse({
    ...structuredClone(DEFAULT_PROFILE), appearance: 'light',
    plan,
    trainingGuidance: { impact: 'cleared', heavyLifting: 'cleared', note: 'My stored personal guidance' },
    masterProgram: { version: 1, revision: '13.1', startDate: '2026-11-02', matchWeeks: [],
      clearance: { impact: 'cleared', heavyLifting: 'cleared', note: 'My stored personal guidance' },
      readiness: [{ date: DATE, status: 'green' }],
    },
    masterMatchWeekend: createVolleyballMasterPlan(true).slice(5),
    customWorkouts: [{ ...structuredClone(plan[0]), id: crypto.randomUUID(), name: 'My retained custom template' }],
    sessionDrafts: [
      { date: DATE, slot: 'main', customized: true, readiness: 'green', plan: frozen },
      { date: DATE, slot: 'extra', customized: true, plan: { ...structuredClone(plan[0]), name: 'Retained same-date extra edit' } },
      { date: '2026-11-06', slot: 'main', customized: true, plan: { ...structuredClone(plan[3]), name: 'Retained Friday edit' } },
    ],
  });
  const historical = SessionSchema.parse(createSession(plan[0], 0, '2026-10-26', profile, []));
  historical.startedAt = Date.parse('2026-10-26T10:00:00Z');
  historical.runningSince = null;
  historical.elapsedMs = 45 * 60_000;
  const weighted = historical.exercises.find(exercise => exercise.mode === 'weight' && !exercise.measurement)!;
  Object.assign(weighted.logs[0], { kg: 25, reps: 8, rir: 2, done: true });
  const history = SessionSchema.parse(stopSessionTimers(historical, 'completed', historical.startedAt + historical.elapsedMs));
  history.notes = 'Original completed history is never part of a date reset';
  const state = {
    schemaVersion: 1, profile, profileVersion: 5, sessions: [{ session: history, version: 3 }],
    nutrition: [{ id: 'retained-weight', date: '2026-11-01', version: 2, payload: { kind: 'weight', kg: 64.2 } }],
    activities: [], reminders: defaultReminderState(),
    performance: { jumps: [{ id: crypto.randomUUID(), date: '2026-10-26', type: 'standing', measurement: 'height',
      cm: 75, source: 'measured', standingReachCm: 235, touchCm: 310, notes: 'Retained test' }], readiness: [] },
    performanceVersion: 2,
  };
  const previousSafety = JSON.stringify({ savedAt: '2026-11-03T10:00:00Z', raw: JSON.stringify(state) });
  await page.evaluate(({ key, state, safetyKey, previousSafety }) => {
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem(safetyKey, previousSafety);
  }, { key: STORE, state, safetyKey: SAFETY_COPY, previousSafety });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Your day', exact: true })).toBeVisible();
  return { state, frozen, full: plan[2], previousSafety };
}

async function openReview(page: Page) {
  await page.getByRole('region', { name: 'Your day', exact: true }).getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true })).toContainText('2 × 4–6');
  await preview.getByRole('button', { name: 'Review date-only reset', exact: true }).click();
  const review = page.getByRole('dialog', { name: REVIEW_TITLE, exact: true });
  await expect(review).toBeVisible();
  return review;
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(NOW) });
  await page.goto('/');
});

test('reviewing and resetting a frozen reduced date changes only that date and keeps an exact recovery copy', async ({ page }) => {
  const fixture = await seed(page);
  const beforeRaw = (await raw(page))!;
  let review = await openReview(page);
  await expect(review).toContainText(`${workingSets(fixture.frozen)} planned sets`);
  await expect(review).toContainText(`${workingSets(fixture.full)} planned sets`);
  await review.locator('summary').filter({ hasText: /^Review exercise changes/ }).click();
  const hack = review.getByRole('list', { name: 'Date reset changes', exact: true }).locator('li').filter({ hasText: 'Hack Squat' });
  await expect(hack).toContainText('2 × 4–6');
  await expect(hack).toContainText('4 × 4–6');
  await expect(hack).toContainText('RPE 5');
  expect(await raw(page)).toBe(beforeRaw);
  await review.getByRole('button', { name: 'Keep my date edit', exact: true }).click();
  await expect(review).toHaveCount(0);
  expect(await raw(page)).toBe(beforeRaw);
  expect(await safety(page)).toBe(fixture.previousSafety);

  review = await openReview(page);
  await review.getByRole('button', { name: 'Use current weekly prescription', exact: true }).click();
  await expect(review).toHaveCount(0);
  const saved = await read(page);
  const retainedDrafts = fixture.state.profile.sessionDrafts!.filter(draft => draft.date !== DATE || draft.slot !== 'main');
  expect(saved).toEqual({ ...fixture.state, profile: { ...fixture.state.profile, sessionDrafts: retainedDrafts }, profileVersion: 6 });
  expect(JSON.parse((await safety(page))!).raw).toBe(beforeRaw);
  await page.reload();
  const afterReload = await read(page);
  expect(afterReload).toEqual(saved);
  await page.getByRole('region', { name: 'Your day', exact: true }).getByRole('button', { name: 'View workout', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Workout preview', exact: true });
  await expect(preview.getByRole('button', { name: 'Exercise details for Hack Squat', exact: true })).toContainText('4 × 4–6');
  await expect(preview.getByRole('button', { name: 'Review date-only reset', exact: true })).toHaveCount(0);
});

test('a failed date-reset safety copy preserves the entire setup, history and previous recovery bytes', async ({ page }) => {
  const fixture = await seed(page);
  const review = await openReview(page);
  const beforeRaw = await raw(page);
  await page.evaluate(safetyKey => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === safetyKey) throw new DOMException('Isolated quota failure', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  }, SAFETY_COPY);
  await review.getByRole('button', { name: 'Use current weekly prescription', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('could not be reset');
  await expect(page.getByText(/safety copy could not be saved/i)).toBeVisible();
  expect(await raw(page)).toBe(beforeRaw);
  expect(await safety(page)).toBe(fixture.previousSafety);
});

test('a changed saved profile invalidates the date-reset review without overwriting the newer preferences', async ({ page }) => {
  const fixture = await seed(page);
  const review = await openReview(page);
  await page.evaluate(key => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.profile.appearance = 'dark';
    state.profileVersion += 1;
    localStorage.setItem(key, JSON.stringify(state));
  }, STORE);
  const newerRaw = await raw(page);
  await review.getByRole('button', { name: 'Use current weekly prescription', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('setup changed after this review');
  expect(await raw(page)).toBe(newerRaw);
  expect(await safety(page)).toBe(fixture.previousSafety);
});

test('a workout started after review prevents resetting its date while preserving that active snapshot', async ({ page }) => {
  const fixture = await seed(page);
  const review = await openReview(page);
  const active = SessionSchema.parse(createSession(fixture.frozen, 2, DATE, fixture.state.profile, []));
  active.startedAt = NOW;
  active.runningSince = null;
  await page.evaluate(({ key, active }) => {
    const state = JSON.parse(localStorage.getItem(key)!);
    state.sessions.unshift({ session: active, version: 1 });
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORE, active });
  const activeRaw = await raw(page);
  await review.getByRole('button', { name: 'Use current weekly prescription', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('Finish your active workout');
  expect(await raw(page)).toBe(activeRaw);
  expect(await safety(page)).toBe(fixture.previousSafety);
});
