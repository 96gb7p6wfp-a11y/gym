import test from 'node:test';
import assert from 'node:assert/strict';
import { RestAlertTimer, RestChime, type RestCompletion } from '../src/rest-audio.ts';

function harness() {
  let now = 1_000;
  let visible = true;
  let count = 0;
  let sequence = 0;
  const pending = new Map<number, { due: number; fn: () => void }>();
  const completed: RestCompletion[] = [];
  const timer = new RestAlertTimer({
    now: () => now, visible: () => visible,
    schedule: (fn, delay) => { const id = ++sequence; pending.set(id, { due: now + delay, fn }); return id; },
    cancel: handle => { pending.delete(handle as number); },
    play: async () => { count += 1; return true; },
    onComplete: result => completed.push(result),
  });
  return {
    timer, completed, pending,
    count: () => count,
    advance: async (milliseconds: number) => {
      now += milliseconds;
      for (const [id, job] of [...pending]) if (job.due <= now) { pending.delete(id); job.fn(); }
      await Promise.resolve(); await Promise.resolve();
    },
    visibility: (next: boolean) => { visible = next; timer.visibilityChanged(); },
  };
}

test('rest deadline alerts once, even when the browser executes its callback late', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  await h.advance(4_999);
  assert.equal(h.count(), 0);
  await h.advance(800);
  assert.equal(h.count(), 1);
  assert.deepEqual(h.completed, [{ audible: true, resumed: false }]);
  h.timer.update(6_000, true);
  h.timer.visibilityChanged();
  await h.advance(20_000);
  assert.equal(h.count(), 1);
  assert.equal(h.completed.length, 1);
});

test('skip rest cancels a pending sound and a later timer gets its own alert', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.update(null, true);
  assert.equal(h.pending.size, 0);
  await h.advance(10_000);
  assert.equal(h.count(), 0);
  assert.equal(h.completed.length, 0);
  h.timer.update(12_000, true);
  await h.advance(1_000);
  assert.equal(h.count(), 1);
});

test('adding and subtracting rest changes the deadline without old callbacks alerting', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.update(21_000, true);
  await h.advance(5_000);
  assert.equal(h.count(), 0);
  assert.equal(h.pending.size, 1);
  h.timer.update(6_000, true);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.count(), 1);
  assert.equal(h.pending.size, 0);
  await h.advance(30_000);
  assert.equal(h.count(), 1);
});

test('disabled sound still completes the timer without scheduling audio', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.update(6_000, false);
  await h.advance(5_000);
  assert.equal(h.count(), 0);
  assert.deepEqual(h.completed, [{ audible: false, resumed: false }]);
});

test('background suspension does not drift and overdue rest resolves silently on return', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.visibility(false);
  assert.equal(h.pending.size, 0);
  await h.advance(80_000);
  assert.equal(h.count(), 0);
  assert.equal(h.completed.length, 0);
  h.visibility(true);
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(h.completed, [{ audible: false, resumed: true }]);
  assert.equal(h.count(), 0);
  h.visibility(true);
  assert.equal(h.completed.length, 1);
});

test('returning before the deadline schedules only the remaining real time', async () => {
  const h = harness();
  h.timer.update(21_000, true);
  h.visibility(false);
  await h.advance(15_000);
  h.visibility(true);
  await h.advance(4_999);
  assert.equal(h.count(), 0);
  await h.advance(1);
  assert.equal(h.count(), 1);
});

test('unmount clears pending sound and suppresses stale asynchronous completion', async () => {
  const h = harness();
  h.timer.update(6_000, true);
  h.timer.dispose();
  await h.advance(5_000);
  assert.equal(h.count(), 0);
  assert.equal(h.completed.length, 0);
});

test('audio requires a gesture unlock, uses a short two-tone envelope and tolerates missing support', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const sources: { start: number | undefined; stop: number | undefined; frequency: number; type: string }[] = [];
  let context: FakeContext;
  class FakeContext {
    state = 'suspended'; currentTime = 7; destination = {};
    constructor() { context = this; }
    async resume() { this.state = 'running'; }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createOscillator() {
      const record = { start: undefined as number | undefined, stop: undefined as number | undefined, frequency: 0, type: '' };
      sources.push(record);
      return {
        set type(value: string) { record.type = value; },
        frequency: { setValueAtTime(value: number) { record.frequency = value; } },
        connect() {}, disconnect() {}, onended: null,
        start(at?: number) { record.start = at; }, stop(at?: number) { record.stop = at; },
      };
    }
  }
  try {
    Object.defineProperty(globalThis, 'window', { value: { AudioContext: FakeContext }, configurable: true });
    const audio = new RestChime();
    assert.equal(await audio.play(), false);
    assert.equal(sources.length, 0);
    assert.equal(await audio.unlock(), true);
    assert.equal(sources.length, 1);
    assert.equal(await audio.play(), true);
    assert.deepEqual(sources.slice(1).map(source => source.frequency), [660, 880]);
    assert.ok(sources.slice(1).every(source => source.type === 'sine' && source.stop! - source.start! <= 0.51));
    context!.state = 'suspended';
    assert.equal(await audio.play(), false);
    assert.equal(sources.length, 3);
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    assert.equal(await new RestChime().unlock(), false);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
