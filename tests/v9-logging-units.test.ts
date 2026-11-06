import assert from 'node:assert/strict';
import test from 'node:test';
import { exerciseInputKind, measuredSprintSeconds } from '../src/exercise-input.ts';
import { formatPreviousSet } from '../src/previous-performance.ts';
import { createV9VolleyballMasterPlan } from '../src/volleyball-v9-plan.ts';
import { firstUnfinishedStep, findTrainingPair, nextStepAfterCompletion, restAfterCompletedSet } from '../src/training-flow.ts';
import { carryForwardAfterCompletion } from '../src/set-autofill.ts';
import { isOneRepMaxExercise } from '../src/performance-insights.ts';

test('V9 sprint metadata selects metre input while weighted carries and measured jump distances keep their own units', () => {
  const plan = createV9VolleyballMasterPlan();
  for (const day of [plan[2], plan[5]]) {
    for (const exercise of day.exercises.filter(item => item.prescribedDistanceM != null)) {
      assert.equal(exerciseInputKind(exercise), 'distance');
      assert.equal(exercise.mode, 'bodyweight');
      assert.equal(exercise.quantityUnit, 'm');
      assert.equal(exercise.measurement, undefined, 'metres are not centimetre jump measurements');
    }
  }
  assert.equal(exerciseInputKind({ mode: 'weight', quantityUnit: 'm' }), 'weight', 'legacy loaded carry remains supported');
  assert.equal(exerciseInputKind({ mode: 'bodyweight', measurement: 'distance' }), 'measurement');
  assert.equal(exerciseInputKind({ mode: 'timed', quantityUnit: 'm' }), 'duration');
});

test('optional measured sprint time accepts real decimal input and never clips invalid values into results', () => {
  assert.equal(measuredSprintSeconds('1.28'), 1.28);
  assert.equal(measuredSprintSeconds(' 1,28 '), 1.28);
  for (const raw of ['', ' ', 'not measured', 'Infinity', '1e999', '-1', '0', '86401']) {
    assert.equal(measuredSprintSeconds(raw), null, raw);
  }
});

test('previous V9 sprint values keep metres and optional measured seconds separate from repetitions or kilograms', () => {
  const movement = createV9VolleyballMasterPlan()[2].exercises.find(exercise => exercise.prescribedDistanceM === 5)!;
  const log = { done: true, kg: null, reps: 5, seconds: null, measurementCm: null };
  assert.equal(formatPreviousSet(movement, log), '5 m');
  assert.equal(formatPreviousSet(movement, { ...log, seconds: 1.27 }), '5 m · 1.27 sec measured');
  assert.equal(formatPreviousSet(movement, { ...log, done: false, seconds: 1.27 }), undefined);
  assert.equal(formatPreviousSet({ mode: 'bodyweight', quantityUnit: 'm' }, { ...log, reps: 30, seconds: 40 }), '30 m', 'legacy carry elapsed time is not relabelled as a sprint test');
});

test('V9 suitcase holds log seconds with optional actual external load and never become thirty repetitions', () => {
  const hold = createV9VolleyballMasterPlan()[2].exercises.find(exercise => exercise.exerciseId === 'suitcase-static-hold')!;
  assert.equal(exerciseInputKind(hold), 'duration');
  assert.equal(hold.quantityUnit, undefined);
  assert.equal(hold.target, '30 sec');
  assert.equal(hold.perSide, true);
  const log = { done: true, kg: null, reps: null, seconds: 30 };
  assert.equal(formatPreviousSet(hold, log), '30 sec per side');
  assert.equal(formatPreviousSet(hold, { ...log, kg: 18.5 }), '18.5 kg · 30 sec per side');
  assert.equal(formatPreviousSet(hold, { ...log, kg: 18.5, seconds: null }), undefined);
});

test('the actual V9 Wednesday complex alternates exactly three Hack/CMJ rounds with both prescribed rest periods', () => {
  const plan = createV9VolleyballMasterPlan()[2];
  const exercises = plan.exercises.map(exercise => ({ ...exercise,
    logs: Array.from({ length: exercise.sets }, (_, index) => ({ id: `${exercise.key}-${index}`, done: false })),
  }));
  const hack = exercises.find(exercise => exercise.name === 'Hack Squat')!;
  const cmj = exercises.find(exercise => exercise.group === 'A2 · Complex pair')!;
  for (const exercise of exercises.slice(0, exercises.indexOf(hack))) exercise.logs.forEach(log => { log.done = true; });
  assert.equal(hack.logs.length, 3);
  assert.equal(cmj.logs.length, 3);
  assert.equal(exercises.filter(exercise => exercise.name === 'Hack Squat').length, 1);
  assert.equal(findTrainingPair(exercises, hack.key)?.kind, 'complex', 'a long-rest complex is not a no-rest superset');
  const sequence: string[] = [], rests: number[] = [];
  let step = firstUnfinishedStep(exercises);
  for (let index = 0; index < 6; index++) {
    assert.ok(step);
    const currentStep = step;
    const exercise = exercises.find(item => item.key === currentStep.exerciseKey)!;
    const log = exercise.logs.find(item => item.id === currentStep.setId)!;
    sequence.push(`${exercise.name}:${currentStep.round}`);
    log.done = true;
    rests.push(restAfterCompletedSet(exercises, exercise.key, log.id));
    step = nextStepAfterCompletion(exercises, exercise.key, log.id);
  }
  assert.deepEqual(sequence, ['Hack Squat:1', 'Countermovement Jump:1', 'Hack Squat:2', 'Countermovement Jump:2', 'Hack Squat:3', 'Countermovement Jump:3']);
  assert.deepEqual(rests, [240, 180, 240, 180, 240, 180]);
  assert.equal(step?.exerciseKey, exercises.find(exercise => exercise.name === 'Romanian Deadlift')!.key);
});

test('a refreshed V9 complex resumes its unfinished CMJ and stale completion cannot advance it again', () => {
  const plan = createV9VolleyballMasterPlan()[2];
  const exercises = plan.exercises.filter(exercise => /Complex pair/.test(exercise.group)).map(exercise => ({ ...exercise,
    logs: Array.from({ length: exercise.sets }, (_, index) => ({ id: `${exercise.key}-${index}`, done: exercise.group.startsWith('A1') && index === 0 })),
  }));
  const first = firstUnfinishedStep(structuredClone(exercises));
  assert.equal(first?.exerciseKey, exercises[1].key);
  assert.equal(first?.round, 1);
  assert.equal(restAfterCompletedSet(exercises, exercises[1].key, exercises[1].logs[0].id), 0);
  assert.equal(nextStepAfterCompletion(exercises, exercises[1].key, exercises[1].logs[0].id), null);
});

test('automatic strength suggestions do not invent completed sprint times, jump measurements or timed hold values', () => {
  const day = createV9VolleyballMasterPlan()[2];
  for (const exercise of day.exercises.filter(item => item.prescribedDistanceM != null || item.measurement || item.mode === 'timed')) {
    const session = { id: 'isolated-v9-session', status: 'active', exercises: [{ ...exercise,
      logs: [{ id: 'done', done: true, kg: 20, reps: 8, seconds: 1.2 }, { id: 'next', done: false, kg: null, reps: null, seconds: null }],
    }] };
    const before = structuredClone(session);
    assert.equal(carryForwardAfterCompletion(session, { sessionId: session.id, exerciseKey: exercise.key, setId: 'done' }), session);
    assert.deepEqual(session, before);
  }
});

test('actual V9 medicine-ball work, loaded jumps, sprints and timed holds never receive estimated strength 1RM records', () => {
  const week = createV9VolleyballMasterPlan();
  const excluded = week.flatMap(day => day.exercises).filter(exercise => /medicine.ball|squat jump/i.test(exercise.name)
    || exercise.prescribedDistanceM != null || exercise.mode === 'timed');
  assert.ok(excluded.some(exercise => /slam/i.test(exercise.name)));
  assert.ok(excluded.some(exercise => /throw/i.test(exercise.name)));
  for (const exercise of excluded) assert.equal(isOneRepMaxExercise(exercise), false, exercise.name);
  assert.equal(isOneRepMaxExercise(week[2].exercises.find(exercise => exercise.name === 'Hack Squat')!), true);
});
