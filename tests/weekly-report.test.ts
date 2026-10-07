import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers, getCalories } from '../src/domain.js';
import { estimateActivity, type ActivityRecord } from '../src/activities.ts';
import { getWeeklyReport, reportWeekStart, shiftReportDate, currentReportDate, type ReportSession } from '../src/weekly-report.ts';

function session(date: string, minutes = 30, day = 0): ReportSession {
  const started = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[day], day, date, DEFAULT_PROFILE, []));
  started.runningSince = null;
  started.elapsedMs = minutes * 60_000;
  return SessionSchema.parse(stopSessionTimers(started, 'completed', started.startedAt + minutes * 60_000));
}

function activity(date: string, overrides: Partial<ActivityRecord['activity']> = {}): ActivityRecord {
  return { version: 1, activity: {
    id: crypto.randomUUID(), date, type: 'run', name: 'Running', durationMinutes: 30, distanceKm: 5,
    intensity: 'moderate', bodyWeightKg: 61, watchCalories: null, notes: '', createdAt: Date.now(), deletedAt: null,
    ...overrides,
  } };
}

function report(sessions: ReportSession[] = [], activities: ActivityRecord[] = [], weekStart = '2026-10-05') {
  return getWeeklyReport({ weekStart, sessions, activities, plan: DEFAULT_PROFILE.plan, bodyWeight: 61 });
}

function meal(date: string, protein: number) {
  return { date, payload: {
    kind: 'meal', name: 'Lunch', source: 'manual', notes: '', assumptions: '', confidence: null,
    foods: [{ name: 'Tofu', portion: 'one serving', calories: 250, protein, carbs: 20, fat: 8 }],
  } };
}

test('report calendar weeks are Monday–Sunday across months, years and daylight saving boundaries', () => {
  assert.equal(reportWeekStart('2026-10-11'), '2026-10-05');
  assert.equal(reportWeekStart('2026-10-05'), '2026-10-05');
  assert.equal(reportWeekStart('2027-01-01'), '2026-12-28');
  assert.equal(shiftReportDate('2026-03-28', 2), '2026-03-30');
  assert.equal(shiftReportDate('2026-10-24', 2), '2026-10-26');
  assert.equal(shiftReportDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftReportDate('2026-12-31', 1), '2027-01-01');
  assert.deepEqual(report([], [], '2026-10-25').dates, ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
});

test('invalid report dates reject rather than silently rolling into a different month', () => {
  for (const date of ['2026-02-29', '2026-13-01', '26-10-05', 'not-a-date', '2026-04-31']) {
    assert.throws(() => reportWeekStart(date), /valid report date/);
  }
  const local = new Date(2026, 9, 7, 1, 15);
  assert.equal(currentReportDate(local), '2026-10-07');
});

test('an empty week reports no evidence, no fabricated baseline and actionable brief guidance', () => {
  const result = report();
  assert.equal(result.hasData, false);
  assert.equal(result.limitedData, true);
  assert.equal(result.totals.workouts, 0);
  assert.equal(result.totals.minutes, 0);
  assert.equal(result.totals.activeCalories, 0);
  assert.equal(result.completedPlannedGymDays, 0);
  assert.equal(result.plannedGymDays, 4);
  assert.equal(result.minutesChangePercent, null);
  assert.deepEqual(result.performance, []);
  assert.match(result.insights.join(' '), /No completed workouts/);
  assert.match(result.actions.join(' '), /85–122 g protein/);
  assert.ok([...result.insights, ...result.actions].join(' ').split(/\s+/).length <= 120);
});

test('only completed undeleted workouts and undeleted activities inside the seven dates count', () => {
  const valid = session('2026-10-05');
  const cancelled = { ...session('2026-10-06'), status: 'cancelled' as const };
  const active = { ...session('2026-10-07'), status: 'active' as const };
  const deleted = { ...session('2026-10-08'), status: 'deleted' as const, deletedAt: Date.now() };
  const deletedFlag = { ...session('2026-10-09'), deletedAt: Date.now() };
  const sunday = session('2026-10-11', 45, 6);
  const before = session('2026-10-04');
  const after = session('2026-10-12');
  const entries = [activity('2026-10-06'), activity('2026-10-07', { deletedAt: Date.now() }), activity('2026-10-12')];
  const result = report([valid, cancelled, active, deleted, deletedFlag, sunday, before, after], entries);
  assert.equal(result.totals.workouts, 2);
  assert.equal(result.totals.extraActivities, 1);
  assert.equal(result.totals.minutes, 105);
  assert.equal(result.totals.activeDays, 3);
  assert.equal(result.weekEnd, '2026-10-11');
  assert.equal(result.previous.workouts, 1);
});

test('plan adherence counts each planned gym date once and does not inflate it with the Tuesday primer', () => {
  const monday = session('2026-10-05', 30, 0);
  const sameMonday = session('2026-10-05', 15, 3);
  const tuesdayPrimer = session('2026-10-06', 20, 3);
  const wednesday = session('2026-10-07', 45, 2);
  const volleyball = session('2026-10-09', 60, 4);
  const result = report([monday, sameMonday, tuesdayPrimer, wednesday, volleyball]);
  assert.equal(result.totals.workouts, 5);
  assert.equal(result.totals.gymDays, 3);
  assert.equal(result.totals.activeDays, 4);
  assert.equal(result.plannedGymDays, 4);
  assert.equal(result.completedPlannedGymDays, 2);
});

test('session time, checked sets, weight volume and active-energy readings combine with extra activities', () => {
  const gym = session('2026-10-05', 10.5);
  Object.assign(gym.exercises[0].logs[0], { done: true, kg: 10, reps: 4 });
  Object.assign(gym.exercises[0].logs[1], { done: false, kg: 1000, reps: 100 });
  Object.assign(gym.exercises[1].logs[0], { done: true, kg: 40, reps: 8 });
  gym.watchCalories = 123;
  const volleyball = session('2026-10-06', 25, 1);
  Object.assign(volleyball.exercises[0].logs[0], { done: true, seconds: 300 });
  const run = activity('2026-10-05');
  const cycle = activity('2026-10-06', { type: 'cycle', name: 'Cycling', distanceKm: 12, durationMinutes: 40, watchCalories: 200 });
  const unknownDistance = activity('2026-10-06', { distanceKm: null, durationMinutes: 10 });
  const result = report([gym, volleyball], [run, cycle, unknownDistance]);
  assert.equal(result.totals.minutes, 115.5);
  assert.equal(result.totals.completedSets, 3);
  assert.equal(result.totals.volumeKg, 360);
  assert.equal(result.totals.runKm, 5);
  assert.equal(result.totals.cycleKm, 12);
  assert.equal(result.totals.activeDays, 2);
  assert.equal(result.totals.activeCalories, 123 + getCalories(volleyball) + estimateActivity(run.activity).calories + 200 + estimateActivity(unknownDistance.activity).calories);
});

test('a zero watch calorie override remains zero for both session and extra activity', () => {
  const gym = session('2026-10-05', 60);
  gym.watchCalories = 0;
  const run = activity('2026-10-05', { watchCalories: 0 });
  assert.equal(report([gym], [run]).totals.activeCalories, 0);
});

test('week comparisons never divide by zero and flag small samples without inventing diagnoses', () => {
  const noBaseline = report([session('2026-10-05', 60)]);
  assert.equal(noBaseline.minutesChangePercent, null);
  assert.match(noBaseline.insights.join(' '), /No previous-week/);
  const small = report([session('2026-09-28', 30), session('2026-10-05', 60)]);
  assert.equal(small.minutesChangePercent, 100);
  assert.equal(small.limitedData, true);
  assert.match(small.insights.join(' '), /Only a few logs/);
  assert.match(small.actions.join(' '), /adjust gradually/);
  const sufficient = report([session('2026-09-28', 30), session('2026-09-30', 30), session('2026-10-05', 30), session('2026-10-07', 30)]);
  assert.equal(sufficient.minutesChangePercent, 0);
  assert.equal(sufficient.limitedData, false);
  assert.match(sufficient.insights.join(' '), /0%/);
  assert.ok([...sufficient.insights, ...sufficient.actions].join(' ').split(/\s+/).length <= 120);
});

test('exercise comparisons use previous latest completed session and current best checked set', () => {
  function weighted(date: string, kg: number, reps: number) {
    const workout = session(date);
    Object.assign(workout.exercises[0].logs[0], { done: true, kg, reps });
    return workout;
  }
  const earlier = weighted('2026-09-28', 25, 4);
  const latest = weighted('2026-09-30', 20, 6);
  const current = weighted('2026-10-05', 22, 4);
  Object.assign(current.exercises[0].logs[1], { done: false, kg: 200, reps: 10 });
  const currentBest = weighted('2026-10-07', 22, 6);
  const deleted = { ...weighted('2026-09-30', 100, 6), status: 'deleted' as const, deletedAt: Date.now() };
  const before = JSON.stringify([earlier, latest, current, currentBest, deleted]);
  const result = report([earlier, latest, current, currentBest, deleted]);
  assert.deepEqual(result.performance.map(item => [item.kind, item.previous, item.current, item.previousReps, item.currentReps]), [['weight', 20, 22, 6, 6]]);
  assert.equal(JSON.stringify([earlier, latest, current, currentBest, deleted]), before);
});

test('measurement comparisons require the same key and measurement kind, with completed attempts', () => {
  const previous = session('2026-09-28', 20, 6);
  const current = session('2026-10-05', 20, 6);
  const prevExercise = previous.exercises.find(exercise => exercise.measurement === 'touch')!;
  const currentExercise = current.exercises.find(exercise => exercise.key === prevExercise.key)!;
  Object.assign(prevExercise.logs[0], { done: true, reps: 1, measurementCm: 275 });
  Object.assign(currentExercise.logs[0], { done: true, reps: 1, measurementCm: 280 });
  Object.assign(currentExercise.logs[1], { done: false, reps: 1, measurementCm: 900 });
  let comparisons = report([previous, current]).performance;
  assert.equal(comparisons.length, 1);
  assert.equal(comparisons[0].kind, 'touch');
  assert.equal(comparisons[0].previous, 275);
  assert.equal(comparisons[0].current, 280);
  currentExercise.measurement = 'height';
  assert.deepEqual(report([previous, current]).performance, []);
  currentExercise.measurement = 'touch';
  currentExercise.logs[0].reps = 0;
  assert.deepEqual(report([previous, current]).performance, []);
});

test('renamed exercises cannot inherit a comparison from an old exercise with a retained key', () => {
  const previous = session('2026-09-28');
  const current = session('2026-10-05');
  Object.assign(previous.exercises[0].logs[0], { done: true, kg: 20, reps: 6 });
  Object.assign(current.exercises[0].logs[0], { done: true, kg: 30, reps: 6 });
  assert.equal(report([previous, current]).performance.length, 1);
  current.exercises[0].name = 'Different custom exercise';
  assert.equal(report([previous, current]).performance.length, 0);
  current.exercises[0].name = ` ${previous.exercises[0].name.toUpperCase()} `;
  assert.equal(report([previous, current]).performance.length, 1);
});

test('hard cardio on a recovery or lower-body day yields a concise practical scheduling suggestion', () => {
  const recovery = report([], [activity('2026-10-10', { intensity: 'hard' })]);
  assert.match(recovery.insights.join(' '), /planned recovery day/);
  assert.match(recovery.actions.join(' '), /recovery day easy/);
  const legDay = report([], [activity('2026-10-07', { intensity: 'hard', type: 'cycle' })]);
  assert.match(legDay.insights.join(' '), /lower-body or jump day/);
  const easyRecovery = report([], [activity('2026-10-10', { intensity: 'easy' })]);
  assert.doesNotMatch(easyRecovery.insights.join(' '), /Hard activity/);
});

test('nutrition advice uses only a valid provided body weight and does not invent meal intake', () => {
  const result = getWeeklyReport({ weekStart: '2026-10-05', sessions: [], activities: [], plan: DEFAULT_PROFILE.plan });
  assert.match(result.actions.join(' '), /protein in regular meals/);
  assert.doesNotMatch(result.actions.join(' '), /\d+ g protein/);
  assert.doesNotMatch(result.insights.join(' '), /ate|deficit|excess|protein intake/);
  const invalid = getWeeklyReport({ weekStart: '2026-10-05', sessions: [], activities: [], plan: DEFAULT_PROFILE.plan, bodyWeight: NaN });
  assert.match(invalid.actions.join(' '), /protein in regular meals/);
});

test('nutrition averages sum all meals on each logged day without treating missing days as zero', () => {
  const result = getWeeklyReport({ weekStart: '2026-10-05', sessions: [], activities: [], plan: DEFAULT_PROFILE.plan,
    nutritionRecords: [meal('2026-10-05', 20), meal('2026-10-05', 30), meal('2026-10-07', 10),
      meal('2026-10-04', 200), meal('2026-10-12', 300),
      { date: '2026-10-06', payload: { kind: 'weight', kg: 61 } },
      { date: '2026-10-07', payload: { kind: 'targets', calories: 2200, protein: 100, carbs: 300, fat: 60, goalWeight: null } }],
  });
  assert.deepEqual(result.nutrition, { available: true, mealLoggedDays: 2, mealsLogged: 3, meanLoggedProteinGrams: 30 });
  assert.match(result.insights.join(' '), /2\/7 days: 30 g protein\/day recorded/);
  assert.match(result.insights.join(' '), /partial logs, other meals unknown/);
  assert.doesNotMatch(result.insights.join(' '), /underfuel|deficit|ate enough|insufficient|too little/i);
  assert.equal(result.hasData, false);
});

test('unavailable meal logs, empty logs and actual zero-protein meals have different summaries', () => {
  const input = { weekStart: '2026-10-05', sessions: [], activities: [], plan: DEFAULT_PROFILE.plan };
  assert.deepEqual(getWeeklyReport(input).nutrition,
    { available: false, mealLoggedDays: 0, mealsLogged: 0, meanLoggedProteinGrams: null });
  assert.deepEqual(getWeeklyReport({ ...input, nutritionRecords: [] }).nutrition,
    { available: true, mealLoggedDays: 0, mealsLogged: 0, meanLoggedProteinGrams: null });
  const zero = getWeeklyReport({ ...input, nutritionRecords: [meal('2026-10-05', 0)] });
  assert.deepEqual(zero.nutrition,
    { available: true, mealLoggedDays: 1, mealsLogged: 1, meanLoggedProteinGrams: 0 });
  assert.match(zero.insights.join(' '), /0 g protein\/day recorded/);
});

test('invalid meal payloads cannot contaminate the nutrition summary', () => {
  const bad = meal('2026-10-05', NaN);
  const negative = meal('2026-10-06', -1);
  const result = getWeeklyReport({ weekStart: '2026-10-05', sessions: [], activities: [], plan: DEFAULT_PROFILE.plan,
    nutritionRecords: [bad, negative, { date: '2026-10-05', payload: { kind: 'meal', foods: [] } }, meal('2026-10-07', 25.123)],
  });
  assert.equal(result.nutrition.mealLoggedDays, 1);
  assert.equal(result.nutrition.mealsLogged, 1);
  assert.equal(result.nutrition.meanLoggedProteinGrams, 25.1);
});

test('all seven logged days remain partial food evidence and concise coaching preserves scheduling concerns', () => {
  const result = getWeeklyReport({ weekStart: '2026-10-05', plan: DEFAULT_PROFILE.plan, bodyWeight: 61,
    sessions: [session('2026-09-28', 20), session('2026-09-30', 20), session('2026-10-05', 45), session('2026-10-07', 45)],
    activities: [activity('2026-10-10', { intensity: 'hard' })],
    nutritionRecords: Array.from({ length: 7 }, (_, index) => meal(shiftReportDate('2026-10-05', index), 25)),
  });
  assert.match(result.insights.join(' '), /planned recovery day/);
  assert.match(result.insights.join(' '), /7\/7 days/);
  assert.match(result.insights.join(' '), /partial logs/);
  assert.equal(result.insights.length, 3);
  assert.equal(result.actions.length, 3);
  assert.ok([...result.insights, ...result.actions].join(' ').split(/\s+/).length <= 120);
});
