import assert from 'node:assert/strict';
import test from 'node:test';
import { lastSetSuggestion, missingSetValuesFromLast } from '../src/set-autofill.ts';

test('same-session carry forward fills only missing values from the last completed set', () => {
  const exercise = {
    mode: 'weight' as const,
    logs: [
      { id: 'one', kg: 72.5, reps: 7, done: true },
      { id: 'two', kg: null, reps: null, done: false },
      { id: 'three', kg: 80, reps: null, done: false },
    ],
  };
  const before = structuredClone(exercise);
  assert.deepEqual(lastSetSuggestion(exercise, 'two'), { kg: 72.5, reps: 7 });
  assert.deepEqual(missingSetValuesFromLast(exercise, 'two'), { kg: 72.5, reps: 7 });
  assert.deepEqual(missingSetValuesFromLast(exercise, 'three'), { reps: 7 });
  assert.deepEqual(exercise, before, 'prefill is a suggestion, never a mutation');
  assert.equal(missingSetValuesFromLast(exercise, 'one'), null);
});

test('carry forward respects intentional zero, requires completed earlier set, and skips timers', () => {
  const exercise = {
    mode: 'weight' as const,
    logs: [{ id: 'one', kg: 35, reps: 8, done: true }, { id: 'two', kg: 0, reps: 10, done: false }],
  };
  assert.equal(missingSetValuesFromLast(exercise, 'two'), null, 'zero and planned reps are not overwritten');
  assert.deepEqual(lastSetSuggestion(exercise, 'two'), { kg: 35, reps: 8 }, 'manual copy is still available');
  assert.equal(lastSetSuggestion({ ...exercise, mode: 'timed' }, 'two'), null);
  assert.equal(lastSetSuggestion({ ...exercise, measurement: 'height' as const }, 'two'), null);
  assert.equal(lastSetSuggestion({ ...exercise, logs: [{ ...exercise.logs[0], done: false }, exercise.logs[1]] }, 'two'), null);
  assert.equal(lastSetSuggestion({ ...exercise, logs: [{ ...exercise.logs[0], kg: Number.NaN }, exercise.logs[1]] }, 'two'), null);
  assert.equal(lastSetSuggestion({ ...exercise, logs: [{ ...exercise.logs[0], reps: -2 }, exercise.logs[1]] }, 'two'), null);
});
