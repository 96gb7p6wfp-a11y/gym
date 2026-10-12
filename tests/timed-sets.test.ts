import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PROFILE, SessionExerciseSchema, SessionSchema, createSession } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';
import {
  applyTimedSetAction, recordedTimedSetSeconds,
  type TimedSetAction, type TimedSetExercise,
} from '../src/timed-sets.ts';

function movement(): TimedSetExercise {
  return {
    elapsedMs: 0, runningSince: null,
    logs: [{ id: 'first', done: false, seconds: 15 }, { id: 'second', done: false, seconds: 20 }],
  };
}

function workout() {
  return createSession(DEFAULT_PROFILE.plan[1], 1, '2026-10-06', DEFAULT_PROFILE, []);
}

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('set timers accumulate pause/resume segments and recover after a JSON reload', () => {
  const started = applyTimedSetAction(movement(), { action: 'start', setId: 'first' }, 1000);
  const paused = applyTimedSetAction(started, { action: 'pause', setId: 'first' }, 5000);
  assert.equal(paused.elapsedMs, 4000);
  assert.equal(paused.runningSince, null);
  assert.equal(paused.logs[0].seconds, 15, 'partial pauses preserve the target');
  const reloaded = JSON.parse(JSON.stringify(paused));
  const resumed = applyTimedSetAction(reloaded, { action: 'start', setId: 'first' }, 9000);
  assert.equal(recordedTimedSetSeconds(resumed, resumed.logs[0], 15_000), 10);
  const pausedAgain = applyTimedSetAction(resumed, { action: 'pause', setId: 'first' }, 15_000);
  assert.equal(recordedTimedSetSeconds(pausedAgain, pausedAgain.logs[0], 100_000), 10);
});

test('starting the next timed set resets its elapsed time instead of recording the movement total', () => {
  const started = applyTimedSetAction(movement(), { action: 'start', setId: 'first' }, 1000);
  const paused = applyTimedSetAction(started, { action: 'pause', setId: 'first' }, 16_000);
  const previousDone = {
    ...paused, logs: paused.logs.map((log) => log.id === 'first' ? { ...log, done: true } : log),
  };
  const next = applyTimedSetAction(previousDone, { action: 'start', setId: 'second' }, 20_000);
  assert.equal(next.timerSetId, 'second');
  assert.equal(next.elapsedMs, 0);
  assert.equal(recordedTimedSetSeconds(next, next.logs[1], 27_000), 7);
  assert.equal(recordedTimedSetSeconds(next, next.logs[0], 27_000), 15);
  assert.equal(previousDone.elapsedMs, 15_000);
});

test('a countdown finishing while backgrounded clamps overshoot but retains its target', () => {
  const started = applyTimedSetAction(movement(), { action: 'start', setId: 'first', seconds: 15 }, 1000);
  const finished = applyTimedSetAction(started, { action: 'pause', setId: 'first', seconds: 15 }, 90_000);
  assert.equal(finished.elapsedMs, 15_000);
  assert.equal(finished.runningSince, null);
  assert.equal(finished.logs[0].seconds, 15);
  assert.equal(recordedTimedSetSeconds(finished, finished.logs[0], 200_000), 15);
});

test('a countdown clamp cannot fabricate elapsed time before its target', () => {
  const started = applyTimedSetAction(movement(), { action: 'start', setId: 'first', seconds: 15 }, 1000);
  const paused = applyTimedSetAction(started, { action: 'pause', setId: 'first', seconds: 15 }, 5000);
  assert.equal(paused.elapsedMs, 4000);
  assert.equal(recordedTimedSetSeconds(paused, paused.logs[0], 6000), 4);
});

test('reset clears timing for the selected set and preserves its duration and existing logs', () => {
  const started = applyTimedSetAction(movement(), { action: 'start', setId: 'first', seconds: 25 }, 1000);
  const reset = applyTimedSetAction(started, { action: 'reset', setId: 'first' }, 10_000);
  assert.equal(reset.elapsedMs, 0);
  assert.equal(reset.runningSince, null);
  assert.equal(reset.timerSetId, 'first');
  assert.equal(reset.logs, started.logs);
  assert.equal(recordedTimedSetSeconds(reset, reset.logs[0], 11_000), 25);
});

test('manual durations remain valid when the set has not used its own timer', () => {
  const original = movement();
  assert.equal(recordedTimedSetSeconds(original, original.logs[0], 5000), 15);
  const otherRunning = applyTimedSetAction(original, { action: 'start', setId: 'second' }, 1000);
  assert.equal(recordedTimedSetSeconds(otherRunning, otherRunning.logs[0], 5000), 15);
  assert.equal(recordedTimedSetSeconds({ ...original, logs: [{ id: 'empty', done: false, seconds: null }] },
    { id: 'empty', done: false, seconds: null }, 5000), null);
});

test('legacy unowned timers preserve the original running-segment and manual-duration behavior', () => {
  const legacy = { ...movement(), elapsedMs: 50_000, runningSince: 10_000 };
  assert.equal(recordedTimedSetSeconds(legacy, legacy.logs[0], 14_000), 4);
  const stopped = { ...legacy, runningSince: null };
  assert.equal(recordedTimedSetSeconds(stopped, stopped.logs[0], 100_000), 15);
  assert.equal(recordedTimedSetSeconds({ ...legacy, timerSetId: null }, legacy.logs[0], 14_000), 4);
});

test('invalid IDs, actions, timestamps and durations never mutate the exercise', () => {
  const original = movement();
  const actions = [
    { action: 'start', setId: 'missing' },
    { action: 'pause', setId: 'missing' },
    { action: 'reset', setId: 'missing' },
    { action: 'unknown', setId: 'first' },
    { action: 'start', setId: 'first', seconds: Number.NaN },
    { action: 'start', setId: 'first', seconds: Infinity },
    { action: 'start', setId: 'first', seconds: -5 },
  ];
  for (const action of actions) assert.equal(applyTimedSetAction(original, action as TimedSetAction, 1000), original);
  for (const now of [Number.NaN, Infinity, -1]) {
    assert.equal(applyTimedSetAction(original, { action: 'start', setId: 'first' }, now), original);
  }
});

test('starting a completed set and pausing a different owner are ignored', () => {
  const original = {
    ...movement(), logs: [{ id: 'first', done: true, seconds: 15 }, { id: 'second', done: false, seconds: 20 }],
  };
  assert.equal(applyTimedSetAction(original, { action: 'start', setId: 'first' }, 1000), original);
  const started = applyTimedSetAction(original, { action: 'start', setId: 'second' }, 1000);
  assert.equal(applyTimedSetAction(started, { action: 'pause', setId: 'first' }, 5000), started);
});

test('duplicate start events do not restart a running set or discard already elapsed time', () => {
  const started = applyTimedSetAction(movement(), { action: 'start', setId: 'first' }, 1000);
  const repeated = applyTimedSetAction(started, { action: 'start', setId: 'first' }, 3000);
  assert.equal(repeated.runningSince, 1000);
  assert.equal(recordedTimedSetSeconds(repeated, repeated.logs[0], 5000), 4);
});

test('timer targets round to valid seconds and helper mutations preserve frozen inputs', () => {
  const original = Object.freeze({
    ...movement(), logs: Object.freeze(movement().logs.map((log) => Object.freeze(log))),
  });
  const updated = applyTimedSetAction(original, { action: 'start', setId: 'first', seconds: 12.6 }, 1000);
  assert.equal(updated.logs[0].seconds, 13);
  assert.equal(original.logs[0].seconds, 15);
  assert.equal(updated.logs[1], original.logs[1]);
  assert.equal(applyTimedSetAction(original, { action: 'start', setId: 'first', seconds: 0.1 }, 1000).logs[0].seconds, 1);
  assert.equal(applyTimedSetAction(original, { action: 'start', setId: 'first', seconds: 90_000 }, 1000).logs[0].seconds, 86_400);
});

test('optional timer ownership preserves legacy schema round-trips and rejects foreign sets', () => {
  const session = workout();
  const exercise = session.exercises[0];
  assert.deepEqual(SessionSchema.parse(session), session);
  assert.equal(Object.hasOwn(SessionExerciseSchema.parse(exercise), 'timerSetId'), false);
  assert.deepEqual(SessionExerciseSchema.parse({ ...exercise, timerSetId: null }), { ...exercise, timerSetId: null });
  assert.equal(SessionExerciseSchema.safeParse({ ...exercise, timerSetId: exercise.logs[0].id }).success, true);
  for (const timerSetId of ['another-movement-set', '', 'x'.repeat(101), 1]) {
    assert.equal(SessionExerciseSchema.safeParse({ ...exercise, timerSetId }).success, false);
  }
  const owned = structuredClone(session);
  owned.exercises[0].timerSetId = exercise.logs[0].id;
  assert.deepEqual(SessionSchema.parse(owned), owned);
});

test('per-set timers and legacy sessions persist through local saves, refresh and backup restoration', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const legacy = workout();
  await client.request('/api/tracker', { action: 'session', session: legacy, expectedVersion: 0 });
  const legacySaved = JSON.parse(storage.getItem(STORAGE_KEY)!);
  assert.equal(Object.hasOwn(legacySaved.sessions[0].session.exercises[0], 'timerSetId'), false);

  const timed = { ...legacy, exercises: legacy.exercises.map((exercise: TimedSetExercise, index: number) => index === 0
    ? applyTimedSetAction(exercise, { action: 'start', setId: exercise.logs[0].id, seconds: 30 }, 1000)
    : exercise) };
  await client.request('/api/tracker', { action: 'session', session: timed, expectedVersion: 1 });
  const refreshed = await createLocalClient(storage).request('/api/tracker');
  assert.deepEqual(refreshed.sessions, [{ session: timed, version: 2 }]);

  const restoredStorage = new MemoryStorage();
  const restoredClient = createLocalClient(restoredStorage);
  restoredClient.importBackup(client.exportBackup());
  assert.deepEqual(await restoredClient.request('/api/tracker'), refreshed);

  const legacyClient = createLocalClient(new MemoryStorage());
  const backup = JSON.parse(client.exportBackup());
  backup.data.sessions[0].session = legacy;
  legacyClient.importBackup(JSON.stringify(backup));
  assert.deepEqual((await legacyClient.request('/api/tracker')).sessions, [{ session: legacy, version: 2 }]);
});

test('invalid persisted timer ownership cannot replace an existing saved workout or backup', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const original = workout();
  await client.request('/api/tracker', { action: 'session', session: original, expectedVersion: 0 });
  const saved = storage.getItem(STORAGE_KEY);
  const invalid = structuredClone(original);
  invalid.exercises[0].timerSetId = 'not-this-exercise';
  await assert.rejects(client.request('/api/tracker', { action: 'session', session: invalid, expectedVersion: 1 }), /valid workout values/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  const backup = JSON.parse(client.exportBackup());
  backup.data.sessions[0].session = invalid;
  assert.throws(() => client.importBackup(JSON.stringify(backup)), /saved workout is invalid/);
  assert.equal(storage.getItem(STORAGE_KEY), saved);
});
