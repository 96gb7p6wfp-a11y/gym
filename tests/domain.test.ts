import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROFILE, DEFAULT_WEEKLY_PLAN, ProfileSchema, SessionSchema, NutritionPayloadSchema,
  createSession, stopSessionTimers, completedSets, estimatedCalories, getCalories, sessionDuration,
  formatDuration, topSet, previousExercise, bestMeasurement, measurementLabel, sumNutrients,
  startOfWeek, addDays, dateKey,
} from '../src/domain.js';

function workout(day = 0, date = '2026-10-07') {
  return createSession(DEFAULT_PROFILE.plan[day], day, date, DEFAULT_PROFILE, []);
}

test('the reference weekly plan covers seven days including the separate Tuesday primer', () => {
  assert.equal(ProfileSchema.safeParse(DEFAULT_PROFILE).success, true);
  assert.deepEqual(DEFAULT_WEEKLY_PLAN.map((day) => day.name), [
    'Upper Power + Muscle', 'Volleyball', 'Lower Strength', 'Upper Power B',
    'Volleyball', 'Recovery', 'Main Jump + Complex Lower',
  ]);
  const tuesday = DEFAULT_PROFILE.plan[1];
  assert.equal(tuesday.extraSession?.name, 'Jump Technique Primer');
  assert.equal(tuesday.extraSession?.minutes, 20);
  assert.equal(DEFAULT_PROFILE.plan[4].extraSession, undefined);
  const main = createSession(tuesday, 1, '2026-10-06', DEFAULT_PROFILE, []);
  const primer = createSession(tuesday.extraSession!, 1, '2026-10-06', DEFAULT_PROFILE, []);
  assert.notEqual(main.id, primer.id);
  assert.equal(main.exercises[0].mode, 'timed');
  assert.ok(primer.exercises.some((exercise: { measurement?: string }) => exercise.measurement === 'touch'));
  assert.equal(SessionSchema.safeParse(primer).success, true);
});

test('starting workouts creates independent logs and preparation without editing the training template', () => {
  const original = structuredClone(DEFAULT_PROFILE);
  const first = workout(6);
  const second = workout(6);
  first.exercises[0].logs[0].done = true;
  first.warmup![0].done = true;
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.exercises[0].logs[0].id, second.exercises[0].logs[0].id);
  assert.equal(second.exercises[0].logs[0].done, false);
  assert.equal(second.warmup![0].done, false);
  assert.equal(first.exercises[0].logs.length, original.plan[6].exercises[0].sets);
  assert.deepEqual(DEFAULT_PROFILE, original);
});

test('completed-set counts and weight volume ignore unfinished sets and non-weight entries', () => {
  const session = workout();
  Object.assign(session.exercises[0].logs[0], { kg: 10, reps: 4, done: true });
  Object.assign(session.exercises[0].logs[1], { kg: 100, reps: 10, done: false });
  Object.assign(session.exercises[1].logs[0], { kg: 40, reps: 8, done: true });
  assert.equal(completedSets(session), 2);
  assert.equal(estimatedCalories(session.exercises), 360);
  const timed = workout(1);
  Object.assign(timed.exercises[0].logs[0], { seconds: 600, done: true });
  assert.equal(completedSets(timed), 1);
  assert.equal(estimatedCalories(timed.exercises), 0);
});

test('workout and movement timers freeze on completion and do not keep accumulating after finish', () => {
  const session = workout();
  session.startedAt = 1000;
  session.runningSince = 1000;
  session.elapsedMs = 5000;
  session.exercises[0].elapsedMs = 3000;
  session.exercises[0].runningSince = 6000;
  const finished = stopSessionTimers(session, 'completed', 11_000);
  assert.equal(finished.elapsedMs, 15_000);
  assert.equal(finished.exercises[0].elapsedMs, 8000);
  assert.equal(finished.finishedAt, 11_000);
  assert.equal(finished.runningSince, null);
  assert.equal(finished.exercises[0].runningSince, null);
  assert.equal(sessionDuration(finished, 1_000_000), 15_000);
  assert.equal(formatDuration(finished.exercises[0], 1_000_000), 8000);
  assert.equal(SessionSchema.safeParse(finished).success, true);
  assert.equal(session.runningSince, 1000);
  assert.equal(session.exercises[0].runningSince, 6000);
});

test('timed movement duration includes completed logged time while excluding unfinished durations', () => {
  const session = workout(1);
  const exercise = session.exercises[0];
  Object.assign(exercise.logs[0], { seconds: 120, done: true });
  exercise.logs.push({ ...exercise.logs[0], id: crypto.randomUUID(), seconds: 900, done: false });
  exercise.elapsedMs = 30_000;
  exercise.runningSince = null;
  assert.equal(formatDuration(exercise, 1_000_000), 120_000);
  exercise.elapsedMs = 180_000;
  assert.equal(formatDuration(exercise, 1_000_000), 180_000);
});

test('calories follow body weight and active duration, then retain a watch override including zero', () => {
  const session = workout();
  Object.assign(session, { elapsedMs: 3_600_000, runningSince: null, bodyWeight: 80, met: 4 });
  assert.equal(getCalories(session), 252);
  Object.assign(session, { watchCalories: 420 });
  assert.equal(getCalories(session), 420);
  Object.assign(session, { watchCalories: 0 });
  assert.equal(getCalories(session), 0);
  session.watchCalories = null;
  session.met = 1;
  assert.equal(getCalories(session), 0);
});

test('top set and jump bests use completed attempts without mutating the original log ordering', () => {
  const exercise = workout(6).exercises[0];
  const log = exercise.logs[0];
  exercise.logs = [
    { ...log, id: 'first', kg: 40, reps: 8, measurementCm: 260, done: true },
    { ...log, id: 'pending', kg: 100, reps: 10, measurementCm: 300, done: false },
    { ...log, id: 'heavy', kg: 50, reps: 5, measurementCm: 268, done: true },
    { ...log, id: 'best', kg: 50, reps: 7, measurementCm: 265, done: true },
  ];
  const original = structuredClone(exercise.logs);
  assert.equal(topSet(exercise)?.id, 'best');
  assert.equal(bestMeasurement(exercise), 268);
  assert.equal(measurementLabel(exercise), 'Highest touch · cm');
  assert.deepEqual(exercise.logs, original);
  assert.equal(bestMeasurement(undefined), null);
});

test('previous exercise uses the latest completed matching history and excludes future or deleted workouts', () => {
  function history(date: string, startedAt: number, status = 'completed', done = true) {
    const session = workout(0, date);
    session.startedAt = startedAt;
    session.status = status;
    Object.assign(session.exercises[0].logs[0], { kg: 12, reps: 4, done });
    return session;
  }
  const earlier = history('2026-10-05', 1000);
  const latest = history('2026-10-06', 2000);
  const sameDayLater = history('2026-10-06', 3000);
  const incomplete = history('2026-10-06', 4000, 'completed', false);
  const deleted = history('2026-10-06', 5000, 'deleted');
  const future = history('2026-10-09', 6000);
  const active = history('2026-10-06', 7000, 'active');
  const sessions = [earlier, latest, sameDayLater, incomplete, deleted, future, active];
  const originalOrder = sessions.map((session) => session.id);
  assert.equal(previousExercise(sessions, 'spike-slam', '2026-10-07')?.session.id, sameDayLater.id);
  assert.equal(previousExercise(sessions, 'spike-slam', '2026-10-07', sameDayLater.id)?.session.id, latest.id);
  assert.equal(previousExercise(sessions, 'does-not-exist', '2026-10-07'), null);
  assert.deepEqual(sessions.map((session) => session.id), originalOrder);
});

test('new workouts prefill completed history but clear completion and effort for the current attempt', () => {
  const past = workout(0, '2026-10-05');
  Object.assign(past.exercises[0].logs[0], { kg: 8, reps: 4, rir: 1, done: true });
  Object.assign(past.exercises[0].logs[1], { kg: 10, reps: 4, rir: 2, done: true });
  const completed = stopSessionTimers(past, 'completed', past.startedAt + 60_000);
  const next = createSession(DEFAULT_PROFILE.plan[0], 0, '2026-10-07', DEFAULT_PROFILE, [completed]);
  assert.deepEqual(next.exercises[0].logs.slice(0, 2).map(({ kg, reps, rir, done }: { kg: number | null; reps: number | null; rir: number | null; done: boolean }) => ({ kg, reps, rir, done })), [
    { kg: 8, reps: 4, rir: null, done: false },
    { kg: 10, reps: 4, rir: null, done: false },
  ]);
  assert.equal(next.exercises[0].logs[2].kg, null);
  assert.equal(SessionSchema.safeParse(next).success, true);
});

test('workout validation enforces weight, reps, durations and RIR bounds before a completed set can save', () => {
  const valid = workout();
  Object.assign(valid.exercises[0].logs[0], { kg: 0, reps: 4, rir: 2, done: true });
  assert.equal(SessionSchema.safeParse(valid).success, true);
  for (const change of [{ kg: null }, { kg: -1 }, { reps: 0 }, { reps: 1.5 }, { rir: -1 }, { rir: 11 }, { kg: Infinity }]) {
    const invalid = structuredClone(valid);
    Object.assign(invalid.exercises[0].logs[0], change);
    assert.equal(SessionSchema.safeParse(invalid).success, false, JSON.stringify(change));
  }
  const timed = workout(1);
  Object.assign(timed.exercises[0].logs[0], { seconds: 120, done: true });
  assert.equal(SessionSchema.safeParse(timed).success, true);
  for (const seconds of [null, 0, -1, 86_401, Infinity]) {
    const invalid = structuredClone(timed);
    invalid.exercises[0].logs[0].seconds = seconds;
    assert.equal(SessionSchema.safeParse(invalid).success, false);
  }
});

test('finished and deleted workouts require stopped timers and corresponding timestamps', () => {
  const active = workout();
  const completed = stopSessionTimers(active, 'completed', active.startedAt + 60_000);
  assert.equal(SessionSchema.safeParse(completed).success, true);
  assert.equal(SessionSchema.safeParse({ ...completed, finishedAt: null }).success, false);
  assert.equal(SessionSchema.safeParse({ ...completed, runningSince: active.startedAt }).success, false);
  const runningMovement = structuredClone(completed);
  runningMovement.exercises[0].runningSince = active.startedAt;
  assert.equal(SessionSchema.safeParse(runningMovement).success, false);
  assert.equal(SessionSchema.safeParse({ ...completed, status: 'deleted' }).success, false);
  assert.equal(SessionSchema.safeParse({ ...completed, status: 'deleted', deletedAt: completed.finishedAt }).success, true);
  const cancelled = stopSessionTimers(active, 'cancelled', active.startedAt + 60_000);
  assert.equal(SessionSchema.safeParse(cancelled).success, true);
  assert.equal(cancelled.runningSince, null);
});

test('nutrition totals combine manually entered foods and nullable targets remain valid', () => {
  const foods = [
    { calories: 300, protein: 25, carbs: 30, fat: 9 },
    { calories: 150, protein: 5, carbs: 25, fat: 3 },
  ];
  assert.deepEqual(sumNutrients(foods), { calories: 450, protein: 30, carbs: 55, fat: 12 });
  assert.deepEqual(sumNutrients([]), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  assert.equal(NutritionPayloadSchema.safeParse({
    kind: 'targets', calories: null, protein: 120, carbs: null, fat: null, goalWeight: null,
  }).success, true);
});

test('weekly navigation stays Monday based across month and year boundaries without changing its input', () => {
  const sunday = new Date(2027, 0, 3, 9, 30);
  const originalTime = sunday.getTime();
  const start = startOfWeek(sunday);
  assert.equal(dateKey(start), '2026-12-28');
  assert.equal(dateKey(addDays(start, 6)), '2027-01-03');
  assert.equal(dateKey(addDays(start, 7)), '2027-01-04');
  assert.equal(sunday.getTime(), originalTime);
  assert.equal(dateKey(start), '2026-12-28');
});
