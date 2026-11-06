import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { areComparableExercises } from '../src/exercise-identity.ts';
import { getProgressionRecommendation, isOneRepMaxExercise } from '../src/performance-insights.ts';
import type { ReadinessEntry } from '../src/performance-data.ts';
import { getV9ReadinessAdvice } from '../src/v9-readiness.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';

const SATURDAY = '2026-11-07';
function readiness(date: string, patch: Partial<ReadinessEntry> = {}): ReadinessEntry {
  return { id: crypto.randomUUID(), date, energy: 'normal', soreness: 'low', ...patch };
}

test('missing Friday sleep/activity reports stay unknown and never establish Green readiness', () => {
  const result = getV9ReadinessAdvice(SATURDAY, []);
  assert.equal(result.title, 'Check readiness after Friday');
  assert.equal(result.suggested, undefined);
  assert.equal(result.sourceDate, undefined);
  assert.match(result.detail, /Unrecorded Friday activity or sleep is unknown/);
  assert.match(result.detail, /not proof of recovery/);
  const onlyExposure = getV9ReadinessAdvice(SATURDAY, [], [{ date: '2026-11-06',
    trainingExposure: { sport: 'volleyball', sessionRpe: 8, hardJumpContacts: 20, contactSource: 'estimate' } }]);
  assert.equal(onlyExposure.suggested, undefined, 'logged workload is not a physiological recovery measurement');
});

test('actual preceding-Friday soreness or low energy supports a labeled Yellow recommendation', () => {
  for (const patch of [{ soreness: 'high' as const }, { energy: 'low' as const }, { joints: { achilles: 'sore' as const } }]) {
    const reports = [readiness('2026-11-06', patch)], before = structuredClone(reports);
    const result = getV9ReadinessAdvice(SATURDAY, reports);
    assert.equal(result.suggested, 'yellow');
    assert.equal(result.sourceDate, '2026-11-06');
    assert.match(result.detail, /Your 2026-11-06 report/);
    assert.match(result.detail, /omit demanding acceleration or jumps/);
    assert.match(result.detail, /Missing sleep and match details remain unknown/);
    assert.deepEqual(reports, before);
  }
});

test('reported current pain takes priority over older soreness without changing medical guidance', () => {
  const reports = [readiness('2026-11-06', { soreness: 'high' }),
    readiness(SATURDAY, { joints: { knee: 'comfortable', achilles: 'pain', shoulder: 'sore' } })];
  const before = structuredClone(reports), result = getV9ReadinessAdvice(SATURDAY, reports);
  assert.equal(result.suggested, 'red');
  assert.equal(result.sourceDate, SATURDAY);
  assert.match(result.detail, /achilles/);
  assert.match(result.detail, /Stop relevant impact or painful loading/);
  assert.match(result.detail, /not a medical assessment/);
  assert.deepEqual(reports, before);
});

test('unrelated old reports do not become a current readiness score and comfortable reports do not auto-select Green', () => {
  const old = getV9ReadinessAdvice(SATURDAY, [readiness('2026-10-30', { joints: { knee: 'pain' } }), readiness('2026-11-05', { energy: 'low' })]);
  assert.equal(old.suggested, undefined);
  assert.equal(old.sourceDate, undefined);
  const current = getV9ReadinessAdvice(SATURDAY, [readiness(SATURDAY, { energy: 'high', joints: { knee: 'comfortable', achilles: 'comfortable', shoulder: 'comfortable' } })]);
  assert.equal(current.suggested, undefined);
  assert.match(current.detail, /before choosing Green/);
  const weekday = getV9ReadinessAdvice('2026-11-09', [readiness('2026-11-08', { soreness: 'high' })]);
  assert.equal(weekday.suggested, undefined, 'previous-day context is intentionally special to the Friday/Saturday schedule');
});

test('a high actual sport/PE soreness report affects Saturday but an unrelated date does not', () => {
  const exposures = [{ date: '2026-11-06', trainingExposure: { sport: 'pe' as const, kneeSoreness: 'high' as const } }];
  const before = structuredClone(exposures), result = getV9ReadinessAdvice(SATURDAY, [], exposures);
  assert.equal(result.suggested, 'yellow');
  assert.equal(result.sourceDate, '2026-11-06');
  assert.deepEqual(exposures, before);
  assert.equal(getV9ReadinessAdvice(SATURDAY, [], [{ ...exposures[0], date: '2026-11-05' }]).suggested, undefined);
});

test('V9 sprint sessions seed only planned metres, never completed efforts or invented historical times', () => {
  const day = createV9VolleyballMasterPlan()[2];
  const historical = SessionSchema.parse(stopSessionTimers(createSession(day, 2, '2026-10-28', DEFAULT_PROFILE, []), 'completed'));
  historical.exercises.filter(exercise => exercise.prescribedDistanceM != null).forEach(exercise => {
    exercise.logs.forEach(log => Object.assign(log, { done: true, reps: exercise.prescribedDistanceM, seconds: exercise.prescribedDistanceM === 5 ? 1.25 : 1.9 }));
  });
  const before = structuredClone(historical);
  const created = SessionSchema.parse(createSession(day, 2, '2026-11-04', DEFAULT_PROFILE, [historical]));
  const sprints = created.exercises.filter(exercise => exercise.prescribedDistanceM != null);
  assert.deepEqual(sprints.map(exercise => [exercise.prescribedDistanceM, exercise.logs.length]), [[5, 2], [10, 2]]);
  for (const exercise of sprints) for (const log of exercise.logs) {
    assert.equal(exercise.quantityUnit, 'm');
    assert.equal(exercise.mode, 'bodyweight');
    assert.equal(log.reps, exercise.prescribedDistanceM);
    assert.equal(log.seconds, null);
    assert.equal(log.kg, null);
    assert.equal(log.rir, null);
    assert.equal(log.done, false);
    assert.deepEqual(log.inputSources, { reps: 'planned' });
  }
  assert.equal(created.programRevision, '9');
  assert.equal(created.programSessionId, day.programSessionId);
  assert.deepEqual(historical, before);
});

test('V9 suitcase holds use seconds and optional external load, never convert a 30-second target into 30 reps', () => {
  const day = createV9VolleyballMasterPlan()[2];
  const created = SessionSchema.parse(createSession(day, 2, '2026-11-04', DEFAULT_PROFILE, []));
  const hold = created.exercises.find(exercise => exercise.exerciseId === 'suitcase-static-hold')!;
  assert.equal(hold.mode, 'timed');
  assert.equal(hold.perSide, true);
  assert.equal(hold.quantityUnit, undefined);
  assert.equal(hold.target, '30 sec');
  assert.equal(hold.logs.length, 2);
  assert.ok(hold.logs.every(log => log.reps === null && log.seconds === null && log.kg === null && !log.done));
  const history = SessionSchema.parse(stopSessionTimers(created, 'completed'));
  history.exercises.find(exercise => exercise.key === hold.key)!.logs.forEach(log => Object.assign(log, { kg: 17.5, seconds: 30, reps: null, done: true }));
  history.date = '2026-10-28';
  const next = SessionSchema.parse(createSession(day, 2, '2026-11-04', DEFAULT_PROFILE, [history]));
  assert.ok(next.exercises.find(exercise => exercise.key === hold.key)!.logs.every(log => log.kg === 17.5 && log.seconds === 30 && log.reps === null && !log.done));
});

test('known canonical IDs and narrow factory spellings reuse history without merging custom names or incompatible configuration', () => {
  const rdl = { key: 'old-rdl', name: 'Romanian Deadlift', exerciseId: 'rdl', mode: 'weight' };
  const canonical = { ...rdl, key: 'new-rdl', exerciseId: 'romanian-deadlift' };
  assert.equal(areComparableExercises(rdl, canonical), true);
  const ball = { key: 'old-ball', name: 'Medicine-Ball Spike Slam', exerciseId: 'spike-slam', mode: 'weight' };
  assert.equal(areComparableExercises(ball, { ...ball, key: 'new-ball', name: 'Medicine Ball Spike Slam' }), true);
  assert.equal(areComparableExercises(ball, { ...ball, name: 'My one-arm spike experiment' }), false);
  assert.equal(areComparableExercises(canonical, { ...canonical, name: 'Paused Romanian Deadlift' }), false);
  assert.equal(areComparableExercises(canonical, { ...canonical, equipmentLabel: 'My other bar' }), false);
  assert.equal(areComparableExercises(canonical, { ...canonical, mode: 'timed' }), false);
  const sprint = { key: 'sprint', name: 'Acceleration', exerciseId: 'acceleration-sprint', mode: 'bodyweight', quantityUnit: 'm', prescribedDistanceM: 5 };
  assert.equal(areComparableExercises(sprint, { ...sprint, prescribedDistanceM: 10 }), false);
  const press = { key: 'press', name: 'Incline Chest Press', exerciseId: 'incline-machine-press', mode: 'weight' };
  assert.equal(areComparableExercises(press, { ...press, name: 'Incline Machine Press' }), true);
  assert.equal(areComparableExercises(press, { ...press, name: 'Low-Incline Machine Press' }), false);
});

test('sprint progression remains a quality cue and never treats distance as carry reps or an estimated 1RM', () => {
  const plan = createV9VolleyballMasterPlan()[2];
  for (const sprint of plan.exercises.filter(exercise => exercise.prescribedDistanceM != null)) {
    const before = structuredClone(sprint), recommendation = getProgressionRecommendation(sprint, [], '2026-11-04');
    assert.equal(recommendation.kind, 'quality');
    assert.equal(recommendation.title, 'Acceleration quality');
    assert.equal(recommendation.kg, undefined);
    assert.equal(recommendation.reps, undefined);
    assert.match(recommendation.reason, /not a measured sprint result/);
    assert.match(recommendation.reason, /distance, timing method and protocol/);
    assert.equal(isOneRepMaxExercise(sprint), false);
    assert.deepEqual(sprint, before);
  }
});

function hackSession(date: string) {
  const day = createV9VolleyballMasterPlan()[2];
  const started = SessionSchema.parse(createSession(day, 2, date, DEFAULT_PROFILE, []));
  started.runningSince = null;
  started.exercises = started.exercises.filter(exercise => exercise.exerciseId === 'hack-squat');
  started.exercises[0].logs.forEach(log => Object.assign(log, { kg: 70, reps: 6, rir: 2, done: true }));
  return SessionSchema.parse(stopSessionTimers(started, 'completed'));
}

test('V9 strength load progression requires all three prescribed working sets at the top and RIR target', () => {
  const exercise = createV9VolleyballMasterPlan()[2].exercises.find(exercise => exercise.exerciseId === 'hack-squat')!;
  const history = [hackSession('2026-10-21'), hackSession('2026-10-28')];
  const before = structuredClone(history), recommendation = getProgressionRecommendation(exercise, history, '2026-11-04', { loadIncrementKg: 2.5 });
  assert.equal(exercise.sets, 3);
  assert.equal(recommendation.kind, 'load');
  assert.equal(recommendation.kg, 72.5);
  assert.equal(recommendation.reps, 4);
  assert.deepEqual(history, before);
  for (const mutation of [
    (logs: typeof history[1]['exercises'][0]['logs']) => { logs.at(-1)!.done = false; },
    (logs: typeof history[1]['exercises'][0]['logs']) => { logs.at(-1)!.reps = 5; },
    (logs: typeof history[1]['exercises'][0]['logs']) => { logs.at(-1)!.rir = 1; },
    (logs: typeof history[1]['exercises'][0]['logs']) => { logs.at(-1)!.rir = null; },
    (logs: typeof history[1]['exercises'][0]['logs']) => { logs.pop(); },
  ]) {
    const changed = structuredClone(history);
    mutation(changed[1].exercises[0].logs);
    assert.notEqual(getProgressionRecommendation(exercise, changed, '2026-11-04', { loadIncrementKg: 2.5 }).kind, 'load');
  }
  assert.notEqual(getProgressionRecommendation(exercise, history, '2026-11-04', { loadIncrementKg: 10 }).kind, 'load', 'an impractical large increment is held rather than automatically applied');
});
