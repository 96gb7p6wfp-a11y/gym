import assert from 'node:assert/strict';
import test from 'node:test';
import { carryForwardAfterCompletion, lastSetSuggestion, markSetInput, missingSetValuesFromLast, type CarryForwardExercise, type CarryForwardLog } from '../src/set-autofill.ts';
import { targetSetTransition } from '../src/set-completion.ts';
import { DEFAULT_PROFILE, SessionSchema, createSession } from '../src/domain.js';
import { createLocalClient, STORAGE_KEY } from '../src/storage.ts';

const log = (id: string, extra: Partial<CarryForwardLog> = {}): CarryForwardLog => ({ id, kg: null, reps: null, done: false, ...extra });
const exercise = (logs = [log('s1', { kg: 60, reps: 8, done: true }), log('s2'), log('s3')], extra: Partial<Omit<CarryForwardExercise, 'logs'>> = {}) =>
  ({ key: 'press', mode: 'weight' as const, logs, rest: 120, perSide: false, ...extra });
const session = (movement = exercise()) => ({ id: 'active', status: 'active', exercises: [movement], notes: 'Keep my session' });
const target = { sessionId: 'active', exerciseKey: 'press', setId: 's1' };

test('accepted completion fills only the next same-exercise draft in one immutable transition', () => {
  const before = session(exercise([log('s1', { kg: 60, reps: 8 }), log('s2'), log('s3')]));
  const original = structuredClone(before);
  const completed = targetSetTransition(before, target, true);
  const after = carryForwardAfterCompletion(completed, target);
  assert.deepEqual(after.exercises[0].logs[1], log('s2', { kg: 60, reps: 8, inputSources: { kg: 'last-set', reps: 'last-set' } }));
  assert.equal(after.exercises[0].logs[0].done, true);
  assert.equal(after.exercises[0].logs[1].done, false);
  assert.equal(after.exercises[0].logs[2], before.exercises[0].logs[2]);
  assert.equal(after.exercises[0].rest, 120);
  assert.equal(after.notes, before.notes);
  assert.deepEqual(before, original);
  // A duplicate action has no transition and a repeat fill has no mutation.
  assert.equal(targetSetTransition(after, target, true), after);
  assert.equal(carryForwardAfterCompletion(after, target), after);
});

test('existing legacy/manual values and explicit zeroes are protected field by field', () => {
  for (const next of [
    log('s2', { kg: 0, reps: 5 }),
    log('s2', { kg: 62.5, reps: 7, inputSources: { kg: 'manual', reps: 'manual' } }),
  ]) {
    const state = session(exercise([log('s1', { kg: 60, reps: 8, done: true }), next]));
    assert.equal(carryForwardAfterCompletion(state, target), state);
  }
  const mixed = session(exercise([log('s1', { kg: 60, reps: 8, done: true }), log('s2', { kg: 0 })]));
  const after = carryForwardAfterCompletion(mixed, target).exercises[0].logs[1];
  assert.equal(after.kg, 0);
  assert.equal(after.reps, 8);
  assert.deepEqual(after.inputSources, { reps: 'last-set' });
});

test('manual clear and invalid-input null stay protected after serialization and later completion', () => {
  let next = markSetInput(log('s2', { kg: 65, reps: 10 }), { kg: null, reps: null });
  assert.deepEqual(next.inputSources, { kg: 'manual', reps: 'manual' });
  next = JSON.parse(JSON.stringify(next));
  const state = session(exercise([log('s1', { kg: 60, reps: 8, done: true }), next]));
  assert.equal(carryForwardAfterCompletion(state, target), state);
  assert.equal(missingSetValuesFromLast(state.exercises[0], 's2'), null);
  assert.deepEqual(markSetInput(next, { kg: 0 }).inputSources, { kg: 'manual', reps: 'manual' });
});

test('a new deliberate completion carries its adjusted load/reps without copying effort or completion', () => {
  const first = carryForwardAfterCompletion(session(), target);
  const edited = markSetInput({ ...first.exercises[0].logs[1], rir: 1, seconds: null }, { kg: 62.5, reps: 7 });
  const state = { ...first, exercises: [{ ...first.exercises[0], logs: [first.exercises[0].logs[0], { ...edited, done: true }, first.exercises[0].logs[2]] }] };
  const lastTarget = { ...target, setId: 's2' };
  const next = carryForwardAfterCompletion(state, lastTarget).exercises[0].logs[2];
  assert.deepEqual(next, log('s3', { kg: 62.5, reps: 7, inputSources: { kg: 'last-set', reps: 'last-set' } }));
  assert.equal(Object.hasOwn(next, 'rir'), false);
  assert.equal(Object.hasOwn(next, 'seconds'), false);
});

test('correcting an undone source refreshes generated drafts while later manual choices remain protected', () => {
  const filled = carryForwardAfterCompletion(session(), target);
  const undone = targetSetTransition(filled, target, false);
  const corrected = { ...undone, exercises: [{ ...undone.exercises[0], logs: undone.exercises[0].logs.map((entry, index) =>
    index === 0 ? markSetInput(entry, { kg: 62.5, reps: 7 }) : entry) }] };
  const recompleted = targetSetTransition(corrected, target, true);
  const updated = carryForwardAfterCompletion(recompleted, target);
  assert.deepEqual(updated.exercises[0].logs[1], log('s2', { kg: 62.5, reps: 7,
    inputSources: { kg: 'last-set', reps: 'last-set' } }));
  assert.equal(carryForwardAfterCompletion(updated, target), updated);
  const manual = { ...recompleted, exercises: [{ ...recompleted.exercises[0], logs: recompleted.exercises[0].logs.map((entry, index) =>
    index === 1 ? markSetInput(entry, { kg: 57.5, reps: null }) : entry) }] };
  assert.equal(carryForwardAfterCompletion(manual, target), manual);
});

test('timed, measured, distance and preparation-only exercise logs cannot acquire lifting suggestions', () => {
  for (const patch of [
    { mode: 'timed' as const }, { measurement: 'touch' as const }, { measurement: 'height' as const },
    { measurement: 'distance' as const }, { quantityUnit: 'm' as const }, { preparationOnly: true },
  ]) {
    const state = session(exercise(undefined, patch));
    assert.equal(lastSetSuggestion(state.exercises[0], 's2'), null);
    assert.equal(carryForwardAfterCompletion(state, target), state);
  }
  for (const patch of [{ reps: 0 }, { reps: NaN }, { reps: 2.5 }, { reps: 1001 }, { kg: NaN }, { kg: -1 }, { kg: 2001 }, { kg: null }]) {
    const movement = exercise([log('s1', { kg: 60, reps: 8, done: true, ...patch }), log('s2')]);
    assert.equal(lastSetSuggestion(movement, 's2'), null);
  }
});

test('a superset carries only its own later round, preserving its partner, order and timers', () => {
  const first = { ...exercise(), superset: { id: 'pair', label: 'A', order: 1, rounds: 3, restAfterRound: 90 }, runningSince: null };
  const partner = { ...exercise([log('b1', { kg: 15, reps: 12 }), log('b2')]), key: 'row',
    superset: { ...first.superset, order: 2 }, runningSince: 123, timerSetId: 'b1' };
  const state = { ...session(first), exercises: [first, partner] };
  const after = carryForwardAfterCompletion(state, target);
  assert.equal(after.exercises[1], partner);
  assert.equal(after.exercises[0].superset, first.superset);
  assert.deepEqual(after.exercises[0].logs[1], log('s2', { kg: 60, reps: 8, inputSources: { kg: 'last-set', reps: 'last-set' } }));
});

test('bodyweight reps can carry without inventing additional load and source ordinals remain truthful', () => {
  const movement = exercise([log('s1', { kg: null, reps: 12, done: true }), log('s2'), log('s3')], { mode: 'bodyweight' });
  assert.deepEqual(lastSetSuggestion(movement, 's3'), { sourceSetId: 's1', sourceSetNumber: 1, patch: { kg: null, reps: 12 } });
  const result = missingSetValuesFromLast(movement, 's2');
  assert.deepEqual(result, { reps: 12, inputSources: { reps: 'last-set' } });
});

test('undo retains entered and suggested values, with no fill for inactive or foreign targets', () => {
  const filled = carryForwardAfterCompletion(session(), target);
  const undone = targetSetTransition(filled, target, false);
  assert.deepEqual(undone.exercises[0].logs[1], filled.exercises[0].logs[1]);
  assert.equal(carryForwardAfterCompletion(undone, target), undone);
  assert.equal(carryForwardAfterCompletion(filled, { ...target, sessionId: 'other' }), filled);
  assert.equal(carryForwardAfterCompletion(filled, { ...target, exerciseKey: 'other' }), filled);
  const history = { ...session(), status: 'completed' };
  assert.equal(carryForwardAfterCompletion(history, target), history);
});

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test('manual blanks and last-set provenance round-trip through schema, persisted sessions and version-1 backup', async () => {
  const plan = { ...DEFAULT_PROFILE.plan[0], exercises: [{ ...DEFAULT_PROFILE.plan[0].exercises[1], sets: 3 }] };
  const active = SessionSchema.parse(createSession(plan, 0, '2026-11-02', DEFAULT_PROFILE, []));
  active.runningSince = null;
  active.exercises[0].logs[0] = { ...active.exercises[0].logs[0], kg: 60, reps: 8, done: true };
  active.exercises[0].logs[1] = markSetInput(active.exercises[0].logs[1], { kg: null, reps: null });
  active.exercises[0].logs[2] = { ...active.exercises[0].logs[2], kg: 60, reps: 8,
    inputSources: { kg: 'last-set', reps: 'last-set' } };
  const parsed = SessionSchema.parse(active);
  assert.deepEqual(parsed.exercises[0].logs[1].inputSources, { kg: 'manual', reps: 'manual' });
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  await client.request('/api/tracker', { action: 'session', session: parsed, expectedVersion: 0 });
  const backup = client.exportBackup();
  assert.equal(JSON.parse(backup).version, 1);
  const destination = new MemoryStorage();
  const restored = createLocalClient(destination);
  restored.importBackup(backup);
  const payload = await restored.request('/api/tracker') as { sessions: { session: typeof parsed }[] };
  assert.deepEqual(payload.sessions[0].session, parsed);
  assert.equal(destination.getItem(STORAGE_KEY) !== null, true);
});

test('older backups stay importable without provenance materialization, and invalid provenance never partially overwrites', async () => {
  const storage = new MemoryStorage();
  const client = createLocalClient(storage);
  const active = createSession(DEFAULT_PROFILE.plan[0], 0, '2026-11-02', DEFAULT_PROFILE, []);
  for (const movement of active.exercises) for (const entry of movement.logs) delete entry.inputSources;
  await client.request('/api/tracker', { action: 'session', session: active, expectedVersion: 0 });
  const backup = client.exportBackup();
  const destination = new MemoryStorage();
  const restored = createLocalClient(destination);
  restored.importBackup(backup);
  const original = destination.getItem(STORAGE_KEY);
  const payload = await restored.request('/api/tracker') as { sessions: { session: typeof active }[] };
  assert.equal(Object.hasOwn(payload.sessions[0].session.exercises[0].logs[0], 'inputSources'), false);
  assert.equal(destination.getItem(STORAGE_KEY), original);
  const invalid = JSON.parse(backup);
  invalid.data.sessions[0].session.exercises[0].logs[0].inputSources = { kg: 'unrecognized' };
  assert.throws(() => restored.importBackup(JSON.stringify(invalid)), /saved workout/i);
  assert.equal(destination.getItem(STORAGE_KEY), original);
});
