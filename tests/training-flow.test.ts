import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, createSession } from '../src/domain.js';
import { findComplexPair, firstUnfinishedStep, nextStepAfterCompletion, type TrainingFlowExercise } from '../src/training-flow.ts';

function movement(key: string, group = 'Strength', sets = 2, completed: number[] = []) {
  return {
    key, group, rest: 180,
    logs: Array.from({ length: sets }, (_, index) => ({ id: `${key}-${index + 1}`, done: completed.includes(index + 1) })),
  };
}

const stepIds = (entry: ReturnType<typeof firstUnfinishedStep>) => entry && [entry.exerciseKey, entry.setId];

test('the existing Sunday complex pairs complete by rounds with all prescribed rest durations preserved', () => {
  const session = createSession(DEFAULT_PROFILE.plan[6], 6, '2026-10-11', DEFAULT_PROFILE, []);
  const firstPairIndex = session.exercises.findIndex((exercise: { group: string }) => exercise.group === 'A1 · Complex pair');
  for (const exercise of session.exercises.slice(0, firstPairIndex)) {
    for (const log of exercise.logs) log.done = true;
  }
  const originalRest = session.exercises.map((exercise: { rest: number }) => exercise.rest);
  let next = firstUnfinishedStep(session.exercises);
  const performed: string[] = [];
  for (let index = 0; index < 10; index += 1) {
    assert.ok(next);
    performed.push(`${next.exerciseKey}:${next.round}`);
    const current = session.exercises.find((exercise: { key: string }) => exercise.key === next!.exerciseKey)!;
    current.logs.find((log: { id: string }) => log.id === next!.setId)!.done = true;
    next = nextStepAfterCompletion(session.exercises, current.key, next.setId);
  }
  assert.deepEqual(performed, [
    'hack-squat:1', 'cmj:1', 'hack-squat:2', 'cmj:2', 'hack-squat:3', 'cmj:3',
    'bulgarian:1', 'broad-jump:1', 'bulgarian:2', 'broad-jump:2',
  ]);
  assert.equal(next?.exerciseKey, 'rdl');
  assert.deepEqual(session.exercises.map((exercise: { rest: number }) => exercise.rest), originalRest);
  assert.equal(originalRest[firstPairIndex], 180);
});

test('pair detection uses only matching explicit adjacent labels, never movement names or unrelated group text', () => {
  const first = movement('squat', 'A1 · Complex pair');
  const second = movement('jump', 'A2 · Complex pair');
  const pair = findComplexPair([first, second], 'jump');
  assert.equal(pair?.label, 'A');
  assert.equal(pair?.first, first);
  assert.equal(pair?.second, second);
  assert.equal(pair?.startIndex, 0);
  assert.equal(findComplexPair([first, second], 'missing'), null);
  const malformed = [
    [first, movement('other'), second],
    [first, movement('jump', 'B2 · Complex pair')],
    [second, first],
    [movement('squat', 'A1'), movement('jump', 'A2')],
    [movement('squat', 'Complex pair'), movement('jump', 'Complex pair')],
    [movement('squat', 'A1 · Superset'), movement('jump', 'A2 · Superset')],
    [movement('squat', 'A1 · Complex pair optional'), second],
    [first],
  ];
  for (const exercises of malformed) {
    for (const exercise of exercises) assert.equal(findComplexPair(exercises, exercise.key), null);
  }
});

test('explicit labels tolerate insignificant whitespace and casing', () => {
  const exercises = [movement('first', ' c1 · complex pair '), movement('second', 'C2  ·  Complex Pair')];
  assert.equal(findComplexPair(exercises, 'first')?.label, 'C');
});

test('restored sessions resume an unfinished partner before advancing to the next round', () => {
  const exercises = [movement('squat', 'A1 · Complex pair', 3, [1]), movement('jump', 'A2 · Complex pair', 3)];
  assert.deepEqual(firstUnfinishedStep(exercises), { exerciseKey: 'jump', setId: 'jump-1', setIndex: 0, round: 1 });
  assert.deepEqual(stepIds(firstUnfinishedStep(exercises, 'jump')), ['jump', 'jump-1']);
  exercises[1].logs[0].done = true;
  assert.deepEqual(stepIds(firstUnfinishedStep(exercises, 'jump')), ['squat', 'squat-2']);
});

test('automatic advancement waits for confirmed completion and rejects stale or missing selections', () => {
  const exercises = [movement('squat', 'A1 · Complex pair'), movement('jump', 'A2 · Complex pair')];
  assert.equal(nextStepAfterCompletion(exercises, 'squat', 'squat-1'), null);
  assert.equal(nextStepAfterCompletion(exercises, 'missing', 'squat-1'), null);
  assert.equal(nextStepAfterCompletion(exercises, 'squat', 'removed-set'), null);
  exercises[0].logs[0].done = true;
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'squat', 'squat-1')), ['jump', 'jump-1']);
});

test('already-completed partners are skipped without hiding earlier unfinished rounds after manual selection', () => {
  const exercises = [movement('squat', 'A1 · Complex pair', 3, [2, 3]), movement('jump', 'A2 · Complex pair', 3, [2])];
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'squat', 'squat-2')), ['jump', 'jump-3']);
  exercises[1].logs[2].done = true;
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'jump', 'jump-3')), ['squat', 'squat-1']);
  exercises[0].logs[0].done = true;
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'squat', 'squat-1')), ['jump', 'jump-1']);
});

test('unequal and newly added sets remain reachable without inventing a missing partner log', () => {
  const exercises = [movement('squat', 'B1 · Complex pair', 1, [1]), movement('jump', 'B2 · Complex pair', 3, [1])];
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'jump', 'jump-1')), ['jump', 'jump-2']);
  exercises[1].logs[1].done = true;
  exercises[0].logs.push({ id: 'extra-squat', done: false });
  assert.deepEqual(stepIds(firstUnfinishedStep(exercises)), ['squat', 'extra-squat']);
  exercises[0].logs[1].done = true;
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'squat', 'extra-squat')), ['jump', 'jump-3']);
  assert.equal(exercises[0].logs.length, 2);
});

test('a finished pair moves on, while a pair at the end wraps to other unfinished movements', () => {
  const exercises = [movement('before'), movement('squat', 'A1 · Complex pair', 2, [1, 2]), movement('jump', 'A2 · Complex pair', 2, [1, 2]), movement('after')];
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'jump', 'jump-2')), ['after', 'after-1']);
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises.slice(0, -1), 'jump', 'jump-2')), ['before', 'before-1']);
});

test('ordinary movements retain set-first progression and then skip completed movements', () => {
  const exercises = [movement('row', 'Back', 3, [2]), movement('done', 'Other', 1, [1]), movement('press', 'Chest')];
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'row', 'row-2')), ['row', 'row-1']);
  exercises[0].logs[0].done = true;
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'row', 'row-1')), ['row', 'row-3']);
  exercises[0].logs[2].done = true;
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'row', 'row-3')), ['press', 'press-1']);
});

test('empty movements, empty sessions and completed sessions have no invented next step', () => {
  assert.equal(firstUnfinishedStep([]), null);
  assert.equal(nextStepAfterCompletion([], 'missing', 'missing'), null);
  const exercises = [movement('empty', 'A1 · Complex pair', 0), movement('jump', 'A2 · Complex pair', 1, [1])];
  assert.equal(firstUnfinishedStep(exercises), null);
  assert.equal(nextStepAfterCompletion(exercises, 'jump', 'jump-1'), null);
  exercises[1].logs[0].done = false;
  assert.deepEqual(stepIds(firstUnfinishedStep(exercises)), ['jump', 'jump-1']);
});

test('navigation accepts frozen old-session data without changing logs, IDs, values or rest', () => {
  const first = movement('squat', 'A1 · Complex pair', 2, [1]);
  const second = movement('jump', 'A2 · Complex pair');
  const originals = structuredClone([first, second]);
  const exercises: readonly TrainingFlowExercise[] = Object.freeze([first, second].map((exercise) => Object.freeze({
    ...exercise, logs: Object.freeze(exercise.logs.map((log) => Object.freeze({ ...log, kg: 12.5, reps: 3 }))),
  })));
  assert.deepEqual(stepIds(firstUnfinishedStep(exercises)), ['jump', 'jump-1']);
  assert.deepEqual(stepIds(nextStepAfterCompletion(exercises, 'squat', 'squat-1')), ['jump', 'jump-1']);
  assert.deepEqual([first, second], originals);
  assert.equal((exercises[0].logs[0] as typeof first.logs[0] & { kg: number }).kg, 12.5);
});
