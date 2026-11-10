import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { EXERCISE_CATALOGUE, findLibraryExercise, searchExercises, toPlanExercise } from '../src/exercise-library.ts';
import { getExerciseGuide } from '../src/exercise-guides.ts';
import { areComparableExercises } from '../src/exercise-identity.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';

test('the complete catalogue has specific structured instructions while custom names remain honest fallbacks', () => {
  for (const exercise of EXERCISE_CATALOGUE) {
    const guide = getExerciseGuide(exercise);
    assert.equal(guide.isGeneric, false, exercise.id);
    for (const [field, value] of Object.entries(guide.instructions)) assert.ok(value.trim().length > (field === 'equipment' ? 0 : 10), `${exercise.id}: ${field}`);
    if (guide.isAmbiguous) assert.equal(guide.demonstration.kind, 'unavailable');
    else assert.equal(guide.demonstration.kind, 'search');
  }
  const custom = getExerciseGuide({ key: 'drop-jump', exerciseId: 'drop-jump', name: 'My unrelated custom movement' });
  assert.equal(custom.isGeneric, true);
  assert.equal(custom.diagram, undefined);
});

test('slam, forward throw and backward throw are distinct identities with distinct release directions', () => {
  const slam = findLibraryExercise('Two-Hand Medicine Ball Overhead Slam')!;
  const forward = findLibraryExercise('Medicine Ball Overhead Forward Throw')!;
  const backward = findLibraryExercise('Medicine Ball Overhead Backward Throw')!;
  assert.equal(slam.id, 'spike-slam');
  assert.equal(new Set([slam.id, forward.id, backward.id]).size, 3);
  const guides = [slam, forward, backward].map(getExerciseGuide);
  assert.match(guides[0].instructions.movement, /down in front/i);
  assert.match(guides[0].instructions.equipment, /floor slams|slams.*floor/i);
  assert.match(guides[1].instructions.movement, /forwards.*target/i);
  assert.match(guides[2].instructions.movement, /backwards.*clear/i);
  assert.equal(guides[0].diagram, 'overhead-slam');
  assert.equal(guides[1].diagram, 'forward-throw');
  for (const guide of guides) {
    const query = new URL(guide.demonstration.url).searchParams.get('search_query');
    assert.ok(query?.includes('exercise technique'));
    assert.equal(guide.demonstration.kind, 'search');
  }
  assert.equal(getExerciseGuide({ name: 'Medicine Ball Overhead Throw / Slam' }).demonstration.kind, 'unavailable');
  assert.ok(!searchExercises().some(exercise => exercise.legacyChoice));
});

test('V9 medicine-ball prescription teaches the exact downward movement without changing its dose or saved name', () => {
  const exercise = createV9VolleyballMasterPlan()[0].exercises[0];
  const before = structuredClone(exercise);
  const guide = getExerciseGuide(exercise);
  assert.equal(guide.displayName, 'Two-Hand Medicine Ball Overhead Slam');
  assert.match(guide.instructions.movement, /down in front/i);
  assert.equal(exercise.sets, 4);
  assert.equal(exercise.target, '3 reps');
  assert.deepEqual(exercise, before);
});

test('the documented slam display-name correction reuses historical values without rewriting old workout IDs or names', () => {
  const oldExercise = { ...toPlanExercise(findLibraryExercise('spike-slam')!), key: 'old-stable-slam', name: 'Medicine Ball Spike Slam', defaultKg: 2 };
  const oldPlan = { ...DEFAULT_PROFILE.plan[0], exercises: [oldExercise] };
  const previous = SessionSchema.parse(stopSessionTimers(createSession(oldPlan, 0, '2026-11-02', DEFAULT_PROFILE, []), 'completed'));
  Object.assign(previous.exercises[0].logs[0], { done: true, kg: 2.5, reps: 3 });
  const before = structuredClone(previous);
  const nextExercise = toPlanExercise(findLibraryExercise('Two-Hand Medicine Ball Overhead Slam')!);
  assert.equal(areComparableExercises(previous.exercises[0], nextExercise), true);
  const next = createSession({ ...oldPlan, exercises: [nextExercise] }, 0, '2026-11-09', DEFAULT_PROFILE, [previous]);
  assert.equal(next.exercises[0].logs[0].kg, 2.5);
  assert.equal(next.exercises[0].logs[0].done, false);
  assert.deepEqual(previous, before);
  assert.equal(areComparableExercises(previous.exercises[0], toPlanExercise(findLibraryExercise('Medicine Ball Overhead Forward Throw')!)), false);
});

test('drop jumps, split squats and landmine variations explain the actual setup and never merge incompatible identities', () => {
  const drop = getExerciseGuide({ name: 'Low Drop Jump, 15–20 cm' });
  assert.match(drop.instructions.movement, /step off without jumping upward/i);
  assert.match(drop.instructions.movement, /rebound vertically/i);
  const split = getExerciseGuide({ name: 'Bulgarian Split Squat' });
  assert.match(split.instructions.setup, /rear foot.*stable low support/i);
  assert.match(split.instructions.movement, /front leg/i);
  const standing = findLibraryExercise('Landmine Press')!;
  const kneeling = findLibraryExercise('Half-Kneeling Landmine Press')!;
  assert.notEqual(standing.id, kneeling.id);
  assert.match(getExerciseGuide(kneeling).instructions.setup, /kneel.*knee/i);
  assert.match(getExerciseGuide(standing).instructions.setup, /stand balanced/i);
  assert.equal(findLibraryExercise('Rope Triceps Pushdown')!.id, 'triceps', 'existing lookup identity remains stable');
  assert.equal(findLibraryExercise('Rope Triceps Extension')!.id, 'rope-triceps-extension');
});
