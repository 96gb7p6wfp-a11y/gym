import assert from 'node:assert/strict';
import test from 'node:test';
import { CompletionIntentGate, targetSetTransition, type SetCompletionTarget } from '../src/set-completion.ts';

const first: SetCompletionTarget = { sessionId: 'workout', exerciseKey: 'press', setId: 'set-1' };
const second: SetCompletionTarget = { ...first, setId: 'set-2' };
const createSession = () => ({
  id: 'workout', title: 'My workout',
  exercises: [{ key: 'press', equipmentLabel: 'Matrix Chest Press', logs: [
    { id: 'set-1', done: false, kg: 62.5, reps: 8, rir: 2, seconds: null },
    { id: 'set-2', done: false, kg: 60, reps: 7, rir: 1, seconds: null },
    { id: 'set-3', done: false, kg: null, reps: null, rir: null, seconds: null },
  ] }],
});

test('ten rapid completion requests make exactly one immutable state transition and preserve every other set', () => {
  const initial = createSession();
  let session = initial;
  let timers = 0;
  let records = 0;
  for (let index = 0; index < 10; index++) {
    const next = targetSetTransition(session, first, true);
    if (next !== session) { timers++; records++; }
    session = next;
  }
  assert.equal(session.exercises[0].logs[0].done, true);
  assert.equal(timers, 1);
  assert.equal(records, 1);
  assert.deepEqual(session.exercises[0].logs.slice(1), initial.exercises[0].logs.slice(1));
  assert.equal(session.exercises[0].logs[1], initial.exercises[0].logs[1]);
  assert.equal(initial.exercises[0].logs[0].done, false);
});

test('a consumed action cannot follow auto-selected sets, React rerenders or stale callbacks', () => {
  const gate = new CompletionIntentGate(first);
  const intent = gate.claim(first);
  assert.ok(intent);
  for (let index = 0; index < 10; index++) {
    assert.equal(gate.claim(first), null);
    assert.equal(gate.claim(second), null);
    assert.equal(gate.isArmed(second), false);
  }
  gate.arm(second);
  // A callback captured for the first set cannot consume the next set's lease.
  assert.equal(gate.claim(first), null);
  const nextIntent = gate.claim(second);
  assert.ok(nextIntent);
  assert.notEqual(nextIntent.intentId, intent.intentId);
});

test('two intentional separate completions work without any elapsed-time requirement', () => {
  const gate = new CompletionIntentGate(first);
  let session = createSession();
  assert.ok(gate.claim(first));
  session = targetSetTransition(session, first, true);
  gate.arm(second);
  assert.ok(gate.claim(second));
  session = targetSetTransition(session, second, true);
  assert.deepEqual(session.exercises[0].logs.map(log => log.done), [true, true, false]);
});

test('undo restores only the targeted completion flag and keeps its entered weight, reps and RIR', () => {
  const initial = createSession();
  const completed = targetSetTransition(initial, first, true);
  const undone = targetSetTransition(completed, first, false);
  assert.deepEqual(undone, initial);
  assert.equal(undone.exercises[0].logs[1], initial.exercises[0].logs[1]);
  assert.equal(targetSetTransition(undone, first, false), undone);
});

test('refresh and repeated completion preserve the persisted set without another write', () => {
  const completed = targetSetTransition(createSession(), first, true);
  const restored = JSON.parse(JSON.stringify(completed));
  assert.equal(targetSetTransition(restored, first, true), restored);
  assert.deepEqual(restored.exercises[0].logs.map((log: { done: boolean }) => log.done), [true, false, false]);
});

test('mismatched or removed session, movement and set IDs cannot mutate another target', () => {
  const session = createSession();
  for (const target of [
    { ...first, sessionId: 'another-workout' },
    { ...first, exerciseKey: 'another-exercise' },
    { ...first, setId: 'removed-set' },
  ]) assert.equal(targetSetTransition(session, target, true), session);
});

test('a patch cannot change the immutable set ID or requested completion status', () => {
  const session = targetSetTransition(createSession(), first, true, { id: 'wrong', done: false, seconds: 30 });
  assert.deepEqual(session.exercises[0].logs[0], { id: 'set-1', done: true, kg: 62.5, reps: 8, rir: 2, seconds: 30 });
});

test('resetting the gate for a different workout invalidates all older callbacks', () => {
  const gate = new CompletionIntentGate(first);
  const other = { ...first, sessionId: 'other-workout' };
  gate.reset(other);
  assert.equal(gate.claim(first), null);
  assert.ok(gate.claim(other));
  gate.reset();
  assert.equal(gate.claim(other), null);
});
