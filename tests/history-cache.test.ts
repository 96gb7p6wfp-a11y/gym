import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { CompletedHistoryProjection, PreviousPerformanceIndex } from '../src/history-cache.ts';
import type { ReportSession } from '../src/weekly-report.ts';

function session(date: string, id = date): ReportSession {
  const draft = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[0], 0, date, DEFAULT_PROFILE, []));
  const startedAt = new Date(`${date}T12:00:00Z`).getTime();
  const result = SessionSchema.parse(stopSessionTimers({ ...draft, startedAt }, 'completed', startedAt + 60_000));
  result.id = id;
  result.exercises = [{ ...result.exercises[0], key: 'bench', exerciseId: 'barbell-bench-press',
    name: 'Barbell Bench Press', mode: 'weight', preparationOnly: false,
    measurement: undefined, quantityUnit: undefined, prescribedDistanceM: undefined, perSide: false,
    logs: result.exercises[0].logs.map(log => ({ ...log, done: true, kg: 60, reps: 8 })) }];
  return result;
}

test('completed history keeps its reference through active edits even when storage order is not chronological', () => {
  const oldest = session('2026-10-01');
  const newest = session('2026-10-08');
  const active = { ...session('2026-10-15'), status: 'active' as const };
  const source = [oldest, active, newest];
  const before = structuredClone(source);
  const projection = new CompletedHistoryProjection<ReportSession>();
  const history = projection.derive(source);
  assert.deepEqual(history, [newest, oldest]);
  assert.equal(Object.isFrozen(history), true);
  const editedActive = { ...active, exercises: active.exercises.map(exercise => ({ ...exercise,
    logs: exercise.logs.map(log => ({ ...log, kg: 62.5 })) })) };
  assert.equal(projection.derive([oldest, editedActive, newest]), history);
  assert.deepEqual(source, before, 'projection never sorts or modifies persisted source records');
});

test('completed history invalidates for immutable record edits, completion, removal and reordered historical sources', () => {
  const first = session('2026-10-01'), second = session('2026-10-08');
  const projection = new CompletedHistoryProjection<ReportSession>();
  const initial = projection.derive([first, second]);
  const edited = { ...second, exercises: second.exercises.map(exercise => ({ ...exercise,
    logs: exercise.logs.map(log => ({ ...log, reps: 9 })) })) };
  const afterEdit = projection.derive([first, edited]);
  assert.notEqual(afterEdit, initial);
  assert.equal(afterEdit[0], edited);
  const afterReorder = projection.derive([edited, first]);
  assert.notEqual(afterReorder, afterEdit);
  assert.deepEqual(afterReorder, [edited, first]);
  const third = session('2026-10-15');
  const afterCompletion = projection.derive([edited, first, third]);
  assert.notEqual(afterCompletion, afterReorder);
  assert.deepEqual(afterCompletion, [third, edited, first]);
  const afterRemoval = projection.derive([edited, { ...first, status: 'active' as const }, third]);
  assert.deepEqual(afterRemoval, [third, edited]);
});

test('completed history detects date, start-time and deletion metadata changes without mutating records', () => {
  const a = session('2026-10-01'), b = session('2026-10-08');
  const projection = new CompletedHistoryProjection<ReportSession>();
  const initial = projection.derive([a, b]);
  // Historical reducers replace records. Legacy metadata callers are also safe.
  a.date = b.date;
  a.startedAt = b.startedAt + 1;
  const redated = projection.derive([a, b]);
  assert.notEqual(redated, initial);
  assert.equal(redated[0], a);
  a.deletedAt = 123;
  const deleted = projection.derive([a, b]);
  assert.notEqual(deleted, redated);
  assert.equal(deleted.length, 2, 'projection preserves the existing status-only selection contract');
  assert.equal(new PreviousPerformanceIndex(deleted).find(a.exercises[0], a.date)?.session, b);
});

test('previous-performance lookup ignores active, future, deleted and preparation-only sessions', () => {
  const valid = session('2026-10-01');
  const active = { ...session('2026-10-08', 'active'), status: 'active' as const };
  const removed = { ...session('2026-10-08', 'removed'), deletedAt: 1 };
  const future = session('2026-11-01');
  const prep = session('2026-10-08', 'prep');
  prep.exercises[0].preparationOnly = true;
  const source = [valid, active, removed, future, prep];
  const before = structuredClone(source);
  const result = new PreviousPerformanceIndex(source).find(valid.exercises[0], '2026-10-15');
  assert.equal(result?.session, valid);
  assert.deepEqual(source, before);
});

test('previous-performance lookup sorts by date then start time and supports an excluded session', () => {
  const first = session('2026-10-01'), earlier = session('2026-10-08', 'earlier');
  const later = { ...session('2026-10-08', 'later'), startedAt: earlier.startedAt + 1000 };
  const index = new PreviousPerformanceIndex([first, earlier, later]);
  const exercise = first.exercises[0];
  assert.equal(index.find(exercise, '2026-10-08')?.session, later);
  assert.equal(index.find(exercise, '2026-10-08', later.id)?.session, earlier);
  assert.equal(index.find(exercise, '2026-10-01')?.session, first);
  assert.equal(index.find(exercise, '2026-09-30'), null);
});

test('an exact exercise key resolves duplicate identities, while an ambiguous latest session blocks older reuse', () => {
  const older = session('2026-10-01'), latest = session('2026-10-08');
  latest.exercises = [
    { ...latest.exercises[0], key: 'first', logs: latest.exercises[0].logs.map(log => ({ ...log, kg: 62.5 })) },
    { ...latest.exercises[0], key: 'second', logs: latest.exercises[0].logs.map(log => ({ ...log, kg: 65 })) },
  ];
  const index = new PreviousPerformanceIndex([older, latest]);
  const target = { ...older.exercises[0], key: 'second' };
  assert.equal(index.find(target, '2026-10-15')?.exercise, latest.exercises[1]);
  assert.equal(index.find({ ...target, key: 'new-key' }, '2026-10-15'), null);
  assert.equal(index.find({ ...target, key: 'new-key' }, '2026-10-15', latest.id)?.session, older);
});

test('equipment, movement configuration and canonical exercise identity remain distinct', () => {
  const unlabeled = session('2026-10-01'), labeled = session('2026-10-08');
  labeled.exercises[0].equipmentLabel = 'Matrix Chest Press';
  const index = new PreviousPerformanceIndex([unlabeled, labeled]);
  assert.equal(index.find(unlabeled.exercises[0], '2026-10-15')?.session, unlabeled);
  assert.equal(index.find({ ...labeled.exercises[0], equipmentLabel: '  MATRIX   chest press ' }, '2026-10-15')?.session, labeled);
  for (const change of [
    { equipmentLabel: 'Technogym Chest Press' }, { perSide: true },
    { name: 'Incline Bench Press' }, { measurement: 'height' },
    { prescribedDistanceM: 10 }, { mode: 'bodyweight' }, { exerciseId: 'different-movement' },
  ]) assert.equal(index.find({ ...unlabeled.exercises[0], ...change }, '2026-10-15'), null);
});

test('previous-performance query cache is bounded and date/key/exclusion queries stay independent', () => {
  const older = session('2026-10-01'), latest = session('2026-10-08');
  const index = new PreviousPerformanceIndex([older, latest], 1);
  const target = latest.exercises[0];
  const first = index.find(target, '2026-10-15');
  assert.equal(index.find(target, '2026-10-15'), first, 'same query returns its cached read-only result');
  assert.equal(index.find(target, '2026-10-15', latest.id)?.session, older);
  const afterEviction = index.find(target, '2026-10-15');
  assert.notEqual(afterEviction, first, 'a bounded cache evicts earlier query wrappers');
  assert.equal(afterEviction?.session, latest);
  assert.equal(afterEviction?.exercise, latest.exercises[0]);
});
