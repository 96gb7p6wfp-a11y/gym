import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ProfileSchema } from '../src/domain.js';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { withPreWorkoutReadiness, preWorkoutReadinessStatus, preWorkoutRecovery, reduceUnprogrammedWorkout } from '../src/pre-workout.ts';

function profile(revision: '9' | '13.1' = '9') {
  return ProfileSchema.parse({ ...structuredClone(DEFAULT_PROFILE), plan: createV9VolleyballMasterPlan(),
    masterProgram: { version: 1, revision, startDate: '2026-11-02', matchWeeks: [],
      clearance: { impact: 'restricted', heavyLifting: 'unknown' },
      dailyReadiness: [{ date: '2026-11-06', feeling: 'poor' }], readiness: [{ date: '2026-11-06', status: 'red' }] },
  });
}

test('pre-workout answers are pure date-specific proposals that preserve guidance, history-compatible fields and the weekly dose', () => {
  const original = profile();
  const before = structuredClone(original);
  const proposed = withPreWorkoutReadiness(original, '2026-11-07', 'normal');
  assert.deepEqual(original, before);
  assert.deepEqual(proposed.plan, original.plan);
  assert.deepEqual(proposed.masterProgram!.clearance, original.masterProgram!.clearance);
  assert.deepEqual(proposed.masterProgram!.dailyReadiness, [
    { date: '2026-11-06', feeling: 'poor' }, { date: '2026-11-07', feeling: 'normal' },
  ]);
  assert.deepEqual(proposed.masterProgram!.readiness, original.masterProgram!.readiness);
  assert.equal(withPreWorkoutReadiness(proposed, '2026-11-07', 'normal'), proposed);
});

test('legacy program answers retain other dates, map explicitly and never change an inactive future program', () => {
  const original = profile('13.1');
  const proposed = withPreWorkoutReadiness(original, '2026-11-07', 'tired');
  assert.deepEqual(proposed.masterProgram!.readiness, [
    { date: '2026-11-06', status: 'red' }, { date: '2026-11-07', status: 'yellow' },
  ]);
  assert.deepEqual(proposed.masterProgram!.dailyReadiness, original.masterProgram!.dailyReadiness);
  assert.equal(preWorkoutReadinessStatus('normal'), 'green');
  assert.equal(preWorkoutReadinessStatus('poor'), 'red');
  assert.equal(withPreWorkoutReadiness(original, '2026-11-01', 'normal'), original);
  const plain = { ...DEFAULT_PROFILE, masterProgram: undefined };
  assert.equal(withPreWorkoutReadiness(plain, '2026-11-07', 'normal'), plain);
  assert.throws(() => withPreWorkoutReadiness(original, '2026-02-30', 'normal'));
});

test('unwell preflight offers recovery for an upper-only legacy workout instead of retaining hard upper loading', () => {
  const base = structuredClone(DEFAULT_PROFILE.plan[0]);
  const before = structuredClone(base);
  const recovery = preWorkoutRecovery(base);
  assert.equal(recovery.kind, 'recovery');
  assert.deepEqual(recovery.exercises, []);
  assert.deepEqual(recovery.warmup, []);
  assert.match(recovery.note, /full rest/);
  assert.deepEqual(base, before);
  assert.equal(preWorkoutRecovery(recovery), recovery);
});

test('a generic lighter session removes explosive work, reduces longer weighted work and keeps original identifiers and manual planned loads', () => {
  const base = createV9VolleyballMasterPlan()[5];
  const before = structuredClone(base);
  base.exercises.find(exercise => exercise.name === 'Leg Press')!.defaultKg = 72.5;
  const modified = reduceUnprogrammedWorkout(base);
  assert.equal(modified.kind, 'strength');
  assert.equal(modified.exercises.some(exercise => /Acceleration|Split-Squat Jump/.test(exercise.name)), false);
  const legPress = modified.exercises.find(exercise => exercise.name === 'Leg Press')!;
  assert.equal(legPress.key, before.exercises.find(exercise => exercise.name === 'Leg Press')!.key);
  assert.equal(legPress.sets, 2);
  assert.equal(legPress.defaultKg, 72.5);
  assert.equal(base.exercises.find(exercise => exercise.name === 'Leg Press')!.sets, 3);
  assert.notEqual(modified.durationRange, base.durationRange);
});
