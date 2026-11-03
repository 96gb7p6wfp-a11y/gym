import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';
import { findLibraryExercise, EXERCISE_CATALOGUE, toPlanExercise } from '../src/exercise-library.ts';
import { firstUnfinishedStep, nextStepAfterCompletion, findComplexPair, findTrainingPair, restAfterCompletedSet, type SupersetLink } from '../src/training-flow.ts';
import { clearOrphanedComplexPairs, removeSessionExercise, moveSessionExercise, replaceSessionExercise } from '../src/workout-customization.ts';

function movement(key: string, sets: number, superset?: SupersetLink) {
  return { key, group: 'Shoulders', rest: 60, ...(superset ? { superset } : {}),
    logs: Array.from({ length: sets }, (_, index) => ({ id: `${key}-${index}`, done: false })) };
}
function shoulders() {
  const common = { id: 'shoulders', label: 'A', rounds: 2, restAfterRound: 75 };
  return [movement('rear', 3, { ...common, order: 2 }), movement('lateral', 2, { ...common, order: 1 }), movement('curl', 1)];
}

test('shoulder supersets honor the prescribed pair order without changing preview order or deleting the extra rear set', () => {
  const exercises = shoulders();
  const order = exercises.map(item => item.key);
  let next = firstUnfinishedStep(exercises);
  const completed: string[] = [], rests: number[] = [];
  for (let i = 0; i < 5; i++) {
    assert.ok(next);
    completed.push(`${next.exerciseKey}:${next.setIndex}`);
    exercises.find(item => item.key === next!.exerciseKey)!.logs[next.setIndex].done = true;
    rests.push(restAfterCompletedSet(exercises, next.exerciseKey, next.setId));
    next = nextStepAfterCompletion(exercises, next.exerciseKey, next.setId);
  }
  assert.deepEqual(completed, ['lateral:0', 'rear:0', 'lateral:1', 'rear:1', 'rear:2']);
  assert.deepEqual(rests, [0, 75, 0, 75, 60]);
  assert.equal(next?.exerciseKey, 'curl');
  assert.deepEqual(exercises.map(item => item.key), order);
  assert.equal(exercises[0].logs.length, 3);
  assert.equal(findComplexPair(exercises, 'rear'), null, 'supersets never masquerade as heavy–power complexes');
});

test('arm supersets alternate all three rounds and rest only after complete pairs', () => {
  const link = { id: 'arms', label: 'B', rounds: 3, restAfterRound: 90 };
  const exercises = [movement('curl', 3, { ...link, order: 1 }), movement('rope', 3, { ...link, order: 2 })];
  let next = firstUnfinishedStep(exercises);
  const completed: string[] = [], rests: number[] = [];
  while (next) {
    completed.push(next.exerciseKey);
    exercises.find(item => item.key === next!.exerciseKey)!.logs[next.setIndex].done = true;
    rests.push(restAfterCompletedSet(exercises, next.exerciseKey, next.setId));
    next = nextStepAfterCompletion(exercises, next.exerciseKey, next.setId);
  }
  assert.deepEqual(completed, ['curl', 'rope', 'curl', 'rope', 'curl', 'rope']);
  assert.deepEqual(rests, [0, 90, 0, 90, 0, 90]);
});

test('resuming a partly completed superset selects its unfinished partner before the next round', () => {
  const exercises = shoulders();
  exercises[1].logs[0].done = true;
  assert.equal(firstUnfinishedStep(exercises)?.setId, 'rear-0');
  assert.equal(firstUnfinishedStep(exercises, 'lateral')?.setId, 'rear-0');
  assert.equal(restAfterCompletedSet(exercises, 'rear', 'rear-0'), 0, 'an unfinished set cannot trigger rest');
  assert.equal(findTrainingPair(exercises, 'lateral')?.pairedRounds, 2);
  exercises[1].logs.push({ id: 'lateral-extra', done: false });
  assert.equal(findTrainingPair(exercises, 'lateral')?.pairedRounds, 2, 'adding a set does not invent an additional paired round');
});

test('only explicit, intact matching supersets are linked; editing clears orphan metadata', () => {
  const valid = shoulders();
  assert.equal(findTrainingPair(valid, 'rear')?.kind, 'superset');
  for (const broken of [
    [valid[0], valid[2], valid[1]],
    [valid[0]],
    [valid[0], { ...valid[1], superset: { ...valid[1].superset!, restAfterRound: 120 } }],
    [valid[0], valid[1], { ...valid[1], key: 'duplicate' }],
  ]) {
    assert.equal(findTrainingPair(broken, 'rear'), null);
    assert.ok(clearOrphanedComplexPairs(broken).every(item => !item.superset));
  }
});

test('exercise edits preserve recorded sets while unlinking replaced or moved superset members', () => {
  const raw = shoulders().slice(0, 2);
  const plan = { name: 'Shoulder pair', kind: 'strength', minutes: 15, note: '', exercises: raw.map((item, index) => ({
    ...toPlanExercise(findLibraryExercise(index === 0 ? 'Reverse Pec Deck' : 'Cable Lateral Raise')!),
    key: item.key, sets: item.logs.length, superset: item.superset,
  })) };
  const session = SessionSchema.parse(createSession(plan, 3, '2026-11-05', DEFAULT_PROFILE, []));
  Object.assign(session.exercises[0].logs[0], { done: true, reps: 15, kg: 12.5 });
  const first = structuredClone(session.exercises[0].logs[0]);
  const removed = removeSessionExercise(session, 'rear');
  assert.deepEqual(removed.exercises[0].logs[0], first);
  assert.ok(removed.exercises.every(item => !item.superset));
  const replaced = replaceSessionExercise(session, 'rear', toPlanExercise(findLibraryExercise('Face Pull')!));
  assert.deepEqual(replaced.exercises[0].logs[0], first);
  assert.ok(replaced.exercises.every(item => !item.superset));
  const extended = { ...session, exercises: [...session.exercises, { ...session.exercises[1], key: 'unpaired', superset: undefined }] };
  const moved = moveSessionExercise(extended, 'rear', 2);
  assert.ok(moved.exercises.every(item => !item.superset));
  assert.deepEqual(session.exercises[0].logs[0], first, 'the original snapshot remains unchanged');
});

test('V13.1 library additions have stable identities, correct logging modes and useful safety guidance', () => {
  assert.equal(new Set(EXERCISE_CATALOGUE.map(item => item.id)).size, EXERCISE_CATALOGUE.length);
  for (const id of ['bent-knee-calf-isometric', 'split-squat-isometric']) {
    const item = findLibraryExercise(id)!;
    assert.ok(item);
    assert.equal(item.mode, 'timed');
    assert.ok(item.precautions?.length);
    assert.equal(item.cues.length, 2);
    assert.equal(item.mistakes.length, 2);
    assert.ok(item.substitutions.every(id => findLibraryExercise(id)));
  }
  assert.equal(findLibraryExercise('Incline Dumbbell Curl')?.id, 'incline-curl');
  assert.equal(findLibraryExercise('Rope Triceps Pushdown')?.id, 'triceps');
  assert.equal(findLibraryExercise('Flat Machine Chest Press')?.id, 'chest-press');
  assert.equal(findLibraryExercise('Rope Triceps Extension')?.id, 'rope-triceps-extension');
  assert.equal(findLibraryExercise('Single-Arm Landmine Press')?.id, 'landmine-press');
  assert.equal(findLibraryExercise('Low Hurdle Hops')?.jumpContactsPerRep, 1);
});
