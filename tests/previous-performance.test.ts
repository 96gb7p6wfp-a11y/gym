import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { formatPreviousSet, previousPerformance, type PreviousSetMetric } from '../src/previous-performance.ts';
import { workoutTitle } from '../src/presentation.ts';
import type { ReportSession } from '../src/weekly-report.ts';

const metric: PreviousSetMetric = { done: true, kg: 60, reps: 8, seconds: 45, measurementCm: 315 };

function workout(date = '2026-10-01'): ReportSession {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.mode === 'weight')!;
  const plan = { ...DEFAULT_PROFILE.plan[0], exercises: [{ ...movement, key: 'press-instance', exerciseId: 'chest-press', name: 'Machine Chest Press', sets: 3 }] };
  const session = SessionSchema.parse(stopSessionTimers(createSession(plan, 0, date, DEFAULT_PROFILE, []), 'completed'));
  session.exercises[0].logs = session.exercises[0].logs.map((log, index) => ({ ...log, ...metric, kg: 60 + index * 2.5 }));
  return session;
}

test('previous metrics use the actual exercise type, unit and side configuration', () => {
  assert.equal(formatPreviousSet({ mode: 'weight' }, metric), '60 kg × 8');
  assert.equal(formatPreviousSet({ mode: 'weight', perSide: true }, { ...metric, kg: 20 }), '20 kg × 8 per side');
  assert.equal(formatPreviousSet({ mode: 'timed' }, { ...metric, kg: null }), '45 sec');
  assert.equal(formatPreviousSet({ mode: 'timed', perSide: true }, { ...metric, seconds: 30 }), '30 sec per side');
  assert.equal(formatPreviousSet({ mode: 'bodyweight' }, { ...metric, kg: null, reps: 12 }), '12 reps');
  assert.equal(formatPreviousSet({ mode: 'bodyweight' }, { ...metric, kg: 0, reps: 12 }), '12 reps');
  assert.equal(formatPreviousSet({ mode: 'bodyweight' }, { ...metric, kg: 12.5, reps: 12 }), '12.5 kg × 12');
  assert.equal(formatPreviousSet({ mode: 'weight', quantityUnit: 'm' }, { ...metric, kg: 20, reps: 30 }), '20 kg × 30 m');
  assert.equal(formatPreviousSet({ mode: 'bodyweight', quantityUnit: 'm' }, { ...metric, kg: null, reps: 30 }), '30 m');
  assert.equal(formatPreviousSet({ mode: 'bodyweight', measurement: 'touch' }, metric), 'Maximum touch 315 cm');
  assert.equal(formatPreviousSet({ mode: 'bodyweight', measurement: 'height' }, { ...metric, measurementCm: 65 }), 'Jump height 65 cm');
  assert.equal(formatPreviousSet({ mode: 'bodyweight', measurement: 'distance' }, { ...metric, measurementCm: 220 }), 'Distance 220 cm');
});

test('absent, incomplete and invalid metrics never become zeros or unrelated repetitions', () => {
  for (const log of [undefined, null, { ...metric, done: false }]) assert.equal(formatPreviousSet({ mode: 'weight' }, log), undefined);
  for (const seconds of [null, 0, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(formatPreviousSet({ mode: 'timed' }, { ...metric, seconds }), undefined);
  for (const measurementCm of [undefined, null, 0, Number.NaN]) assert.equal(formatPreviousSet({ mode: 'bodyweight', measurement: 'touch' }, { ...metric, measurementCm }), undefined);
  assert.equal(formatPreviousSet({ mode: 'weight' }, { ...metric, kg: null }), undefined);
  assert.equal(formatPreviousSet({ mode: 'bodyweight' }, { ...metric, kg: null, reps: null }), undefined);
  assert.equal(formatPreviousSet({ mode: 'weight' }, { ...metric, kg: 0 }), '0 kg × 8', 'a genuinely recorded zero load stays zero');
});

test('history labels preserve completed records, source IDs, decimal weights and original set ordinals', () => {
  const session = workout();
  const sessions = [session];
  const before = structuredClone(sessions);
  const exercise = session.exercises[0];
  assert.deepEqual(previousPerformance(exercise, sessions, '2026-10-02', 'today', 1), {
    label: '62.5 kg × 8', date: session.date, sessionId: session.id, exerciseKey: exercise.key, setId: exercise.logs[1].id,
  });
  assert.deepEqual(sessions, before);
  exercise.logs[0].done = false;
  assert.equal(previousPerformance(exercise, sessions, '2026-10-02', 'today', 0), undefined);
  assert.equal(previousPerformance(exercise, sessions, '2026-10-02', 'today', 1)?.label, '62.5 kg × 8');
});

test('latest comparable session with an unknown set is not silently replaced by an older performance', () => {
  const older = workout('2026-09-01'), latest = workout();
  latest.exercises[0].logs[0].done = false;
  const exercise = latest.exercises[0];
  assert.equal(previousPerformance(exercise, [older, latest], '2026-10-02'), undefined);
  assert.equal(previousPerformance(exercise, [latest, older], '2026-10-02', '', 3), undefined);
  assert.equal(previousPerformance(exercise, [latest, older], '2026-10-02', '', -1), undefined);
});

test('only completed nondeleted past sessions and compatible movement configurations supply metrics', () => {
  const original = workout();
  for (const variant of ['active', 'cancelled', 'deleted', 'future', 'renamed', 'measurement', 'unit', 'mode', 'side', 'preparation', 'self']) {
    const session = structuredClone(original);
    if (variant === 'active' || variant === 'cancelled') session.status = variant;
    if (variant === 'deleted') session.deletedAt = Date.now();
    if (variant === 'future') session.date = '2027-01-01';
    if (variant === 'renamed') session.exercises[0].name = 'Different press';
    if (variant === 'measurement') session.exercises[0].measurement = 'height';
    if (variant === 'unit') session.exercises[0].quantityUnit = 'm';
    if (variant === 'mode') session.exercises[0].mode = 'bodyweight';
    if (variant === 'side') session.exercises[0].perSide = !session.exercises[0].perSide;
    if (variant === 'preparation') session.exercises[0].preparationOnly = true;
    assert.equal(previousPerformance(original.exercises[0], [session], '2026-10-02', variant === 'self' ? session.id : 'today'), undefined, variant);
  }
});

test('history scans past incompatible recent records and rejects ambiguous duplicate exercise instances', () => {
  const older = workout('2026-09-01'), latest = workout();
  latest.exercises[0].measurement = 'height';
  assert.equal(previousPerformance(older.exercises[0], [older, latest], '2026-10-02')?.sessionId, older.id);
  const duplicate = structuredClone(older.exercises[0]);
  duplicate.key = 'second-instance'; duplicate.logs[0].kg = 80;
  older.exercises.push(duplicate);
  assert.equal(previousPerformance({ ...duplicate, key: 'new-instance' }, [older], '2026-10-02'), undefined);
  assert.equal(previousPerformance(duplicate, [older], '2026-10-02')?.label, '80 kg × 8');
});

test('whole-workout titles use the saved name rather than a conflicting purpose or calendar alias', () => {
  const names = ['Upper Power + Muscle', 'Lower Strength', 'Jump Technique Primer', 'Upper B — Athletic Physique + Spike Power', 'My own workout'];
  for (const name of names) {
    const source = { name, goal: 'strength', id: 'stable-workout-id' };
    assert.equal(workoutTitle(source), name);
    assert.equal(workoutTitle(name), name);
    assert.deepEqual(source, { name, goal: 'strength', id: 'stable-workout-id' });
  }
  assert.equal(workoutTitle('  Custom strength  '), 'Custom strength');
});
