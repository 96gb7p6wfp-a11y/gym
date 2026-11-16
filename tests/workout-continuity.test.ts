import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, SessionSchema, createSession, stopSessionTimers } from '../src/domain.js';
import { STORAGE_KEY } from '../src/storage.ts';
import { RestAlertTimer } from '../src/rest-audio.ts';
import { WORKOUT_CONTINUITY_KEY, claimWorkoutContinuity, clearWorkoutContinuity,
  getWorkoutContinuityOwner, readWorkoutContinuity, saveWorkoutContinuity } from '../src/workout-continuity.ts';

class MemoryStorage {
  values = new Map<string, string>();
  failKey: string | null = null;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failKey === key) throw new Error('Quota exceeded');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
}

function fixture() {
  const storage = new MemoryStorage(), tab = new MemoryStorage();
  const session = SessionSchema.parse(createSession(DEFAULT_PROFILE.plan[0], 0, '2026-11-16', DEFAULT_PROFILE, []));
  Object.assign(session.exercises[0].logs[0], { kg: 8, reps: 3, done: true });
  const state = { schemaVersion: 1, profile: structuredClone(DEFAULT_PROFILE), profileVersion: 4,
    sessions: [{ session, version: 2 }], nutrition: [] };
  const raw = JSON.stringify(state);
  storage.setItem(STORAGE_KEY, raw);
  const ownerId = getWorkoutContinuityOwner(tab)!;
  const target = { sessionId: session.id, exerciseKey: session.exercises[0].key, setId: session.exercises[0].logs[0].id };
  const now = session.startedAt, deadline = now + 90_000;
  const input = { ownerId, deadline, restOwner: target, receipt: target };
  return { storage, tab, session, state, raw, ownerId, target, now, deadline, input };
}

test('rest and Undo metadata survive a new browser context without changing any primary records', () => {
  const f = fixture();
  assert.equal(saveWorkoutContinuity(f.storage, f.input, f.now), true);
  const record = readWorkoutContinuity(f.storage, f.now + 10_000)!;
  assert.equal(record.deadline, f.deadline);
  assert.deepEqual(record.receipt, f.target);
  assert.deepEqual(record.restOwner, f.target);
  assert.equal(record.sessionId, f.session.id);
  assert.equal(f.storage.getItem(STORAGE_KEY), f.raw);
  assert.equal(getWorkoutContinuityOwner(f.tab), f.ownerId, 'refresh retains the existing tab owner');
});

test('a fresh independent tab never implicitly adopts or deletes another tab timer', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const before = f.storage.getItem(WORKOUT_CONTINUITY_KEY);
  const nextTab = new MemoryStorage(), nextOwner = getWorkoutContinuityOwner(nextTab)!;
  assert.notEqual(nextOwner, f.ownerId);
  assert.equal(readWorkoutContinuity(f.storage, f.now)?.ownerId, f.ownerId);
  clearWorkoutContinuity(f.storage, nextOwner);
  assert.equal(f.storage.getItem(WORKOUT_CONTINUITY_KEY), before);
  const claimed = claimWorkoutContinuity(f.storage, nextOwner, f.now + 5_000)!;
  assert.equal(claimed.ownerId, nextOwner);
  assert.equal(claimed.deadline, f.deadline, 'explicit resume retains the actual deadline, not a new countdown');
  clearWorkoutContinuity(f.storage, f.ownerId);
  assert.equal(readWorkoutContinuity(f.storage, f.now + 5_000)?.ownerId, nextOwner);
  assert.equal(f.storage.getItem(STORAGE_KEY), f.raw);
});

test('ordinary later set edits and profile changes do not invalidate the same active rest or Undo', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const later = structuredClone(f.state);
  later.profile.restSeconds = 120;
  later.profileVersion++;
  later.sessions[0].version++;
  later.sessions[0].session.notes = 'Later note';
  later.sessions[0].session.exercises[0].logs[1].kg = 9;
  f.storage.setItem(STORAGE_KEY, JSON.stringify(later));
  assert.equal(readWorkoutContinuity(f.storage, f.now)?.deadline, f.deadline);
  assert.deepEqual(readWorkoutContinuity(f.storage, f.now)?.receipt, f.target);
});

test('a restore, new session identity, changed start instant, finished workout or removed target never restores old metadata', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const variations = [
    { ...f.state, restoreGeneration: crypto.randomUUID() },
    { ...f.state, sessions: [{ ...f.state.sessions[0], session: { ...f.session, id: crypto.randomUUID() } }] },
    { ...f.state, sessions: [{ ...f.state.sessions[0], session: { ...f.session, startedAt: f.session.startedAt + 1 } }] },
    { ...f.state, sessions: [{ ...f.state.sessions[0], session: stopSessionTimers(f.session, 'completed', f.now + 1000) }] },
    { ...f.state, sessions: [{ ...f.state.sessions[0], session: { ...f.session, status: 'deleted', deletedAt: f.now + 1000 } }] },
    { ...f.state, sessions: [f.state.sessions[0], { session: { ...f.session, id: crypto.randomUUID() }, version: 1 }] },
    { ...f.state, sessions: [] },
    (() => { const changed = structuredClone(f.state); changed.sessions[0].session.exercises[0].logs[0].done = false; return changed; })(),
  ];
  for (const state of variations) {
    f.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    assert.equal(readWorkoutContinuity(f.storage, f.now), null);
    assert.equal(claimWorkoutContinuity(f.storage, 'other-tab', f.now), null);
  }
});

test('continuity saved after a restore is bound to that restore generation', () => {
  const f = fixture();
  const generation = crypto.randomUUID();
  f.storage.setItem(STORAGE_KEY, JSON.stringify({ ...f.state, restoreGeneration: generation }));
  assert.equal(saveWorkoutContinuity(f.storage, f.input, f.now), true);
  assert.equal(readWorkoutContinuity(f.storage, f.now)?.restoreGeneration, generation);
  f.storage.setItem(STORAGE_KEY, f.raw);
  assert.equal(readWorkoutContinuity(f.storage, f.now), null);
});

test('finishing the authoritative workout removes only that tab owner’s obsolete recovery record', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const finished = { ...f.state, sessions: [{ ...f.state.sessions[0],
    session: stopSessionTimers(f.session, 'completed', f.now + 1000) }] };
  const raw = JSON.stringify(finished);
  f.storage.setItem(STORAGE_KEY, raw);
  assert.equal(saveWorkoutContinuity(f.storage, { ...f.input, ownerId: 'other-tab' }, f.now), false);
  assert.notEqual(f.storage.getItem(WORKOUT_CONTINUITY_KEY), null);
  assert.equal(saveWorkoutContinuity(f.storage, f.input, f.now), false);
  assert.equal(f.storage.getItem(WORKOUT_CONTINUITY_KEY), null);
  assert.equal(f.storage.getItem(STORAGE_KEY), raw);
});

test('an uncommitted completion cannot create a durable receipt or rest owner', () => {
  const f = fixture();
  const undone = structuredClone(f.state);
  undone.sessions[0].session.exercises[0].logs[0].done = false;
  f.storage.setItem(STORAGE_KEY, JSON.stringify(undone));
  assert.equal(saveWorkoutContinuity(f.storage, f.input, f.now), false);
  assert.equal(f.storage.getItem(WORKOUT_CONTINUITY_KEY), null);
  assert.equal(f.storage.getItem(STORAGE_KEY), JSON.stringify(undone));
});

test('rest adjustment, rest completion and Undo update only optional continuity metadata', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  saveWorkoutContinuity(f.storage, { ...f.input, deadline: f.deadline + 15_000 }, f.now);
  assert.equal(readWorkoutContinuity(f.storage, f.now)?.deadline, f.deadline + 15_000);
  saveWorkoutContinuity(f.storage, { ...f.input, deadline: null, restOwner: null }, f.now);
  assert.equal(readWorkoutContinuity(f.storage, f.now)?.deadline, null);
  assert.deepEqual(readWorkoutContinuity(f.storage, f.now)?.receipt, f.target);
  saveWorkoutContinuity(f.storage, { ...f.input, deadline: null, restOwner: null, receipt: null }, f.now);
  assert.equal(f.storage.getItem(WORKOUT_CONTINUITY_KEY), null);
  assert.equal(f.storage.getItem(STORAGE_KEY), f.raw);
});

test('recently expired recovered rest completes silently exactly once rather than restarting or beeping', async () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const resumedAt = f.deadline + 1000;
  const recovered = claimWorkoutContinuity(f.storage, 'resumed-tab', resumedAt)!;
  let sounds = 0;
  const completions: unknown[] = [];
  const timer = new RestAlertTimer({ now: () => resumedAt, visible: () => true,
    schedule: () => { throw new Error('Expired rest must not restart'); }, cancel: () => {},
    play: async () => { sounds++; return true; }, onComplete: value => { completions.push(value); } });
  timer.update(recovered.deadline, true);
  timer.update(recovered.deadline, true);
  await Promise.resolve();
  assert.equal(sounds, 0);
  assert.deepEqual(completions, [{ audible: false, resumed: true }]);
  timer.dispose();
});

test('malformed, stale and incompatible metadata fail closed without modifying the primary store', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const valid = JSON.parse(f.storage.getItem(WORKOUT_CONTINUITY_KEY)!);
  for (const value of ['{', 'null', '[]', JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, deadline: '1000' }), JSON.stringify({ ...valid, updatedAt: f.now - 86_400_001 }),
    JSON.stringify({ ...valid, deadline: f.now + 86_400_001 }),
    JSON.stringify({ ...valid, receipt: { ...f.target, exerciseKey: 'unrelated' } }),
    JSON.stringify({ ...valid, restOwner: { ...f.target, sessionId: 'unrelated' } })]) {
    f.storage.setItem(WORKOUT_CONTINUITY_KEY, value);
    assert.equal(readWorkoutContinuity(f.storage, f.now), null);
  }
  assert.equal(f.storage.getItem(STORAGE_KEY), f.raw);
});

test('restricted storage or optional metadata quota failures do not throw or replace saved training data', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  const previous = f.storage.getItem(WORKOUT_CONTINUITY_KEY);
  f.storage.failKey = WORKOUT_CONTINUITY_KEY;
  assert.equal(saveWorkoutContinuity(f.storage, { ...f.input, deadline: f.deadline + 15_000 }, f.now), false);
  assert.equal(claimWorkoutContinuity(f.storage, 'another-tab', f.now), null);
  assert.equal(f.storage.getItem(WORKOUT_CONTINUITY_KEY), previous);
  assert.equal(f.storage.getItem(STORAGE_KEY), f.raw);
  const denied = { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Denied'); }, removeItem: () => { throw new Error('Denied'); } };
  assert.equal(getWorkoutContinuityOwner(denied), null);
  assert.equal(readWorkoutContinuity(denied), null);
  assert.equal(saveWorkoutContinuity(denied, f.input), false);
  assert.equal(claimWorkoutContinuity(denied, 'another-tab'), null);
  assert.doesNotThrow(() => clearWorkoutContinuity(denied, f.ownerId));
});

test('missing, malformed or unsupported main data cannot become permission to resume stale controls', () => {
  const f = fixture();
  saveWorkoutContinuity(f.storage, f.input, f.now);
  for (const main of [null, '{corrupt', 'null', JSON.stringify({ ...f.state, schemaVersion: 2 }),
    JSON.stringify({ ...f.state, restoreGeneration: 'invalid' })]) {
    if (main === null) f.storage.removeItem(STORAGE_KEY);
    else f.storage.setItem(STORAGE_KEY, main);
    assert.equal(readWorkoutContinuity(f.storage, f.now), null);
    assert.equal(claimWorkoutContinuity(f.storage, 'another-tab', f.now), null);
    assert.equal(saveWorkoutContinuity(f.storage, f.input, f.now), false);
    assert.equal(f.storage.getItem(STORAGE_KEY), main);
  }
});
