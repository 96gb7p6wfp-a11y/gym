import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { carryForwardAfterCompletion, markSetInput } from '../src/set-autofill.ts';
import { getProgressionRecommendation } from '../src/performance-insights.ts';
import { adjustedWorkoutLoad, exerciseLoadIncrement, plannedRepetitions } from '../src/workout-input-steps.ts';

const plan = () => ({ ...structuredClone(DEFAULT_PROFILE.plan[0]), exercises: [{
  ...structuredClone(DEFAULT_PROFILE.plan[0].exercises[1]), name: 'Hack Squat', exerciseId: 'hack-squat', key: 'hack',
  mode: 'weight' as const, sets: 3, target: '4–6 reps', targetRir: 2, defaultKg: 40, equipmentLabel: 'Machine A',
}] });
function completed(date: string, kg = 70, reps = 6) {
  const result = SessionSchema.parse(stopSessionTimers(createSession(plan(), 2, date, DEFAULT_PROFILE, []), 'completed'));
  result.exercises[0].logs = result.exercises[0].logs.map(log => ({ ...log, kg, reps, rir: 2, done: true }));
  return result;
}

test('new-session history defaults yield to the last completed set without completing or editing other records', () => {
  const previous = completed('2026-11-04');
  const source = structuredClone(previous);
  const session = SessionSchema.parse(createSession(plan(), 2, '2026-11-11', DEFAULT_PROFILE, [previous]));
  const exercise = session.exercises[0];
  assert.deepEqual(exercise.logs[1].inputSources, { kg: 'history', reps: 'history' });
  exercise.logs[0] = { ...markSetInput(exercise.logs[0], { kg: 72.5, reps: 5 }), done: true };
  const next = carryForwardAfterCompletion(session, { sessionId: session.id, exerciseKey: exercise.key, setId: exercise.logs[0].id });
  assert.equal(next.exercises[0].logs[1].kg, 72.5);
  assert.equal(next.exercises[0].logs[1].reps, 5);
  assert.deepEqual(next.exercises[0].logs[1].inputSources, { kg: 'last-set', reps: 'last-set' });
  assert.equal(next.exercises[0].logs[1].done, false);
  assert.equal(next.exercises[0].logs[1].rir, null);
  assert.equal(next.exercises[0].logs[2], exercise.logs[2]);
  assert.deepEqual(previous, source);
});

test('planned fallback is an unfinished draft; explicit manual choices and deliberate clears always win', () => {
  const session = SessionSchema.parse(createSession(plan(), 2, '2026-11-11', DEFAULT_PROFILE, []));
  assert.deepEqual(session.exercises[0].logs[1].inputSources, { kg: 'planned', reps: 'planned' });
  assert.equal(session.exercises[0].logs[1].kg, 40);
  assert.equal(session.exercises[0].logs[1].reps, 4);
  session.exercises[0].logs[0] = { ...session.exercises[0].logs[0], kg: 60, reps: 8, done: true };
  const target = { sessionId: session.id, exerciseKey: 'hack', setId: session.exercises[0].logs[0].id };
  const filled = carryForwardAfterCompletion(session, target);
  assert.equal(filled.exercises[0].logs[1].kg, 60);
  assert.equal(filled.exercises[0].logs[1].reps, 8);
  session.exercises[0].logs[1] = markSetInput(session.exercises[0].logs[1], { kg: 57.5, reps: null });
  const preserved = carryForwardAfterCompletion(JSON.parse(JSON.stringify(session)), target);
  assert.equal(preserved.exercises[0].logs[1].kg, 57.5);
  assert.equal(preserved.exercises[0].logs[1].reps, null);
  assert.deepEqual(preserved.exercises[0].logs[1].inputSources, { kg: 'manual', reps: 'manual' });
});

test('legacy active-session values remain deliberate and cannot be relabeled or overwritten by a suggestion', () => {
  const session = SessionSchema.parse(createSession(plan(), 2, '2026-11-11', DEFAULT_PROFILE, []));
  const exercise = session.exercises[0];
  exercise.logs[0] = { ...exercise.logs[0], kg: 60, reps: 8, done: true };
  exercise.logs[1] = { ...exercise.logs[1], kg: 0, reps: 5 };
  delete exercise.logs[1].inputSources;
  const result = carryForwardAfterCompletion(session, { sessionId: session.id, exerciseKey: 'hack', setId: exercise.logs[0].id });
  assert.equal(result, session);
  assert.equal(Object.hasOwn(result.exercises[0].logs[1], 'inputSources'), false);
});

test('equipment steps support actual configured increments without rounding quarter-kilo weights away', () => {
  assert.equal(exerciseLoadIncrement({ name: 'Incline Machine Press' }), 2.5);
  assert.equal(exerciseLoadIncrement({ name: 'DB Shoulder Press' }), 1);
  assert.equal(exerciseLoadIncrement({ name: 'Cable Lateral Raise' }), 1);
  assert.equal(exerciseLoadIncrement({ name: 'Medicine Ball Spike Slam' }), 0.5);
  assert.equal(exerciseLoadIncrement({ name: 'Chest Press', loadIncrementKg: 1.25 }), 1.25);
  assert.equal(adjustedWorkoutLoad(22.5, 1, 0.25), 22.75);
  assert.equal(adjustedWorkoutLoad(22.75, -1, 0.25), 22.5);
  assert.equal(adjustedWorkoutLoad(0, -1, 2.5), 0);
  assert.equal(adjustedWorkoutLoad(2000, 1, 2.5), 2000);
  assert.equal(plannedRepetitions('6–8 reps'), 6);
  for (const target of ['30 sec', '2 min', '10 m', '315 cm', '30-second hold']) assert.equal(plannedRepetitions(target), null);
});

test('a chosen equipment step carries to the next comparable session without rewriting the template or a different machine', () => {
  const prior = completed('2026-11-04');
  prior.exercises[0].loadIncrementKg = 5;
  const template = plan();
  const next = SessionSchema.parse(createSession(template, 2, '2026-11-11', DEFAULT_PROFILE, [prior]));
  assert.equal(next.exercises[0].loadIncrementKg, 5);
  assert.equal(Object.hasOwn(template.exercises[0], 'loadIncrementKg'), false);
  template.exercises[0].equipmentLabel = 'Machine B';
  assert.equal(createSession(template, 2, '2026-11-11', DEFAULT_PROFILE, [prior]).exercises[0].loadIncrementKg, undefined);
  template.exercises[0].equipmentLabel = 'Machine A';
  Object.assign(template.exercises[0], { loadIncrementKg: 1.25 });
  assert.equal(createSession(template, 2, '2026-11-11', DEFAULT_PROFILE, [prior]).exercises[0].loadIncrementKg, 1.25);
});

test('preparation-only work never acquires heavy historic values even when the previous exercise identity matches', () => {
  const prior = completed('2026-11-04', 100);
  const template = plan();
  Object.assign(template.exercises[0], { preparationOnly: true, defaultKg: 0, targetRpe: 5 });
  const next = SessionSchema.parse(createSession(template, 2, '2026-11-11', DEFAULT_PROFILE, [prior]));
  assert.equal(next.exercises[0].logs[0].kg, 0);
  assert.equal(next.exercises[0].logs[0].done, false);
  assert.equal(next.exercises[0].logs[0].inputSources?.kg, 'planned');
  assert.equal(prior.exercises[0].logs[0].kg, 100);
});

test('a supported progression uses one selected machine increment and actual previous set/effort evidence', () => {
  const history = [completed('2026-11-04', 200), completed('2026-11-11', 200)];
  const exercise = { ...plan().exercises[0], loadIncrementKg: 2.5 };
  const before = structuredClone(history);
  const recommendation = getProgressionRecommendation(exercise, history, '2026-11-18', { readinessLevel: 'normal' });
  assert.equal(recommendation.kind, 'load');
  assert.equal(recommendation.kg, 202.5, 'only one actual increment, not a percentage-derived multiple');
  assert.equal(recommendation.reps, 4);
  assert.deepEqual(recommendation.history, { date: '2026-11-11', kg: 200, reps: [6, 6, 6], rir: [2, 2, 2] });
  assert.deepEqual(history, before);
});

test('Tired and Poor never request overload while Great and Normal do not inherit an older low-energy questionnaire', () => {
  const history = [completed('2026-11-04'), completed('2026-11-11')];
  for (const readinessLevel of ['tired', 'poor'] as const) {
    const result = getProgressionRecommendation(plan().exercises[0], history, '2026-11-18', { readinessLevel });
    assert.ok(!['load', 'reps'].includes(result.kind));
    assert.equal(result.kg, undefined);
  }
  for (const readinessLevel of ['great', 'normal'] as const) {
    const result = getProgressionRecommendation(plan().exercises[0], history, '2026-11-18', {
      readinessLevel, readiness: { energy: 'low', soreness: 'high' },
    });
    assert.equal(result.kind, 'load');
    const restricted = getProgressionRecommendation({ ...plan().exercises[0], preparationOnly: true }, history, '2026-11-18', { readinessLevel });
    assert.equal(restricted.kind, 'quality');
    assert.equal(restricted.kg, undefined);
  }
});

test('duplicate matching movements in one workout are not two sessions, and unknown effort is never fabricated', () => {
  const session = completed('2026-11-04');
  session.exercises.push({ ...structuredClone(session.exercises[0]), key: 'another-hack' });
  const once = getProgressionRecommendation(plan().exercises[0], [session], '2026-11-18');
  assert.notEqual(once.kind, 'load');
  const missingRir = [completed('2026-11-04'), completed('2026-11-11')];
  for (const log of missingRir[1].exercises[0].logs) log.rir = null;
  const result = getProgressionRecommendation(plan().exercises[0], missingRir, '2026-11-18');
  assert.notEqual(result.kind, 'load');
  assert.equal(result.history?.rir, null);
  missingRir[1].exercises[0].equipmentLabel = 'Different Machine';
  assert.notEqual(getProgressionRecommendation(plan().exercises[0], missingRir, '2026-11-18').kind, 'load');
});
