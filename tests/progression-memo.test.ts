import assert from 'node:assert/strict';
import test from 'node:test';
import { progressionConfigurationKey, progressionContextKey } from '../src/useExerciseProgression.ts';
import type { ProgressionExercise } from '../src/performance-insights.ts';

const exercise: ProgressionExercise = { key: 'bench', exerciseId: 'barbell-bench-press', name: 'Barbell Bench Press',
  group: 'Upper strength', mode: 'weight', target: '6–8', sets: 3, targetRir: 2, loadIncrementKg: 2.5 };

test('editing current set values does not invalidate historical progression configuration', () => {
  const current = { ...exercise, logs: [{ id: 'set-1', kg: 60, reps: 8, rir: 2, done: false }], elapsedMs: 0 };
  const before = structuredClone(current);
  const key = progressionConfigurationKey(current);
  const edited = { ...current, elapsedMs: 10_000,
    logs: [{ id: 'set-1', kg: 62.5, reps: 7, rir: 1, done: true }] };
  assert.equal(progressionConfigurationKey(edited), key);
  assert.deepEqual(current, before, 'creating the dependency key never rewrites current inputs');
  assert.equal(progressionConfigurationKey(undefined), '');
});

test('changed prescriptions, movement identity, equipment and load increments invalidate progression', () => {
  const key = progressionConfigurationKey(exercise);
  for (const changes of [
    { key: 'alternate' }, { exerciseId: 'another-exercise' }, { name: 'Incline Bench Press' },
    { group: 'Power' }, { target: '8–10' }, { mode: 'timed' as const }, { measurement: 'touch' as const },
    { quantityUnit: 'm' as const }, { targetRpe: 8 }, { targetRir: 3 }, { perSide: true },
    { equipmentLabel: 'Smith machine' }, { preparationOnly: true }, { sets: 2 },
    { prescribedDistanceM: 10 }, { loadIncrementKg: 1 },
  ]) assert.notEqual(progressionConfigurationKey({ ...exercise, ...changes }), key, JSON.stringify(changes));
});

test('equivalent readiness objects reuse a key, while meaningful context changes invalidate it', () => {
  const context = { loadIncrementKg: 2.5, readiness: { energy: 'normal' as const, soreness: 'low' as const } };
  const key = progressionContextKey(context);
  assert.equal(progressionContextKey({ ...context, readiness: { ...context.readiness } }), key);
  for (const change of [
    { loadIncrementKg: 1 }, { lowFatigueSession: true }, { volleyballWithin24Hours: true },
    { readinessLevel: 'tired' as const }, { readiness: { energy: 'low' as const, soreness: 'low' as const } },
    { readiness: { energy: 'normal' as const, soreness: 'high' as const } },
  ]) assert.notEqual(progressionContextKey({ ...context, ...change }), key);
});
