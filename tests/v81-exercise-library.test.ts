import assert from 'node:assert/strict';
import test from 'node:test';
import { ExerciseSchema } from '../src/domain.js';
import { EXERCISE_CATALOGUE, findLibraryExercise, rankAlternatives, toPlanExercise } from '../src/exercise-library.ts';
import { getExerciseGuide } from '../src/exercise-guides.ts';
import { createVolleyballMasterPlan } from '../src/volleyball-master-plan.ts';

test('V8.1 exercise names resolve to stable, reusable library identities', () => {
  const expected: Record<string, string> = {
    'Single-arm Neutral-grip Dumbbell Shoulder Press': 'single-arm-neutral-db-press',
    'Light Dumbbell Squat Jump': 'light-dumbbell-squat-jump',
    'Pallof Press Isometric Hold': 'pallof-isometric-hold',
    'Split-squat Jump': 'split-squat-jump',
    'Plyometric Push-up': 'explosive-push-up',
    'Push-up Plus': 'push-up-plus',
    'Snap-down Landing': 'snap-down-landing',
    'Low-box Drop Jump': 'drop-jump',
    'Dumbbell Biceps Curl': 'biceps-curl',
    'Incline Machine Chest Press': 'incline-machine-press',
    'Short-Foot Hold': 'short-foot',
  };
  for (const [name, id] of Object.entries(expected)) {
    const movement = findLibraryExercise(name)!;
    assert.equal(movement?.id, id, name);
    assert.equal(ExerciseSchema.safeParse(toPlanExercise(movement)).success, true, name);
  }
  assert.equal(new Set(EXERCISE_CATALOGUE.map(exercise => exercise.id)).size, EXERCISE_CATALOGUE.length);
  for (const match of [false, true]) for (const day of createVolleyballMasterPlan(match)) {
    for (const exercise of [...day.exercises, ...(day.extraSession?.exercises ?? [])]) {
      assert.ok(findLibraryExercise(exercise.name), `Unrecognized V8.1 movement ${exercise.name}`);
    }
  }
});

test('new jump and isometric prescriptions use appropriate logging without merging distinct tests', () => {
  const jump = toPlanExercise(findLibraryExercise('Light Dumbbell Squat Jump')!);
  assert.equal(jump.mode, 'weight');
  assert.equal(jump.sets, 2);
  assert.equal(jump.target, '3 reps');
  assert.equal(jump.rest, 120);
  assert.equal(jump.measurement, undefined, 'a loaded power drill must not merge with an unloaded CMJ test');
  assert.equal(jump.jumpContactsPerRep, 1, 'library additions retain their real contact count');
  assert.match(jump.cue!, /2–4 kg per hand/);
  assert.match(jump.cue!, /both dumbbells combined/);
  const hold = toPlanExercise(findLibraryExercise('Pallof Press Isometric Hold')!);
  assert.equal(hold.mode, 'timed'); assert.equal(hold.target, '20 sec'); assert.equal(hold.perSide, true);
  const split = toPlanExercise(findLibraryExercise('Split-squat Jump')!);
  assert.equal(split.mode, 'bodyweight'); assert.equal(split.perSide, true); assert.equal(split.target, '2 reps');
  assert.equal(split.jumpContactsPerRep, 2, 'a logged per-leg rep includes one contact on each side');
  assert.equal(toPlanExercise(findLibraryExercise('Snap-down Landing')!).jumpContactsPerRep, undefined);
});

test('drop-jump alternatives include a nonreactive landing progression and never require higher boxes', () => {
  const drop = findLibraryExercise('Low-box Drop Jump')!;
  assert.match(drop.cues.join(' '), /15–20 cm/);
  const landing = rankAlternatives(drop.id).find(item => item.exercise.id === 'step-down-landing');
  assert.ok(landing);
  assert.match(landing.tradeoff, /without a rebound/);
  const guide = getExerciseGuide({ name: 'Low-box Drop Jump' });
  assert.match(guide.caution, /never increases automatically/);
  assert.match(guide.caution, /step-down landings/);
});

test('trap-bar progression is a technique-first replacement for leg press rather than additional volume', () => {
  const alternative = rankAlternatives('Leg Press').find(item => item.exercise.id === 'trap-bar-deadlift');
  assert.ok(alternative);
  assert.match(alternative.tradeoff, /20 kg empty bar/);
  assert.match(alternative.tradeoff, /replace Leg Press rather than adding/);
  const guide = getExerciseGuide({ name: 'Trap Bar Deadlift', target: '4–6 reps', mode: 'weight' });
  assert.equal(guide.loading.category, 'control');
  assert.match(guide.loading.advice, /20 kg empty trap bar/);
  assert.match(guide.loading.progression!, /never in addition/);
  assert.match(guide.loading.progression!, /Do not automatically increase/);
  assert.equal(rankAlternatives('Leg Press').some(item => item.exercise.id === 'trap-bar-jump'), false);
});

test('V8.1 details explain technique and loading concisely without generic bodybuilding advice', () => {
  for (const name of ['Single-arm Neutral-grip Dumbbell Shoulder Press', 'Light Dumbbell Squat Jump', 'Pallof Press Isometric Hold', 'Split-squat Jump', 'Plyometric Push-up', 'Push-up Plus', 'Snap-down Landing', 'Step-down Landing', 'Light Dynamic Mobility']) {
    const guide = getExerciseGuide({ name });
    assert.equal(guide.isGeneric, false, name);
    assert.equal(guide.steps.length, 3, name);
    assert.equal(guide.mistakes.length, 2, name);
    assert.notEqual(guide.loading.category, 'general', name);
  }
  const slam = getExerciseGuide({ name: 'Medicine Ball Spike Slam' });
  assert.match(slam.steps[0], /2–3 kg.*approved.*both hands/);
  assert.match(slam.loading.advice, /sore or fatigued/);
});
