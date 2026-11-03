import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { previousSetReuse } from '../src/workout-reuse.ts';
import type { ReportSession } from '../src/weekly-report.ts';

function workout(date = '2026-10-01'): ReportSession {
  const movement = DEFAULT_PROFILE.plan.flatMap(day => day.exercises).find(exercise => exercise.name === 'Machine Chest Press')!;
  const plan = { ...DEFAULT_PROFILE.plan[0], exercises: [{ ...movement, key: 'copy', exerciseId: 'chest-press', sets: 2 }] };
  const session = SessionSchema.parse(createSession(plan, 0, date, DEFAULT_PROFILE, []));
  const finished = SessionSchema.parse(stopSessionTimers(session, 'completed'));
  finished.exercises[0].logs = finished.exercises[0].logs.map((log, index) => ({ ...log, kg: index ? 0 : 12.5, reps: index ? 6 : 8, rir: 1, done: true }));
  return finished;
}

test('reuse copies exact decimal/zero weight and reps only, preserving source records and order', () => {
  const older = workout('2026-09-01'), latest = workout();
  const sessions = [older, latest];
  const before = structuredClone(sessions);
  assert.deepEqual(previousSetReuse(latest.exercises[0], 0, sessions, '2026-10-02', 'today'), { date: '2026-10-01', patch: { kg: 12.5, reps: 8 } });
  assert.deepEqual(previousSetReuse(latest.exercises[0], 1, sessions, '2026-10-02', 'today')?.patch, { kg: 0, reps: 6 });
  assert.deepEqual(sessions, before);
});

test('reuse excludes active, deleted, future, renamed and different measurement/unit/mode records', () => {
  const original = workout();
  for (const variant of ['active', 'deleted', 'future', 'renamed', 'measurement', 'unit', 'mode', 'side', 'preparation', 'self']) {
    const session = structuredClone(original);
    if (variant === 'active') session.status = 'active';
    if (variant === 'deleted') session.deletedAt = Date.now();
    if (variant === 'future') session.date = '2027-01-01';
    if (variant === 'renamed') session.exercises[0].name = 'Different press';
    if (variant === 'measurement') session.exercises[0].measurement = 'height';
    if (variant === 'unit') session.exercises[0].quantityUnit = 'm';
    if (variant === 'mode') session.exercises[0].mode = 'bodyweight';
    if (variant === 'preparation') session.exercises[0].preparationOnly = true;
    if (variant === 'side') session.exercises[0].perSide = !session.exercises[0].perSide;
    assert.equal(previousSetReuse(original.exercises[0], 0, [session], '2026-10-02', variant === 'self' ? session.id : 'today'), null, variant);
  }
});

test('set ordinals never shift and missing data in latest session never falls back to an older load', () => {
  const previous = workout('2026-09-01'), latest = workout();
  latest.exercises[0].logs[0].done = false;
  assert.equal(previousSetReuse(latest.exercises[0], 0, [latest, previous], '2026-10-02', 'today'), null);
  assert.deepEqual(previousSetReuse(latest.exercises[0], 1, [latest, previous], '2026-10-02', 'today')?.patch, { kg: 0, reps: 6 });
  assert.equal(previousSetReuse(latest.exercises[0], 2, [latest, previous], '2026-10-02', 'today'), null);
  latest.exercises[0].logs[1].kg = null;
  assert.equal(previousSetReuse(latest.exercises[0], 1, [latest, previous], '2026-10-02', 'today'), null);
});

test('bodyweight reuse preserves no added load, measurements reuse reps only and timed sets are excluded', () => {
  const session = workout();
  const exercise = session.exercises[0];
  exercise.mode = 'bodyweight';
  exercise.logs[0].kg = null;
  assert.deepEqual(previousSetReuse(exercise, 0, [session], '2026-10-02', 'today')?.patch, { kg: null, reps: 8 });
  assert.equal(previousSetReuse({ ...exercise, defaultKg: 0 }, 0, [session], '2026-10-02', 'today'), null, 'clearance-limited bodyweight work must not inherit added load');
  exercise.measurement = 'height';
  exercise.logs[0].measurementCm = 52;
  assert.deepEqual(previousSetReuse(exercise, 0, [session], '2026-10-02', 'today')?.patch, { reps: 8 });
  assert.equal(previousSetReuse({ ...exercise, preparationOnly: true }, 0, [session], '2026-10-02', 'today'), null);
  exercise.mode = 'timed';
  assert.equal(previousSetReuse(exercise, 0, [session], '2026-10-02', 'today'), null);
});

test('duplicate comparable movements require an exact instance or remain unknown', () => {
  const session = workout();
  const duplicate = structuredClone(session.exercises[0]);
  duplicate.key = 'second-copy';
  duplicate.logs[0].kg = 60;
  session.exercises.push(duplicate);
  assert.equal(previousSetReuse({ ...duplicate, key: 'new-copy' }, 0, [session], '2026-10-02', 'today'), null);
  assert.equal(previousSetReuse(duplicate, 0, [session], '2026-10-02', 'today')?.patch.kg, 60);
});
