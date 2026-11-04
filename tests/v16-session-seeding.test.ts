import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, ExerciseSchema, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';

const DATE = '2026-11-02';
const BASE = ExerciseSchema.parse({
  ...DEFAULT_PROFILE.plan[0].exercises[0], key: 'press', exerciseId: 'chest-press', name: 'Machine Chest Press',
  group: 'Strength', mode: 'weight', target: '8 reps', perSide: false, sets: 3,
});
const plan = (exercise = BASE) => ({ ...DEFAULT_PROFILE.plan[0], exercises: [exercise] });
function history(date: string, exercise = BASE, kg = 62.5) {
  const session = SessionSchema.parse(stopSessionTimers(createSession(plan(exercise), 0, date, DEFAULT_PROFILE, []), 'completed'));
  session.startedAt = Date.parse(`${date}T10:00:00Z`);
  session.exercises[0].logs = session.exercises[0].logs.map(log => ({ ...log, kg, reps: 8, rir: 2, done: true }));
  return session;
}
const draft = (exercise = BASE, sessions: ReturnType<typeof history>[] = []) => SessionSchema.parse(createSession(plan(exercise), 0, DATE, DEFAULT_PROFILE, sessions));
const values = (session: ReturnType<typeof draft>) => session.exercises[0].logs.map(log => ({ kg: log.kg, reps: log.reps, seconds: log.seconds, rir: log.rir, done: log.done }));

test('initial session suggestions respect normalized equipment and never label legacy history', () => {
  const technogym = history('2026-10-26', { ...BASE, equipmentLabel: 'Technogym Chest Press' });
  const same = draft({ ...BASE, equipmentLabel: '  TECHNOGYM   Chest Press ' }, [technogym]);
  assert.deepEqual(same.exercises[0].logs.map(log => [log.kg, log.reps]), [[62.5, 8], [62.5, 8], [62.5, 8]]);
  const before = structuredClone(technogym);
  for (const equipmentLabel of ['Matrix Chest Press', undefined]) {
    const incompatible = draft({ ...BASE, equipmentLabel, defaultKg: 10 }, [technogym]);
    assert.deepEqual(incompatible.exercises[0].logs.map(log => [log.kg, log.reps]), [[10, null], [10, null], [10, null]]);
  }
  const unlabeled = history('2026-10-26');
  const known = draft({ ...BASE, equipmentLabel: 'Technogym Chest Press' }, [unlabeled]);
  assert.equal(known.exercises[0].logs[0].kg, null);
  assert.equal(unlabeled.exercises[0].equipmentLabel, undefined);
  assert.deepEqual(technogym, before);
});

test('initial suggestions exclude incompatible movement configurations and preparation-only history', () => {
  const previous = history('2026-10-26');
  for (const patch of [{ perSide: true }, { quantityUnit: 'm' as const }, { measurement: 'height' as const }, { mode: 'bodyweight' as const }, { name: 'Renamed press' }, { preparationOnly: true }]) {
    const session = draft({ ...BASE, ...patch }, [previous]);
    assert.equal(session.exercises[0].logs[0].kg, null);
    assert.equal(session.exercises[0].logs[0].reps, null);
  }
  assert.equal(draft(BASE, [history('2026-10-26', { ...BASE, preparationOnly: true })]).exercises[0].logs[0].kg, null);
  const bodyweight = { ...BASE, name: 'Push-up', mode: 'bodyweight' as const };
  const withoutAddedLoad = draft({ ...bodyweight, defaultKg: 0 }, [history('2026-10-26', bodyweight, 20)]);
  assert.equal(withoutAddedLoad.exercises[0].logs[0].kg, 0);
  assert.equal(withoutAddedLoad.exercises[0].logs[0].reps, null);
});

test('source set ordinals remain stable and missing newest values never fall back to older work', () => {
  const older = history('2026-10-19', BASE, 55);
  const latest = history('2026-10-26', BASE, 60);
  latest.exercises[0].logs[0] = { ...latest.exercises[0].logs[0], done: false, kg: null, reps: null };
  latest.exercises[0].logs[1].reps = 7;
  const before = structuredClone([older, latest]);
  const session = draft(BASE, [older, latest]);
  assert.deepEqual(values(session), [
    { kg: null, reps: null, seconds: null, rir: null, done: false },
    { kg: 60, reps: 7, seconds: null, rir: null, done: false },
    { kg: 60, reps: 8, seconds: null, rir: null, done: false },
  ]);
  assert.deepEqual([older, latest], before);
});

test('only nondeleted, completed, nonfuture history can seed a new session', () => {
  const valid = history('2026-10-19', BASE, 50);
  const deleted = { ...history('2026-10-26', BASE, 60), deletedAt: Date.now() };
  const future = history('2026-11-03', BASE, 65);
  const active = { ...history('2026-10-30', BASE, 70), status: 'active' as const, finishedAt: null };
  const session = draft(BASE, [valid, deleted, future, active]);
  assert.equal(session.exercises[0].logs[0].kg, 50);
});

test('duplicate comparable movements require an exact instance or remain an empty baseline', () => {
  const first = history('2026-10-26', { ...BASE, key: 'first' }, 50);
  const second = history('2026-10-26', { ...BASE, key: 'second' }, 75);
  const combined = { ...first, exercises: [first.exercises[0], second.exercises[0]] };
  assert.equal(draft(BASE, [combined]).exercises[0].logs[0].kg, null);
  assert.equal(draft({ ...BASE, key: 'second' }, [combined]).exercises[0].logs[0].kg, 75);
});
