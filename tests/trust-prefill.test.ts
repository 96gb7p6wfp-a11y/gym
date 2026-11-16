import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { adjustSessionSets } from '../src/workout-customization.ts';
import { markSetInput } from '../src/set-autofill.ts';
import { previousSetReuse } from '../src/workout-reuse.ts';
import { createLocalClient } from '../src/storage.ts';

const date = '2026-11-16';
const base = { key: 'press', exerciseId: 'chest-press', name: 'Machine Chest Press',
  group: 'Chest', sets: 2, target: '6–8 reps', mode: 'weight' as const, rest: 120, perSide: false, defaultKg: 12.5 };
const plan = (extra: Record<string, unknown> = {}) => ({ ...structuredClone(DEFAULT_PROFILE.plan[0]), exercises: [{ ...base, ...extra }] });
const active = (extra: Record<string, unknown> = {}) => SessionSchema.parse(createSession(plan(extra), 0, date, DEFAULT_PROFILE, []));
const finished = (extra: Record<string, unknown> = {}) => SessionSchema.parse(stopSessionTimers(active(extra), 'completed'));

test('bodyweight-only history seeds genuinely unloaded reps while retaining the prescribed zero load', () => {
  const config = { name: 'Push-Up Plus', exerciseId: 'push-up-plus', mode: 'bodyweight', defaultKg: 0, target: '10–12 reps' };
  const previous = finished(config);
  previous.date = '2026-11-12';
  previous.exercises[0].logs.forEach((log, index) => Object.assign(log, { kg: index ? 0 : null, reps: index ? 11 : 12, done: true }));
  const snapshot = structuredClone(previous);
  const next = SessionSchema.parse(createSession(plan(config), 0, date, DEFAULT_PROFILE, [previous]));
  assert.deepEqual(next.exercises[0].logs.map(log => [log.kg, log.reps, log.done]), [[0, 12, false], [0, 11, false]]);
  assert.deepEqual(next.exercises[0].logs[0].inputSources, { kg: 'planned', reps: 'history' });
  assert.deepEqual(previousSetReuse(next.exercises[0], 0, [previous], date, next.id)?.patch, { kg: 0, reps: 12 });
  assert.deepEqual(previous, snapshot);
});

test('a bodyweight-only prescription cannot inherit added-load reps or weight, nor preparation work', () => {
  const config = { name: 'Push-Up Plus', exerciseId: 'push-up-plus', mode: 'bodyweight', defaultKg: 0, target: '10–12 reps' };
  const previous = finished(config);
  previous.date = '2026-11-12';
  previous.exercises[0].logs.forEach(log => Object.assign(log, { kg: 20, reps: 5, done: true }));
  const next = SessionSchema.parse(createSession(plan(config), 0, date, DEFAULT_PROFILE, [previous]));
  assert.deepEqual(next.exercises[0].logs.map(log => [log.kg, log.reps]), [[0, 10], [0, 10]]);
  assert.equal(previousSetReuse(next.exercises[0], 0, [previous], date, next.id), null);
  const preparation = SessionSchema.parse(createSession(plan({ ...config, preparationOnly: true }), 0, date, DEFAULT_PROFILE, [previous]));
  assert.equal(preparation.exercises[0].logs[0].inputSources?.reps, 'planned');
});

test('adding a working set copies the latest completed set and preserves every existing value, ID and timer', () => {
  const session = active();
  const exercise = session.exercises[0];
  Object.assign(exercise.logs[0], { kg: 60, reps: 8, rir: 2, done: true });
  exercise.logs[1] = markSetInput(exercise.logs[1], { kg: 62.5, reps: 7 });
  exercise.runningSince = 1000;
  session.notes = 'Keep this note';
  const before = structuredClone(session);
  const next = adjustSessionSets(session, exercise.key, 3);
  const added = next.exercises[0].logs[2];
  assert.deepEqual(next.exercises[0].logs.slice(0, 2), exercise.logs);
  assert.deepEqual([added.kg, added.reps, added.seconds, added.rir, added.done], [60, 8, null, null, false]);
  assert.deepEqual(added.inputSources, { kg: 'last-set', reps: 'last-set' });
  assert.equal(exercise.logs.some(log => log.id === added.id), false);
  assert.equal(next.exercises[0].runningSince, 1000);
  assert.equal(next.notes, session.notes);
  assert.equal(next.exercises[0].sets, 3);
  assert.deepEqual(session, before);
  assert.equal(SessionSchema.safeParse(next).success, true);
});

test('adding before a completion reuses a valid preceding draft without fabricating completion or effort', () => {
  const session = active();
  const exercise = session.exercises[0];
  exercise.logs[1] = markSetInput(exercise.logs[1], { kg: 62.5, reps: 7 });
  const next = adjustSessionSets(session, exercise.key, 4);
  assert.deepEqual(next.exercises[0].logs.slice(2).map(log => [log.kg, log.reps, log.done, log.rir]), [[62.5, 7, false, null], [62.5, 7, false, null]]);
  assert.equal(next.exercises[0].logs[2].inputSources?.kg, 'default');
  assert.deepEqual(next.exercises[0].logs[1], exercise.logs[1]);
});

test('an added set keeps historical draft provenance, or uses the prescribed rep target with no history', () => {
  const session = active();
  const exercise = session.exercises[0];
  Object.assign(exercise.logs[1], { kg: 55, reps: 8, inputSources: { kg: 'history', reps: 'history' } });
  const next = adjustSessionSets(session, exercise.key, 3);
  assert.deepEqual([next.exercises[0].logs[2].kg, next.exercises[0].logs[2].reps], [55, 8]);
  assert.deepEqual(next.exercises[0].logs[2].inputSources, { kg: 'history', reps: 'history' });
  const empty = active();
  empty.exercises[0].logs.forEach(log => { log.reps = null; });
  const fallback = adjustSessionSets(empty, exercise.key, 3).exercises[0].logs[2];
  assert.deepEqual([fallback.kg, fallback.reps, fallback.done], [12.5, 6, false]);
});

test('set addition never puts reps into timed, measured, distance or preparation-only records', () => {
  for (const config of [{ mode: 'timed', target: '30 sec' }, { measurement: 'height' }, { quantityUnit: 'm', prescribedDistanceM: 10 }, { preparationOnly: true }]) {
    const session = active(config);
    const exercise = session.exercises[0];
    Object.assign(exercise.logs[0], { kg: 60, reps: 30, seconds: 30, measurementCm: 60, done: true });
    const added = adjustSessionSets(session, exercise.key, 3).exercises[0].logs[2];
    assert.equal(added.reps, null);
    assert.equal(added.seconds, null);
    assert.equal(added.rir, null);
    assert.equal(added.measurementCm, undefined);
    assert.equal(added.done, false);
    assert.equal(added.kg, exercise.defaultKg);
  }
});

test('manually cleared existing drafts survive adding sets and bodyweight-only load remains zero', () => {
  const session = active({ mode: 'bodyweight', defaultKg: 0 });
  const exercise = session.exercises[0];
  Object.assign(exercise.logs[0], { kg: null, reps: 12, done: true });
  exercise.logs[1] = markSetInput(exercise.logs[1], { kg: null, reps: null });
  const next = adjustSessionSets(session, exercise.key, 3);
  assert.deepEqual(next.exercises[0].logs[1], exercise.logs[1]);
  assert.deepEqual(next.exercises[0].logs[1].inputSources, { kg: 'manual', reps: 'manual' });
  assert.equal(next.exercises[0].logs[2].kg, 0);
  assert.equal(next.exercises[0].logs[2].reps, 12);
});

test('new set suggestions round-trip through existing session persistence and version-1 backup', async () => {
  class MemoryStorage {
    data = new Map<string, string>();
    getItem(key: string) { return this.data.get(key) ?? null; }
    setItem(key: string, value: string) { this.data.set(key, value); }
    removeItem(key: string) { this.data.delete(key); }
  }
  const session = active();
  Object.assign(session.exercises[0].logs[0], { kg: 60, reps: 8, done: true });
  const next = adjustSessionSets(session, session.exercises[0].key, 3);
  const client = createLocalClient(new MemoryStorage());
  await client.request('/api/tracker', { action: 'session', session: next, expectedVersion: 0 });
  const backup = client.exportBackup();
  assert.equal(JSON.parse(backup).version, 1);
  const destination = createLocalClient(new MemoryStorage());
  destination.importBackup(backup);
  const result = await destination.request('/api/tracker') as { sessions: { session: typeof next }[]; profile: typeof DEFAULT_PROFILE };
  assert.deepEqual(result.sessions[0].session, next);
  assert.deepEqual(result.profile.plan, DEFAULT_PROFILE.plan);
});
