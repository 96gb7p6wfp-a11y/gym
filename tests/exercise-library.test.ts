import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ExerciseSchema } from '../src/domain.js';
import { EXERCISE_CATALOGUE, EXERCISE_CATEGORIES, findLibraryExercise, rankAlternatives, searchExercises, toPlanExercise } from '../src/exercise-library.ts';

test('catalogue covers the full recommended plan and preparation without changing original keys', () => {
  const plan = DEFAULT_PROFILE.plan.flatMap(day => [day, day.extraSession].filter(Boolean).flatMap(item =>
    [...(item!.exercises ?? []), ...(item!.warmup ?? []), ...(item!.cooldown ?? [])]));
  for (const exercise of plan) {
    const item = findLibraryExercise(exercise);
    assert.ok(item, `Missing ${exercise.name}`);
    if ('mode' in exercise) assert.equal(item.id, exercise.key, `${exercise.name} must retain its historical identity`);
  }
});

test('catalogue covers common movement families with useful complete metadata', () => {
  assert.ok(EXERCISE_CATALOGUE.length >= 100);
  assert.equal(new Set(EXERCISE_CATALOGUE.map(item => item.id)).size, EXERCISE_CATALOGUE.length);
  for (const category of EXERCISE_CATEGORIES) assert.ok(EXERCISE_CATALOGUE.some(item => item.category === category), category);
  for (const muscle of ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Hip flexors', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Core']) {
    assert.ok(EXERCISE_CATALOGUE.some(item => item.muscles.includes(muscle)), muscle);
  }
  for (const item of EXERCISE_CATALOGUE) {
    assert.ok(item.primaryBenefit.length > 10, item.name);
    assert.ok(item.secondaryBenefit.length > 10, item.name);
    assert.ok(item.equipment.length && item.muscles.length && item.goals.length);
    assert.equal(item.cues.length, 2);
    assert.equal(item.mistakes.length, 2);
    for (const id of item.substitutions) {
      assert.ok(EXERCISE_CATALOGUE.some(candidate => candidate.id === id), `Unknown substitute ${id} for ${item.name}`);
      assert.notEqual(id, item.id);
    }
    assert.ok(ExerciseSchema.safeParse(toPlanExercise(item)).success, `${item.name} must insert as a valid workout exercise`);
  }
});

test('every insertion receives its own key while retaining canonical movement identity', () => {
  const item = findLibraryExercise('Romanian Deadlift')!;
  const first = toPlanExercise(item);
  const second = toPlanExercise(item);
  assert.notEqual(first.key, second.key);
  assert.equal(first.exerciseId, 'rdl');
  assert.equal(second.exerciseId, 'rdl');
  assert.equal(first.name, item.name);
  assert.equal(first.rest, item.rest);
  assert.equal(item.id, 'rdl');
});

test('current names take precedence over retained keys and custom renames do not inherit old advice', () => {
  assert.equal(findLibraryExercise({ key: 'rdl', name: 'Biceps Curl' })?.id, 'biceps-curl');
  assert.equal(findLibraryExercise({ key: 'rdl', name: 'My new custom movement' }), undefined);
  assert.equal(findLibraryExercise({ exerciseId: 'rdl', name: 'My RDL variation' })?.id, 'rdl');
  assert.equal(findLibraryExercise({ key: 'rdl' })?.id, 'rdl');
  assert.equal(findLibraryExercise({ name: '  Neutral–Grip   LAT PULLDOWN ' })?.id, 'lat-pulldown');
  assert.equal(findLibraryExercise('RDL')?.id, 'rdl');
});

test('search matches meaningful metadata and combines all five filters', () => {
  assert.ok(searchExercises('hamstring dumbbell').some(item => item.id === 'rdl'));
  assert.ok(searchExercises('rDl').some(item => item.id === 'rdl'));
  assert.deepEqual(searchExercises('no such movement xxx'), []);
  const results = searchExercises('', { muscle: 'Quads', goal: 'Jump', equipment: 'Bodyweight', movement: 'Vertical jump', type: 'Plyometric' });
  assert.ok(results.length >= 3);
  assert.ok(results.every(item => item.muscles.includes('Quads') && item.goals.includes('Jump') && item.equipment.includes('Bodyweight') && item.movement === 'Vertical jump' && item.category === 'Plyometric'));
  assert.ok(searchExercises('', { goal: 'Hypertrophy' }).some(item => item.id === 'biceps-curl'));
});

test('row alternatives rank similar stimulus first and explain stability and fatigue tradeoffs', () => {
  const ranked = rankAlternatives({ key: 'chest-row', name: 'Chest-Supported Row' });
  assert.deepEqual(ranked.slice(0, 4).map(item => item.exercise.id), ['seal-row', 'cable-row', 'one-arm-dumbbell-row', 'barbell-row']);
  assert.match(ranked[0].tradeoff, /chest support/);
  assert.match(ranked[2].tradeoff, /unilateral/);
  assert.match(ranked[3].tradeoff, /lower-back fatigue/);
  assert.ok(ranked.every(item => item.exercise.movement === 'Horizontal pull'));
});

test('squat alternatives prioritize useful replacements and never include arbitrary unrelated movements', () => {
  const ranked = rankAlternatives('Barbell Back Squat');
  assert.deepEqual(ranked.slice(0, 5).map(item => item.exercise.id), ['hack-squat', 'front-squat', 'leg-press', 'safety-bar-squat', 'bulgarian']);
  assert.ok(ranked.every(item => item.exercise.muscles.includes('Quads')));
  assert.ok(ranked.every(item => item.exercise.id !== 'back-squat'));
  assert.equal(rankAlternatives('Barbell Back Squat', 2).length, 2);
  assert.deepEqual(rankAlternatives('Barbell Back Squat', 0), []);
  assert.deepEqual(rankAlternatives({ name: 'Unrecognised movement', key: 'hack-squat' }), []);
});

test('jump and timed movements keep appropriate low-volume prescriptions and measurement types', () => {
  const approach = toPlanExercise(findLibraryExercise('Approach Jump')!);
  const standing = toPlanExercise(findLibraryExercise('Countermovement Jump')!);
  const broad = toPlanExercise(findLibraryExercise('Broad Jump')!);
  const pogo = toPlanExercise(findLibraryExercise('Pogo Jump')!);
  assert.equal(approach.measurement, 'touch');
  assert.equal(standing.measurement, 'height');
  assert.equal(broad.measurement, 'distance');
  assert.equal(pogo.mode, 'timed');
  assert.equal(pogo.target, '10–15 sec');
  assert.ok(standing.rest >= 90);
  assert.ok(standing.sets <= 4);
});
