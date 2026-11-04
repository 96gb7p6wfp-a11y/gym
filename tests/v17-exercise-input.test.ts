import assert from 'node:assert/strict';
import test from 'node:test';
import { exerciseInputKind, hasRecordedLoad, measurementInputLabel } from '../src/exercise-input.ts';
import { findLibraryExercise } from '../src/exercise-library.ts';

test('saved logging metadata, rather than an exercise name, determines the editable quantity', () => {
  const deliberatelyConfigured = { name: 'Dead Bug', mode: 'weight' as const, target: '8 reps' };
  const before = structuredClone(deliberatelyConfigured);
  assert.equal(exerciseInputKind(deliberatelyConfigured), 'weight');
  assert.equal(exerciseInputKind({ mode: 'bodyweight' }), 'bodyweight');
  assert.equal(exerciseInputKind({ mode: 'timed', measurement: 'height' }), 'duration');
  assert.equal(exerciseInputKind({ mode: 'bodyweight', measurement: 'touch' }), 'measurement');
  assert.deepEqual(deliberatelyConfigured, before);
});

test('real catalogue entries retain their existing strength, bodyweight, hold and jump logging types', () => {
  for (const [name, kind] of [
    ['Dead Bug', 'bodyweight'], ['Push-up', 'bodyweight'], ['Plank', 'duration'],
    ['Bent-Knee Calf Isometric', 'duration'], ['Split-Squat Isometric', 'duration'],
    ['Medicine Ball Spike Slam', 'weight'], ['Suitcase Carry', 'weight'],
    ['Approach Jump', 'measurement'], ['Countermovement Jump', 'measurement'],
  ]) {
    const exercise = findLibraryExercise(name);
    assert.ok(exercise, name);
    const before = structuredClone(exercise);
    assert.equal(exerciseInputKind(exercise), kind, name);
    assert.deepEqual(exercise, before);
  }
});

test('additional load detection preserves unknown, explicit zero and positive recorded values without mutation', () => {
  const unloaded = [{ kg: null }, { kg: 0 }];
  const loaded = [...unloaded, { kg: 12.5 }];
  const before = structuredClone(loaded);
  assert.equal(hasRecordedLoad(unloaded), false);
  assert.equal(hasRecordedLoad(loaded), true);
  assert.equal(hasRecordedLoad([{ kg: Number.NaN }, { kg: Number.POSITIVE_INFINITY }, { kg: -1 }]), false);
  assert.deepEqual(loaded, before);
});

test('measurement labels distinguish touch from jump height and distance without inferring an unsupported metric', () => {
  assert.equal(measurementInputLabel({ measurement: 'touch' }), 'Maximum touch');
  assert.equal(measurementInputLabel({ measurement: 'height' }), 'Jump height');
  assert.equal(measurementInputLabel({ measurement: 'distance' }), 'Distance');
  assert.equal(measurementInputLabel({}), 'Measurement');
});
